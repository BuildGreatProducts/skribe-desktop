use crate::{
    claude_path,
    error::AppError,
    models::{AcpStartResponse, PromptAttachment},
    state::{AcpProcess, AcpState},
};
use serde::{Deserialize, Serialize};
use serde_json::json;
use std::{
    fs,
    io::{BufRead, BufReader},
    path::PathBuf,
    process::{Command, Stdio},
    thread,
};
use tauri::{AppHandle, Emitter, Manager, State};
use uuid::Uuid;

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct SidecarEvent {
    #[serde(rename = "type")]
    event_type: String,
    session_id: Option<String>,
    status: Option<String>,
    delta: Option<String>,
    replace: Option<bool>,
    tool: Option<String>,
    args: Option<serde_json::Value>,
    question: Option<String>,
    options: Option<Vec<serde_json::Value>>,
    free_form: Option<bool>,
    error: Option<String>,
    code: Option<String>,
    version: Option<String>,
}

#[derive(Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DocumentReference {
    path: String,
    relative_path: String,
    name: String,
}

#[tauri::command]
pub fn acp_start(
    app: AppHandle,
    folder_path: String,
    state: State<AcpState>,
) -> Result<AcpStartResponse, AppError> {
    let folder = fs::canonicalize(&folder_path)?;
    if !folder.is_dir() {
        return Err(AppError::FsInvalidPath(
            "ACP folder is not a directory".into(),
        ));
    }

    let session_id = Uuid::new_v4().to_string();
    let binary = sidecar_binary_path()?;
    let mut command = Command::new(binary);
    command
        .current_dir(folder)
        .env("PATH", claude_path::path_env())
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped());

    if let Some(claude_binary) = claude_path::resolve_claude_binary() {
        command.env("CLAUDE_CODE_PATH", claude_binary);
    }

    let mut child = command
        .spawn()
        .map_err(|error| AppError::AcpSidecarFailed(error.to_string()))?;

    let stdin = child
        .stdin
        .take()
        .ok_or_else(|| AppError::AcpSidecarFailed("Could not open sidecar stdin".into()))?;
    let stdout = child
        .stdout
        .take()
        .ok_or_else(|| AppError::AcpSidecarFailed("Could not open sidecar stdout".into()))?;
    let stderr = child
        .stderr
        .take()
        .ok_or_else(|| AppError::AcpSidecarFailed("Could not open sidecar stderr".into()))?;

    spawn_stdout_relay(app.clone(), session_id.clone(), stdout);
    spawn_stderr_drain(stderr);

    let mut process = AcpProcess { child, stdin };
    process
        .write_json(&json!({ "type": "version", "sessionId": session_id }))
        .map_err(|error| AppError::AcpSidecarFailed(error.to_string()))?;

    state
        .sessions
        .lock()
        .map_err(|_| AppError::internal("ACP state poisoned"))?
        .insert(session_id.clone(), process);

    app.emit(
        "acp:status",
        json!({ "sessionId": session_id, "status": "ready" }),
    )
    .map_err(|error| AppError::internal(error.to_string()))?;

    Ok(AcpStartResponse { session_id })
}

#[tauri::command]
pub fn acp_send_prompt(
    session_id: String,
    prompt: String,
    active_file_path: String,
    system_prompt: Option<String>,
    selected_text: Option<String>,
    document_references: Option<Vec<DocumentReference>>,
    attachments: Option<Vec<PromptAttachment>>,
    dangerously_skip_permissions: Option<bool>,
    state: State<AcpState>,
) -> Result<(), AppError> {
    let mut sessions = state
        .sessions
        .lock()
        .map_err(|_| AppError::internal("ACP state poisoned"))?;
    let session = sessions
        .get_mut(&session_id)
        .ok_or_else(|| AppError::AcpSidecarFailed("ACP session not found".into()))?;
    let attachments = attachments
        .unwrap_or_default()
        .into_iter()
        .map(|attachment| {
            json!({
                "path": attachment.path,
                "name": attachment.name,
                "size": attachment.size,
                "kind": attachment.kind,
                "mimeType": attachment.mime_type
            })
        })
        .collect::<Vec<_>>();
    session
        .write_json(&json!({
            "type": "prompt",
            "sessionId": session_id,
            "prompt": prompt,
            "activeFilePath": active_file_path,
            "systemPrompt": system_prompt,
            "selectedText": selected_text,
            "documentReferences": document_references.unwrap_or_default(),
            "attachments": attachments,
            "dangerouslySkipPermissions": dangerously_skip_permissions.unwrap_or(false)
        }))
        .map_err(|error| AppError::AcpSidecarFailed(error.to_string()))
}

