use crate::{
    error::AppError,
    models::{FsChangePayload, MarkdownFile, MarkdownFolder, PromptAttachment},
    state::WatcherState,
};
use notify::{Event, EventKind, RecommendedWatcher, RecursiveMode, Watcher};
use std::{
    collections::HashMap,
    fs::{self, File},
    io::Write,
    path::{Path, PathBuf},
    sync::{Arc, Mutex},
    time::{Duration, Instant, SystemTime, UNIX_EPOCH},
};
use tauri::{AppHandle, Emitter, State};
use tauri_plugin_dialog::DialogExt;
use walkdir::{DirEntry, WalkDir};

const IGNORED_DIRS: &[&str] = &[
    ".git",
    ".idea",
    ".next",
    ".nuxt",
    ".vscode",
    "__pycache__",
    "build",
    "dist",
    "node_modules",
    "target",
    "vendor",
];
const MAX_FILE_SIZE: u64 = 5 * 1024 * 1024;
const MAX_ATTACHMENT_PREVIEW_BYTES: u64 = 512 * 1024;
const MAX_PATH_NAME_LENGTH: usize = 255;

#[tauri::command]
pub async fn fs_pick_folder(app: AppHandle) -> Result<Option<String>, AppError> {
    let picked = app.dialog().file().blocking_pick_folder();
    let Some(path) = picked else {
        return Ok(None);
    };
    let path = path
        .into_path()
        .map_err(|_| AppError::FsInvalidPath("Could not resolve selected folder path".into()))?;
    Ok(Some(path.to_string_lossy().to_string()))
}

#[tauri::command]
pub fn fs_list_markdown_files(
    folder_path: String,
    watcher_state: State<WatcherState>,
) -> Result<Vec<MarkdownFile>, AppError> {
    let folder = canonical_folder(&folder_path)?;
    watcher_state
        .open_folder
        .lock()
        .map_err(|_| AppError::internal("Open folder state poisoned"))?
        .replace(folder.clone());

    let mut files = Vec::new();
    let walker = WalkDir::new(&folder)
        .follow_links(false)
        .into_iter()
        .filter_entry(should_descend_into);

    for entry in walker {
        let entry = entry.map_err(|error| AppError::internal(error.to_string()))?;
        if !entry.file_type().is_file() || !is_markdown_path(entry.path()) {
            continue;
        }
        let metadata = entry
            .metadata()
            .map_err(|error| AppError::internal(error.to_string()))?;
        if metadata.len() > MAX_FILE_SIZE {
            continue;
        }
        files.push(markdown_file_from_path(
            &folder,
            entry.path(),
            metadata.len(),
        )?);
    }

    files.sort_by(|a, b| {
        a.relative_path
            .to_lowercase()
            .cmp(&b.relative_path.to_lowercase())
    });
    Ok(files)
}

#[tauri::command]
pub fn fs_list_folders(
    folder_path: String,
    watcher_state: State<WatcherState>,
) -> Result<Vec<MarkdownFolder>, AppError> {
    let folder = canonical_folder(&folder_path)?;
    watcher_state
        .open_folder
        .lock()
        .map_err(|_| AppError::internal("Open folder state poisoned"))?
        .replace(folder.clone());

    let mut folders = Vec::new();
    let walker = WalkDir::new(&folder)
        .follow_links(false)
        .into_iter()
        .filter_entry(should_descend_into);

    for entry in walker {
        let entry = entry.map_err(|error| AppError::internal(error.to_string()))?;
        if entry.depth() == 0 || !entry.file_type().is_dir() {
            continue;
        }
        folders.push(markdown_folder_from_path(&folder, entry.path())?);
    }

    folders.sort_by(|a, b| {
        a.relative_path
            .to_lowercase()
            .cmp(&b.relative_path.to_lowercase())
    });
    Ok(folders)
}

#[tauri::command]
pub fn fs_read_file(
    file_path: String,
    watcher_state: State<WatcherState>,
) -> Result<String, AppError> {
    let path = validate_markdown_file(&file_path, &watcher_state)?;
    fs::read_to_string(path).map_err(AppError::from)
}

