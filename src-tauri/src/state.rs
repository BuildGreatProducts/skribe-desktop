use crate::models::ClaudePreflight;
use notify::RecommendedWatcher;
use std::{
    collections::HashMap,
    io::Write,
    path::PathBuf,
    process::{Child, ChildStdin},
    sync::Mutex,
};

pub struct WatcherState {
    pub watcher: Mutex<Option<RecommendedWatcher>>,
    pub open_folder: Mutex<Option<PathBuf>>,
}

impl Default for WatcherState {
    fn default() -> Self {
        Self {
            watcher: Mutex::new(None),
            open_folder: Mutex::new(None),
        }
    }
}

#[derive(Default)]
pub struct PreflightState {
    pub result: Mutex<Option<ClaudePreflight>>,
}

pub struct AcpProcess {
    pub child: Child,
    pub stdin: ChildStdin,
}

impl AcpProcess {
    pub fn write_json(&mut self, payload: &serde_json::Value) -> std::io::Result<()> {
        writeln!(self.stdin, "{payload}")?;
        self.stdin.flush()
    }
}

pub struct AcpState {
    pub sessions: Mutex<HashMap<String, AcpProcess>>,
}

impl Default for AcpState {
    fn default() -> Self {
        Self {
            sessions: Mutex::new(HashMap::new()),
        }
    }
}