#[tauri::command]
pub fn acp_respond_clarification(
    session_id: String,
    option_id: Option<String>,
    response: Option<String>,
    state: State<AcpState>,
) -> Result<(), AppError> {
    let mut sessions = state
        .sessions
        .lock()
        .map_err(|_| AppError::internal("ACP state poisoned"))?;
    let session = sessions
        .get_mut(&session_id)
        .ok_or_else(|| AppError::AcpSidecarFailed("ACP session not found".into()))?;
    session
        .write_json(&json!({
            "type": "clarification",
            "sessionId": session_id,
            "optionId": option_id,
            "response": response
        }))
        .map_err(|error| AppError::AcpSidecarFailed(error.to_string()))
}

#[tauri::command]
pub fn acp_cancel(session_id: String, state: State<AcpState>) -> Result<(), AppError> {
    let mut sessions = state
        .sessions
        .lock()
        .map_err(|_| AppError::internal("ACP state poisoned"))?;
    let session = sessions
        .get_mut(&session_id)
        .ok_or_else(|| AppError::AcpSidecarFailed("ACP session not found".into()))?;
    session
        .write_json(&json!({ "type": "cancel", "sessionId": session_id }))
        .map_err(|error| AppError::AcpSidecarFailed(error.to_string()))
}

#[tauri::command]
pub fn acp_stop(session_id: String, state: State<AcpState>) -> Result<(), AppError> {
    let mut sessions = state
        .sessions
        .lock()
        .map_err(|_| AppError::internal("ACP state poisoned"))?;
    if let Some(mut session) = sessions.remove(&session_id) {
        let _ = session.child.kill();
    }
    Ok(())
}

fn spawn_stdout_relay(app: AppHandle, session_id: String, stdout: std::process::ChildStdout) {
    thread::spawn(move || {
        let reader = BufReader::new(stdout);
        for line in reader.lines().map_while(Result::ok) {
            if line.trim().is_empty() {
                continue;
            }
            match serde_json::from_str::<SidecarEvent>(&line) {
                Ok(event) => relay_event(&app, event),
                Err(_) => {
                    let _ = app.emit(
                        "acp:complete",
                        json!({
                            "sessionId": "unknown",
                            "status": "error",
                            "code": "ACP_PROTOCOL_ERROR",
                            "error": line
                        }),
                    );
                }
            }
        }
        mark_session_crashed(&app, &session_id);
    });
}

fn mark_session_crashed(app: &AppHandle, session_id: &str) {
    let removed = app
        .state::<AcpState>()
        .sessions
        .lock()
        .ok()
        .and_then(|mut sessions| sessions.remove(session_id));

    if let Some(mut process) = removed {
        let _ = process.child.kill();
        let _ = app.emit(
            "acp:status",
            json!({ "sessionId": session_id, "status": "crashed" }),
        );
    }
}

fn spawn_stderr_drain(stderr: std::process::ChildStderr) {
    thread::spawn(move || {
        let reader = BufReader::new(stderr);
        for line in reader.lines().map_while(Result::ok) {
            if !line.trim().is_empty() {
                eprintln!("ACP sidecar stderr: {line}");
            }
        }
    });
}