#[tauri::command]
pub fn fs_write_file(
    file_path: String,
    content: String,
    watcher_state: State<WatcherState>,
) -> Result<(), AppError> {
    let path = validate_markdown_file(&file_path, &watcher_state)?;
    atomic_write(&path, content.as_bytes())
}

#[tauri::command]
pub fn fs_create_file(
    folder_path: String,
    file_name: String,
    parent_folder_path: Option<String>,
    watcher_state: State<WatcherState>,
) -> Result<MarkdownFile, AppError> {
    let folder = canonical_folder(&folder_path)?;
    watcher_state
        .open_folder
        .lock()
        .map_err(|_| AppError::internal("Open folder state poisoned"))?
        .replace(folder.clone());

    let safe_name = sanitize_file_name(&file_name)?;
    let target_folder = create_file_parent_folder(&folder, parent_folder_path)?;
    let target = dedupe_path(&target_folder, &safe_name);
    atomic_write(&target, b"")?;
    let metadata = fs::metadata(&target)?;
    markdown_file_from_path(&folder, &target, metadata.len())
}

#[tauri::command]
pub fn fs_create_folder(
    folder_path: String,
    folder_name: String,
    watcher_state: State<WatcherState>,
) -> Result<MarkdownFolder, AppError> {
    let folder = canonical_folder(&folder_path)?;
    watcher_state
        .open_folder
        .lock()
        .map_err(|_| AppError::internal("Open folder state poisoned"))?
        .replace(folder.clone());

    let safe_name = sanitize_folder_name(&folder_name)?;
    let target = dedupe_folder_path(&folder, &safe_name);
    fs::create_dir(&target)?;
    markdown_folder_from_path(&folder, &target)
}

#[tauri::command]
pub fn fs_rename_file(
    old_path: String,
    new_name: String,
    watcher_state: State<WatcherState>,
) -> Result<MarkdownFile, AppError> {
    let old = validate_markdown_file(&old_path, &watcher_state)?;
    let folder = open_folder(&watcher_state)?;
    let safe_name = sanitize_file_name(&new_name)?;
    let new_path = old
        .parent()
        .ok_or_else(|| AppError::FsInvalidPath("File has no parent folder".into()))?
        .join(safe_name);

    ensure_inside(&folder, &new_path)?;
    if new_path.exists() {
        return Err(AppError::FsInvalidPath(
            "A file with that name already exists".into(),
        ));
    }
    fs::rename(&old, &new_path)?;
    let metadata = fs::metadata(&new_path)?;
    markdown_file_from_path(&folder, &new_path, metadata.len())
}

#[tauri::command]
pub fn fs_rename_folder(
    old_path: String,
    new_name: String,
    watcher_state: State<WatcherState>,
) -> Result<MarkdownFolder, AppError> {
    let old = validate_folder(&old_path, &watcher_state)?;
    let folder = open_folder(&watcher_state)?;
    let safe_name = sanitize_folder_name(&new_name)?;
    let new_path = old
        .parent()
        .ok_or_else(|| AppError::FsInvalidPath("Folder has no parent folder".into()))?
        .join(safe_name);

    ensure_inside(&folder, &new_path)?;
    if new_path.exists() {
        return Err(AppError::FsInvalidPath(
            "A folder with that name already exists".into(),
        ));
    }
    fs::rename(&old, &new_path)?;
    markdown_folder_from_path(&folder, &new_path)
}

#[tauri::command]
pub fn fs_delete_file(
    file_path: String,
    watcher_state: State<WatcherState>,
) -> Result<(), AppError> {
    let path = validate_markdown_file(&file_path, &watcher_state)?;
    trash::delete(path).map_err(|error| AppError::internal(error.to_string()))
}

