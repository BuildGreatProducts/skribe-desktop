use serde::Serialize;
use thiserror::Error;

#[allow(dead_code)]
#[derive(Debug, Error, Serialize)]
#[serde(tag = "code", content = "message")]
pub enum AppError {
    #[serde(rename = "FS_PERMISSION_DENIED")]
    #[error("{0}")]
    FsPermissionDenied(String),
    #[serde(rename = "FS_NOT_FOUND")]
    #[error("{0}")]
    FsNotFound(String),
    #[serde(rename = "FS_INVALID_PATH")]
    #[error("{0}")]
    FsInvalidPath(String),
    #[serde(rename = "CLAUDE_NOT_INSTALLED")]
    #[error("{0}")]
    ClaudeNotInstalled(String),
    #[serde(rename = "CLAUDE_NOT_LOGGED_IN")]
    #[error("{0}")]
    ClaudeNotLoggedIn(String),
    #[serde(rename = "ACP_SIDECAR_FAILED")]
    #[error("{0}")]
    AcpSidecarFailed(String),
    #[serde(rename = "ACP_PROTOCOL_ERROR")]
    #[error("{0}")]
    AcpProtocolError(String),
    #[serde(rename = "SETTINGS_INVALID")]
    #[error("{0}")]
    SettingsInvalid(String),
    #[serde(rename = "INTERNAL")]
    #[error("{0}")]
    Internal(String),
}

impl AppError {
    pub fn internal(error: impl ToString) -> Self {
        Self::Internal(error.to_string())
    }
}

impl From<std::io::Error> for AppError {
    fn from(error: std::io::Error) -> Self {
        match error.kind() {
            std::io::ErrorKind::NotFound => Self::FsNotFound(error.to_string()),
            std::io::ErrorKind::PermissionDenied => Self::FsPermissionDenied(error.to_string()),
            _ => Self::Internal(error.to_string()),
        }
    }
}

impl From<serde_json::Error> for AppError {
    fn from(error: serde_json::Error) -> Self {
        Self::SettingsInvalid(error.to_string())
    }
}

impl From<notify::Error> for AppError {
    fn from(error: notify::Error) -> Self {
        Self::Internal(error.to_string())
    }
}