fn relay_event(app: &AppHandle, event: SidecarEvent) {
    let session_id = event.session_id.unwrap_or_else(|| "unknown".into());
    match event.event_type.as_str() {
        "status" => {
            let _ = app.emit(
                "acp:status",
                json!({ "sessionId": session_id, "status": event.status.unwrap_or_else(|| "ready".into()) }),
            );
        }
        "text_delta" => {
            let _ = app.emit(
                "acp:text_delta",
                json!({
                    "sessionId": session_id,
                    "delta": event.delta.unwrap_or_default(),
                    "replace": event.replace.unwrap_or(false)
                }),
            );
        }
        "tool_call" => {
            let _ = app.emit(
                "acp:tool_call",
                json!({
                    "sessionId": session_id,
                    "tool": event.tool.unwrap_or_else(|| "tool".into()),
                    "args": event.args.unwrap_or_else(|| json!({}))
                }),
            );
        }
        "user_input_required" => {
            let _ = app.emit(
                "acp:user_input_required",
                json!({
                    "sessionId": session_id,
                    "question": event.question.unwrap_or_default(),
                    "options": event.options.unwrap_or_default(),
                    "freeForm": event.free_form.unwrap_or(false)
                }),
            );
        }
        "complete" => {
            let _ = app.emit(
                "acp:complete",
                json!({
                    "sessionId": session_id,
                    "status": event.status.unwrap_or_else(|| "ok".into()),
                    "code": event.code,
                    "error": event.error
                }),
            );
        }
        "version" => {
            if let Some(version) = event.version {
                if semver_lt(&version, "0.31.2") {
                    let _ = app.emit(
                        "acp:complete",
                        json!({
                            "sessionId": session_id,
                            "status": "error",
                            "code": "ACP_PROTOCOL_ERROR",
                            "error": format!("ACP package version {version} is below the required 0.31.2")
                        }),
                    );
                }
            }
        }
        _ => {}
    }
}

fn sidecar_binary_path() -> Result<PathBuf, AppError> {
    if let Ok(current_exe) = std::env::current_exe() {
        if let Some(exe_dir) = current_exe.parent() {
            for name in sidecar_binary_names() {
                let candidate = exe_dir.join(name);
                if candidate.exists() {
                    return Ok(candidate);
                }
            }
        }
    }

    let manifest_dir = PathBuf::from(env!("CARGO_MANIFEST_DIR"));
    for name in sidecar_binary_names() {
        let candidate = manifest_dir.join("binaries").join(name);
        if candidate.exists() {
            return Ok(candidate);
        }
    }

    Err(AppError::AcpSidecarFailed(
        "ACP sidecar binary has not been prepared. Run npm run sidecar:prepare.".into(),
    ))
}

fn sidecar_binary_names() -> [&'static str; 2] {
    [target_sidecar_name(), "acp-sidecar"]
}

fn target_sidecar_name() -> &'static str {
    #[cfg(all(target_os = "macos", target_arch = "aarch64"))]
    {
        "acp-sidecar-aarch64-apple-darwin"
    }

    #[cfg(all(target_os = "macos", target_arch = "x86_64"))]
    {
        "acp-sidecar-x86_64-apple-darwin"
    }

    #[cfg(not(any(
        all(target_os = "macos", target_arch = "aarch64"),
        all(target_os = "macos", target_arch = "x86_64")
    )))]
    {
        "acp-sidecar"
    }
}

fn semver_lt(actual: &str, minimum: &str) -> bool {
    let parse = |value: &str| {
        value
            .split('.')
            .take(3)
            .map(|part| part.parse::<u64>().unwrap_or(0))
            .collect::<Vec<_>>()
    };
    let actual = parse(actual);
    let minimum = parse(minimum);
    for index in 0..3 {
        let left = *actual.get(index).unwrap_or(&0);
        let right = *minimum.get(index).unwrap_or(&0);
        if left != right {
            return left < right;
        }
    }
    false
}

#[cfg(test)]
mod tests {
    use super::semver_lt;

    #[test]
    fn compares_semver_floor() {
        assert!(semver_lt("0.31.1", "0.31.2"));
        assert!(!semver_lt("0.31.2", "0.31.2"));
        assert!(!semver_lt("0.32.0", "0.31.2"));
    }
}