#[tauri::command]
pub fn fs_delete_folder(
    folder_path: String,
    watcher_state: State<WatcherState>,
) -> Result<(), AppError> {
    let path = validate_folder(&folder_path, &watcher_state)?;
    trash::delete(path).map_err(|error| AppError::internal(error.to_string()))
}

#[tauri::command]
pub fn fs_describe_attachments(
    paths: Vec<String>,
    watcher_state: State<WatcherState>,
) -> Result<Vec<PromptAttachment>, AppError> {
    let folder = open_folder(&watcher_state)?;
    let mut attachments = Vec::new();

    for path in paths {
        let Ok(canonical) = fs::canonicalize(&path) else {
            continue;
        };
        ensure_inside(&folder, &canonical)?;
        let Ok(metadata) = fs::metadata(&canonical) else {
            continue;
        };
        if !metadata.is_file() {
            continue;
        }

        let mime_type = mime_type_for_path(&canonical);
        attachments.push(PromptAttachment {
            path: canonical.to_string_lossy().to_string(),
            name: canonical
                .file_name()
                .unwrap_or_default()
                .to_string_lossy()
                .to_string(),
            size: metadata.len(),
            kind: attachment_kind(&canonical, mime_type.as_deref()).to_string(),
            preview_data_url: attachment_preview_data_url(
                &canonical,
                metadata.len(),
                mime_type.as_deref(),
            )?,
            mime_type,
        });
    }

    Ok(attachments)
}

#[tauri::command]
pub fn fs_watch_folder(
    app: AppHandle,
    folder_path: String,
    watcher_state: State<WatcherState>,
) -> Result<(), AppError> {
    let folder = canonical_folder(&folder_path)?;
    let debounced = Arc::new(Mutex::new(HashMap::<PathBuf, Instant>::new()));
    let app_handle = app.clone();

    let mut watcher: RecommendedWatcher =
        notify::recommended_watcher(move |result: Result<Event, notify::Error>| {
            let Ok(event) = result else {
                return;
            };

            let Some(kind) = map_event_kind(&event.kind) else {
                return;
            };

            for path in event.paths {
                if !is_markdown_path(&path) {
                    continue;
                }
                let now = Instant::now();
                let should_emit = {
                    let mut seen = match debounced.lock() {
                        Ok(seen) => seen,
                        Err(_) => return,
                    };
                    match seen.get(&path) {
                        Some(last) if now.duration_since(*last) < Duration::from_millis(200) => {
                            false
                        }
                        _ => {
                            seen.insert(path.clone(), now);
                            true
                        }
                    }
                };
                if should_emit {
                    let _ = app_handle.emit(
                        "fs:change",
                        FsChangePayload {
                            event: kind.to_string(),
                            path: path.to_string_lossy().to_string(),
                        },
                    );
                }
            }
        })?;

    watcher.watch(&folder, RecursiveMode::Recursive)?;
    watcher_state
        .watcher
        .lock()
        .map_err(|_| AppError::internal("Watcher state poisoned"))?
        .replace(watcher);
    watcher_state
        .open_folder
        .lock()
        .map_err(|_| AppError::internal("Open folder state poisoned"))?
        .replace(folder);
    Ok(())
}

#[tauri::command]
pub fn fs_unwatch_folder(watcher_state: State<WatcherState>) -> Result<(), AppError> {
    watcher_state
        .watcher
        .lock()
        .map_err(|_| AppError::internal("Watcher state poisoned"))?
        .take();
    watcher_state
        .open_folder
        .lock()
        .map_err(|_| AppError::internal("Open folder state poisoned"))?
        .take();
    Ok(())
}

fn canonical_folder(folder_path: &str) -> Result<PathBuf, AppError> {
    let folder = fs::canonicalize(folder_path)?;
    if !folder.is_dir() {
        return Err(AppError::FsInvalidPath(
            "Selected path is not a folder".into(),
        ));
    }
    Ok(folder)
}

fn open_folder(watcher_state: &State<WatcherState>) -> Result<PathBuf, AppError> {
    watcher_state
        .open_folder
        .lock()
        .map_err(|_| AppError::internal("Open folder state poisoned"))?
        .clone()
        .ok_or_else(|| AppError::FsInvalidPath("No folder is currently open".into()))
}

