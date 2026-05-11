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

#[cfg(windows)]
const PATH_ENTRY_SEPARATOR: char = ';';
#[cfg(not(windows))]
const PATH_ENTRY_SEPARATOR: char = ':';

pub fn resolve_claude_binary() -> Option<PathBuf> {
    env::var_os("CLAUDE_CODE_PATH")
        .map(PathBuf::from)
        .filter(|path| is_executable(path))
        .or_else(|| find_on_path("claude"))
}

pub fn path_env() -> OsString {
    let entries = candidate_path_entries();
    let filtered_entries = valid_path_env_entries(entries);
    env::join_paths(&filtered_entries).unwrap_or_else(|error| {
        eprintln!("Could not build PATH for Claude lookup: {error}");
        env::var_os("PATH").unwrap_or_default()
    })
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
    bins.sort_by(
        |left, right| match (node_version(left), node_version(right)) {
            (Some(left), Some(right)) => left.cmp(&right),
            _ => left.cmp(right),
        },
    );
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
        path.extension()
            .and_then(|extension| extension.to_str())
            .map(|extension| {
                matches!(
                    extension.to_ascii_lowercase().as_str(),
                    "exe" | "cmd" | "bat"
                )
            })
            .unwrap_or(false)
    }
}

fn valid_path_env_entries(entries: Vec<PathBuf>) -> Vec<PathBuf> {
    entries
        .into_iter()
        .filter(|entry| {
            let Some(value) = entry.to_str() else {
                eprintln!("Skipping non-UTF-8 PATH entry for Claude lookup: {entry:?}");
                return false;
            };
            if value.contains(PATH_ENTRY_SEPARATOR) {
                eprintln!("Skipping PATH entry containing separator for Claude lookup: {value}");
                return false;
            }
            true
        })
        .collect()
}

fn node_version(bin: &Path) -> Option<(u64, u64, u64)> {
    let version = bin.parent()?.file_name()?.to_str()?.trim_start_matches('v');
    let mut parts = version.split('.');
    Some((
        parse_version_part(parts.next()?)?,
        parts.next().and_then(parse_version_part).unwrap_or(0),
        parts.next().and_then(parse_version_part).unwrap_or(0),
    ))
}

fn parse_version_part(part: &str) -> Option<u64> {
    part.split(|character: char| !character.is_ascii_digit())
        .next()
        .filter(|digits| !digits.is_empty())?
        .parse()
        .ok()
}

#[cfg(test)]
mod tests {
    use super::{node_version, valid_path_env_entries, PATH_ENTRY_SEPARATOR};
    use std::path::PathBuf;

    #[test]
    fn parses_nvm_node_version_from_bin_path() {
        assert_eq!(
            node_version(&PathBuf::from("/tmp/.nvm/versions/node/v20.11.1/bin")),
            Some((20, 11, 1)),
        );
        assert_eq!(
            node_version(&PathBuf::from("/tmp/.nvm/versions/node/v9.10.0/bin")),
            Some((9, 10, 0)),
        );
    }

    #[test]
    fn filters_path_entries_that_cannot_be_joined() {
        let entries = valid_path_env_entries(vec![
            PathBuf::from("/tmp/bin"),
            PathBuf::from(format!("/tmp/bad{PATH_ENTRY_SEPARATOR}entry")),
        ]);

        assert_eq!(entries, vec![PathBuf::from("/tmp/bin")]);
    }
}
