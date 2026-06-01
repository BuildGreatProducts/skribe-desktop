use crate::{
    claude_path,
    error::AppError,
    models::{AgentId, AgentPreflight},
    state::PreflightState,
};
use std::{
    collections::HashMap,
    process::Command,
    sync::MutexGuard,
    time::{SystemTime, UNIX_EPOCH},
};
use tauri::State;

#[tauri::command]
pub fn claude_preflight(
    state: State<PreflightState>,
    force: Option<bool>,
) -> Result<AgentPreflight, AppError> {
    agent_preflight("claude".to_string(), state, force)
}

#[tauri::command]
pub fn agent_preflight(
    agent_id: String,
    state: State<PreflightState>,
    force: Option<bool>,
) -> Result<AgentPreflight, AppError> {
    let agent_id = normalize_agent_id(&agent_id)?;
    let mut cached = state
        .result
        .lock()
        .map_err(|_| AppError::internal("Preflight state poisoned"))?;

    if force.unwrap_or(false) {
        cached.remove(&agent_id);
    }

    if let Some(result) = cached.get(&agent_id) {
        return Ok(result.clone());
    }

    let result = run_preflight(&agent_id, &mut cached)?;
    Ok(result)
}

fn run_preflight(
    agent_id: &str,
    cached: &mut MutexGuard<'_, HashMap<String, AgentPreflight>>,
) -> Result<AgentPreflight, AppError> {
    let result = match agent_id {
        "claude" => run_claude_preflight(),
        "codex" => run_codex_preflight(),
        _ => return Err(AppError::SettingsInvalid("Unsupported AI agent".into())),
    };
    cached.insert(agent_id.to_string(), result.clone());
    Ok(result)
}

fn run_claude_preflight() -> AgentPreflight {
    let Some(claude_binary) = claude_path::resolve_claude_binary() else {
        return AgentPreflight {
            agent_id: AgentId::Claude,
            installed: false,
            version: None,
            logged_in: false,
        };
    };

    let version = Command::new(claude_binary)
        .arg("--version")
        .env("PATH", claude_path::path_env())
        .output()
        .ok()
        .filter(|output| output.status.success())
        .map(|output| String::from_utf8_lossy(&output.stdout).trim().to_string())
        .filter(|version| !version.is_empty());

    AgentPreflight {
        agent_id: AgentId::Claude,
        installed: true,
        version,
        // Claude Code does not expose a cheap stable login probe. The first request surfaces auth errors.
        logged_in: true,
    }
}

fn run_codex_preflight() -> AgentPreflight {
    let Some(codex_binary) = claude_path::resolve_codex_acp_binary() else {
        return AgentPreflight {
            agent_id: AgentId::Codex,
            installed: false,
            version: None,
            logged_in: false,
        };
    };

    let version = Command::new(codex_binary)
        .arg("--version")
        .env("PATH", claude_path::path_env())
        .output()
        .ok()
        .filter(|output| output.status.success())
        .map(|output| {
            let stdout = String::from_utf8_lossy(&output.stdout).trim().to_string();
            if stdout.is_empty() {
                String::from_utf8_lossy(&output.stderr).trim().to_string()
            } else {
                stdout
            }
        })
        .filter(|version| !version.is_empty());

    AgentPreflight {
        agent_id: AgentId::Codex,
        installed: true,
        version,
        // Codex ACP supports multiple auth methods; the first request reports missing auth.
        logged_in: true,
    }
}

fn normalize_agent_id(agent_id: &str) -> Result<String, AppError> {
    match agent_id {
        "claude" | "codex" => Ok(agent_id.to_string()),
        _ => Err(AppError::SettingsInvalid("Unsupported AI agent".into())),
    }
}

#[allow(dead_code)]
fn now_ms() -> u128 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis()
}