fn validate_markdown_file(
    file_path: &str,
    watcher_state: &State<WatcherState>,
) -> Result<PathBuf, AppError> {
    let folder = open_folder(watcher_state)?;
    let path = PathBuf::from(file_path);
    ensure_inside(&folder, &path)?;
    if !is_markdown_path(&path) {
        return Err(AppError::FsInvalidPath(
            "Only markdown files can be opened".into(),
        ));
    }
    Ok(path)
}

fn validate_folder(
    folder_path: &str,
    watcher_state: &State<WatcherState>,
) -> Result<PathBuf, AppError> {
    let folder = open_folder(watcher_state)?;
    let path = PathBuf::from(folder_path);
    ensure_inside(&folder, &path)?;
    if !path.is_dir() {
        return Err(AppError::FsInvalidPath("Folder does not exist".into()));
    }
    if path == folder {
        return Err(AppError::FsInvalidPath(
            "The open folder cannot be changed here".into(),
        ));
    }
    Ok(path)
}

fn create_file_parent_folder(
    folder: &Path,
    parent_folder_path: Option<String>,
) -> Result<PathBuf, AppError> {
    let Some(parent_folder_path) = parent_folder_path else {
        return Ok(folder.to_path_buf());
    };
    let trimmed = parent_folder_path.trim();
    if trimmed.is_empty() {
        return Ok(folder.to_path_buf());
    }

    let parent = fs::canonicalize(trimmed)?;
    ensure_inside(folder, &parent)?;
    if !parent.is_dir() {
        return Err(AppError::FsInvalidPath("Folder does not exist".into()));
    }
    Ok(parent)
}

fn ensure_inside(folder: &Path, path: &Path) -> Result<(), AppError> {
    let canonical_parent = if path.exists() {
        fs::canonicalize(path)?
    } else {
        let parent = path
            .parent()
            .ok_or_else(|| AppError::FsInvalidPath("Path has no parent".into()))?;
        fs::canonicalize(parent)?
    };
    if canonical_parent.starts_with(folder) {
        Ok(())
    } else {
        Err(AppError::FsInvalidPath(
            "Path is outside the open folder".into(),
        ))
    }
}

fn should_descend_into(entry: &DirEntry) -> bool {
    if entry.depth() == 0 {
        return true;
    }
    let name = entry.file_name().to_string_lossy();
    if entry.file_type().is_dir() {
        if name.starts_with('.') {
            return false;
        }
        return !IGNORED_DIRS
            .iter()
            .any(|ignored| name.eq_ignore_ascii_case(ignored));
    }
    true
}

fn is_markdown_path(path: &Path) -> bool {
    matches!(
        path.extension().and_then(|extension| extension.to_str()).map(str::to_lowercase),
        Some(extension) if extension == "md" || extension == "markdown"
    )
}

fn attachment_kind(path: &Path, mime_type: Option<&str>) -> &'static str {
    if mime_type.is_some_and(|mime_type| mime_type.starts_with("image/")) {
        return "image";
    }
    if mime_type == Some("application/pdf") {
        return "pdf";
    }
    if mime_type.is_some_and(|mime_type| mime_type.starts_with("text/")) || is_markdown_path(path) {
        return "text";
    }
    "file"
}

fn mime_type_for_path(path: &Path) -> Option<String> {
    let extension = path
        .extension()
        .and_then(|extension| extension.to_str())?
        .to_lowercase();
    let mime_type = match extension.as_str() {
        "png" => "image/png",
        "jpg" | "jpeg" => "image/jpeg",
        "gif" => "image/gif",
        "webp" => "image/webp",
        "pdf" => "application/pdf",
        "md" | "markdown" => "text/markdown",
        "txt" => "text/plain",
        "csv" => "text/csv",
        "json" => "application/json",
        "html" | "htm" => "text/html",
        "css" => "text/css",
        "js" | "mjs" | "cjs" => "text/javascript",
        "ts" | "tsx" => "text/typescript",
        "rs" => "text/rust",
        "py" => "text/x-python",
        "toml" => "text/toml",
        "yaml" | "yml" => "text/yaml",
        "xml" => "application/xml",
        _ => return None,
    };
    Some(mime_type.to_string())
}

