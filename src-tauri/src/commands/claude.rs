use crate::{claude_path, error::AppError, models::ClaudePreflight, state::PreflightState};
use std::{
    process::Command,
    sync::MutexGuard,
    time::{SystemTime, UNIX_EPOCH},
};
use tauri::State;

#[tauri::command]
pub fn claude_preflight(
    state: State<PreflightState>,
    force: Option<bool>,
) -> Result<ClaudePreflight, AppError> {
    let mut cached = state
        .result
        .lock()
        .map_err(|_| AppError::internal("Preflight state poisoned"))?;

    if force.unwrap_or(false) {
        cached.take();
    }

    if let Some(result) = cached.as_ref() {
        return Ok(result.clone());
    }

    let result = run_preflight(&mut cached)?;
    Ok(result)
}

fn run_preflight(
    cached: &mut MutexGuard<'_, Option<ClaudePreflight>>,
) -> Result<ClaudePreflight, AppError> {
    let Some(claude_binary) = claude_path::resolve_claude_binary() else {
        let result = ClaudePreflight {
            installed: false,
            version: None,
            logged_in: false,
        };
        cached.replace(result.clone());
        return Ok(result);
    };

    let version = Command::new(claude_binary)
        .arg("--version")
        .env("PATH", claude_path::path_env())
        .output()
        .ok()
        .filter(|output| output.status.success())
        .map(|output| String::from_utf8_lossy(&output.stdout).trim().to_string())
        .filter(|version| !version.is_empty());

    let result = ClaudePreflight {
        installed: true,
        version,
        // Claude Code does not expose a cheap stable login probe. The first request surfaces auth errors.
        logged_in: true,
    };
    cached.replace(result.clone());
    Ok(result)
}

#[allow(dead_code)]
fn now_ms() -> u128 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis()
}
