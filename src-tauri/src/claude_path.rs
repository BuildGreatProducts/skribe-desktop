use std::{
    collections::HashSet,
    env,
    ffi::OsString,
    fs,
    path::{Path, PathBuf},
};

#[cfg(unix)]
use std::os::unix::fs::PermissionsExt;

const SYSTEM_PATHS: &[&str] = &[
    "/opt/homebrew/bin",
    "/opt/homebrew/sbin",
    "/usr/local/bin",
    "/usr/local/sbin",
    "/usr/bin",
    "/bin",
    "/usr/sbin",
    "/sbin",
];

pub fn resolve_claude_binary() -> Option<PathBuf> {
    env::var_os("CLAUDE_CODE_PATH")
        .map(PathBuf::from)
        .filter(|path| is_executable(path))
        .or_else(|| find_on_path("claude"))
}

pub fn path_env() -> OsString {
    let entries = candidate_path_entries();
    env::join_paths(entries).unwrap_or_else(|_| env::var_os("PATH").unwrap_or_default())
}

fn find_on_path(binary: &str) -> Option<PathBuf> {
    candidate_path_entries()
        .into_iter()
        .map(|dir| dir.join(binary))
        .find(|path| is_executable(path))
}

fn candidate_path_entries() -> Vec<PathBuf> {
    let mut entries = Vec::new();
    let mut seen = HashSet::new();

    if let Some(path) = env::var_os("PATH") {
        for entry in env::split_paths(&path) {
            add_path(&mut entries, &mut seen, entry);
        }
    }

    if let Some(home) = dirs::home_dir() {
        for relative in [
            ".local/bin",
            ".npm-global/bin",
            ".bun/bin",
            ".cargo/bin",
            ".volta/bin",
            ".asdf/shims",
            ".nodenv/shims",
            "bin",
        ] {
            add_path(&mut entries, &mut seen, home.join(relative));
        }

        add_nvm_node_bins(&mut entries, &mut seen, &home);
    }

    for path in SYSTEM_PATHS {
        add_path(&mut entries, &mut seen, PathBuf::from(path));
    }

    entries
}

fn add_nvm_node_bins(entries: &mut Vec<PathBuf>, seen: &mut HashSet<String>, home: &Path) {
    let versions = home.join(".nvm/versions/node");
    let Ok(children) = fs::read_dir(versions) else {
        return;
    };

    let mut bins = children
        .filter_map(Result::ok)
        .map(|entry| entry.path().join("bin"))
        .collect::<Vec<_>>();
    bins.sort();
    bins.reverse();

    for bin in bins {
        add_path(entries, seen, bin);
    }
}

fn add_path(entries: &mut Vec<PathBuf>, seen: &mut HashSet<String>, path: PathBuf) {
    let key = path.to_string_lossy().to_string();
    if seen.insert(key) {
        entries.push(path);
    }
}

fn is_executable(path: &Path) -> bool {
    let Ok(metadata) = fs::metadata(path) else {
        return false;
    };
    if !metadata.is_file() {
        return false;
    }

    #[cfg(unix)]
    {
        metadata.permissions().mode() & 0o111 != 0
    }

    #[cfg(not(unix))]
    {
        true
    }
}