fn attachment_preview_data_url(
    path: &Path,
    size: u64,
    mime_type: Option<&str>,
) -> Result<Option<String>, AppError> {
    let Some(mime_type) = mime_type else {
        return Ok(None);
    };
    if size > MAX_ATTACHMENT_PREVIEW_BYTES || !is_previewable_image_mime(mime_type) {
        return Ok(None);
    }

    let bytes = fs::read(path)?;
    Ok(Some(format!(
        "data:{mime_type};base64,{}",
        base64_encode(&bytes)
    )))
}

fn is_previewable_image_mime(mime_type: &str) -> bool {
    matches!(
        mime_type,
        "image/png" | "image/jpeg" | "image/gif" | "image/webp"
    )
}

fn base64_encode(bytes: &[u8]) -> String {
    const TABLE: &[u8; 64] = b"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
    let mut encoded = String::with_capacity(bytes.len().div_ceil(3) * 4);

    for chunk in bytes.chunks(3) {
        let first = chunk[0];
        let second = chunk.get(1).copied().unwrap_or(0);
        let third = chunk.get(2).copied().unwrap_or(0);
        let combined = ((first as u32) << 16) | ((second as u32) << 8) | third as u32;

        encoded.push(TABLE[((combined >> 18) & 0x3f) as usize] as char);
        encoded.push(TABLE[((combined >> 12) & 0x3f) as usize] as char);
        encoded.push(if chunk.len() > 1 {
            TABLE[((combined >> 6) & 0x3f) as usize] as char
        } else {
            '='
        });
        encoded.push(if chunk.len() > 2 {
            TABLE[(combined & 0x3f) as usize] as char
        } else {
            '='
        });
    }

    encoded
}

fn markdown_file_from_path(
    folder: &Path,
    path: &Path,
    size: u64,
) -> Result<MarkdownFile, AppError> {
    let relative_path = path
        .strip_prefix(folder)
        .map_err(|_| AppError::FsInvalidPath("File is outside the open folder".into()))?
        .to_string_lossy()
        .to_string();
    let modified_at = fs::metadata(path)?
        .modified()
        .unwrap_or(SystemTime::UNIX_EPOCH)
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis();

    Ok(MarkdownFile {
        path: path.to_string_lossy().to_string(),
        relative_path,
        name: path
            .file_name()
            .unwrap_or_default()
            .to_string_lossy()
            .to_string(),
        size,
        modified_at,
    })
}

fn markdown_folder_from_path(folder: &Path, path: &Path) -> Result<MarkdownFolder, AppError> {
    let relative_path = path
        .strip_prefix(folder)
        .map_err(|_| AppError::FsInvalidPath("Folder is outside the open folder".into()))?
        .to_string_lossy()
        .to_string();

    Ok(MarkdownFolder {
        path: path.to_string_lossy().to_string(),
        relative_path,
        name: path
            .file_name()
            .unwrap_or_default()
            .to_string_lossy()
            .to_string(),
    })
}

fn sanitize_file_name(file_name: &str) -> Result<String, AppError> {
    let trimmed = file_name.trim();
    if !is_valid_path_name(trimmed) {
        return Err(AppError::FsInvalidPath(
            "Use a valid markdown filename".into(),
        ));
    }
    let mut name = trimmed.to_string();
    if !name.ends_with(".md") && !name.ends_with(".markdown") {
        name.push_str(".md");
    }
    if name.len() > MAX_PATH_NAME_LENGTH {
        return Err(AppError::FsInvalidPath(
            "Use a valid markdown filename".into(),
        ));
    }
    Ok(name)
}

fn sanitize_folder_name(folder_name: &str) -> Result<String, AppError> {
    let trimmed = folder_name.trim();
    let ignored = IGNORED_DIRS
        .iter()
        .any(|ignored| trimmed.eq_ignore_ascii_case(ignored));
    if !is_valid_path_name(trimmed) || trimmed.starts_with('.') || ignored {
        return Err(AppError::FsInvalidPath("Use a valid folder name".into()));
    }
    Ok(trimmed.to_string())
}

fn is_valid_path_name(name: &str) -> bool {
    !name.is_empty()
        && name.len() <= MAX_PATH_NAME_LENGTH
        && !name.contains('/')
        && !name.contains('\\')
        && !name.contains(':')
        && !name.ends_with(' ')
        && !name.ends_with('.')
        && name != "."
        && name != ".."
        && !is_windows_reserved_base_name(name)
}

fn is_windows_reserved_base_name(name: &str) -> bool {
    let base = name.split('.').next().unwrap_or_default();
    let upper = base.to_ascii_uppercase();
    matches!(upper.as_str(), "CON" | "PRN" | "AUX" | "NUL")
        || reserved_numbered_device(&upper, "COM")
        || reserved_numbered_device(&upper, "LPT")
}

fn reserved_numbered_device(name: &str, prefix: &str) -> bool {
    let Some(suffix) = name.strip_prefix(prefix) else {
        return false;
    };
    suffix.len() == 1 && matches!(suffix.as_bytes()[0], b'1'..=b'9')
}

fn dedupe_path(folder: &Path, file_name: &str) -> PathBuf {
    let base = Path::new(file_name)
        .file_stem()
        .unwrap_or_default()
        .to_string_lossy();
    let extension = Path::new(file_name)
        .extension()
        .and_then(|extension| extension.to_str())
        .unwrap_or("md");

    let mut candidate = folder.join(file_name);
    let mut count = 2;
    while candidate.exists() {
        candidate = folder.join(format!("{base} {count}.{extension}"));
        count += 1;
    }
    candidate
}

fn dedupe_folder_path(folder: &Path, folder_name: &str) -> PathBuf {
    let mut candidate = folder.join(folder_name);
    let mut count = 2;
    while candidate.exists() {
        candidate = folder.join(format!("{folder_name} {count}"));
        count += 1;
    }
    candidate
}

fn atomic_write(path: &Path, bytes: &[u8]) -> Result<(), AppError> {
    let tmp = path.with_extension(format!(
        "{}.skribe.tmp",
        path.extension()
            .and_then(|extension| extension.to_str())
            .unwrap_or("md")
    ));
    {
        let mut file = File::create(&tmp)?;
        file.write_all(bytes)?;
        file.sync_all()?;
    }
    fs::rename(tmp, path)?;
    Ok(())
}

fn map_event_kind(kind: &EventKind) -> Option<&'static str> {
    match kind {
        EventKind::Create(_) => Some("created"),
        EventKind::Modify(_) => Some("modified"),
        EventKind::Remove(_) => Some("deleted"),
        _ => None,
    }
}

#[cfg(test)]
mod tests {
    use super::{
        create_file_parent_folder, dedupe_folder_path, dedupe_path, is_markdown_path,
        sanitize_file_name, sanitize_folder_name, should_descend_into,
    };
    use std::{fs, path::Path};
    use walkdir::WalkDir;

    #[test]
    fn recognizes_markdown_extensions() {
        assert!(is_markdown_path(Path::new("README.md")));
        assert!(is_markdown_path(Path::new("notes.MARKDOWN")));
        assert!(!is_markdown_path(Path::new("image.png")));
    }

    #[test]
    fn walks_selected_root_and_skips_ignored_dirs() {
        let root = std::env::temp_dir().join(format!("skribe-walk-test-{}", std::process::id()));
        let _ = fs::remove_dir_all(&root);
        fs::create_dir_all(root.join("docs")).unwrap();
        fs::create_dir_all(root.join("a/b/c/d/e/f")).unwrap();
        fs::create_dir_all(root.join(".git")).unwrap();
        fs::write(root.join("README.md"), "# Readme").unwrap();
        fs::write(root.join("docs").join("notes.markdown"), "# Notes").unwrap();
        fs::write(root.join("a/b/c/d/e/f").join("deep.md"), "# Deep").unwrap();
        fs::write(root.join(".git").join("ignored.md"), "# Ignored").unwrap();

        let files = WalkDir::new(&root)
            .follow_links(false)
            .into_iter()
            .filter_entry(should_descend_into)
            .filter_map(Result::ok)
            .filter(|entry| entry.file_type().is_file() && is_markdown_path(entry.path()))
            .map(|entry| {
                entry
                    .path()
                    .strip_prefix(&root)
                    .unwrap()
                    .to_string_lossy()
                    .to_string()
            })
            .collect::<Vec<_>>();

        assert!(files.contains(&"README.md".to_string()));
        assert!(files.contains(&"docs/notes.markdown".to_string()));
        assert!(files.contains(&"a/b/c/d/e/f/deep.md".to_string()));
        assert!(!files.contains(&".git/ignored.md".to_string()));

        let _ = fs::remove_dir_all(root);
    }

    #[test]
    fn prepares_new_markdown_file_names_in_the_open_folder_root() {
        let root = std::env::temp_dir().join(format!("skribe-create-test-{}", std::process::id()));
        let _ = fs::remove_dir_all(&root);
        fs::create_dir_all(&root).unwrap();
        fs::write(root.join("Untitled.md"), "").unwrap();
        fs::write(root.join("Untitled 2.md"), "").unwrap();

        let safe_name = sanitize_file_name("Untitled").unwrap();
        let next_path = dedupe_path(&root, &safe_name);

        assert_eq!(safe_name, "Untitled.md");
        assert_eq!(next_path, root.join("Untitled 3.md"));
        assert!(sanitize_file_name("../notes.md").is_err());
        assert!(sanitize_file_name("CON").is_err());
        assert!(sanitize_file_name("notes.").is_err());
        assert!(sanitize_file_name(&"a".repeat(256)).is_err());

        let _ = fs::remove_dir_all(root);
    }

    #[test]
    fn resolves_new_file_parent_folder_inside_the_open_folder() {
        let root =
            std::env::temp_dir().join(format!("skribe-create-parent-test-{}", std::process::id()));
        let _ = fs::remove_dir_all(&root);
        fs::create_dir_all(root.join("drafts")).unwrap();
        let root = fs::canonicalize(root).unwrap();

        assert_eq!(
            create_file_parent_folder(&root, None).unwrap(),
            root.clone()
        );
        assert_eq!(
            create_file_parent_folder(
                &root,
                Some(root.join("drafts").to_string_lossy().to_string())
            )
            .unwrap(),
            root.join("drafts")
        );
        assert!(create_file_parent_folder(&root, Some("/tmp".to_string())).is_err());

        let _ = fs::remove_dir_all(root);
    }

    #[test]
    fn prepares_new_folder_names_in_the_open_folder_root() {
        let root = std::env::temp_dir().join(format!("skribe-folder-test-{}", std::process::id()));
        let _ = fs::remove_dir_all(&root);
        fs::create_dir_all(root.join("Untitled Folder")).unwrap();
        fs::create_dir_all(root.join("Untitled Folder 2")).unwrap();

        let safe_name = sanitize_folder_name("Untitled Folder").unwrap();
        let next_path = dedupe_folder_path(&root, &safe_name);

        assert_eq!(safe_name, "Untitled Folder");
        assert_eq!(next_path, root.join("Untitled Folder 3"));
        assert!(sanitize_folder_name("../notes").is_err());
        assert!(sanitize_folder_name(".drafts").is_err());
        assert!(sanitize_folder_name("vendor").is_err());
        assert!(sanitize_folder_name("LPT1").is_err());

        let _ = fs::remove_dir_all(root);
    }
}
