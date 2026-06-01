use crate::error::AppError;

#[cfg(target_os = "macos")]
use std::{io::Write, process::Command};

#[cfg(target_os = "macos")]
use std::os::unix::fs::PermissionsExt;

#[tauri::command]
pub fn codex_acp_open_installer() -> Result<(), AppError> {
    #[cfg(target_os = "macos")]
    {
        open_codex_acp_installer_macos()
    }

    #[cfg(not(target_os = "macos"))]
    {
        Err(AppError::SettingsInvalid(
            "Codex ACP installer is only available on macOS.".into(),
        ))
    }
}

#[cfg(target_os = "macos")]
fn open_codex_acp_installer_macos() -> Result<(), AppError> {
    let mut script = tempfile::Builder::new()
        .prefix("skribe-install-codex-acp-")
        .suffix(".command")
        .tempfile()
        .map_err(|error| AppError::internal(format!("Could not create installer: {error}")))?;
    script.write_all(codex_acp_install_script().as_bytes())?;

    #[cfg(unix)]
    {
        let mut permissions = script.as_file().metadata()?.permissions();
        permissions.set_mode(0o755);
        script.as_file().set_permissions(permissions)?;
    }

    let script_path = script
        .into_temp_path()
        .keep()
        .map_err(|error| AppError::internal(format!("Could not prepare installer: {error}")))?;

    Command::new("/usr/bin/open")
        .arg(&script_path)
        .spawn()
        .map_err(|error| AppError::internal(format!("Could not open Terminal: {error}")))?;

    Ok(())
}

#[cfg(target_os = "macos")]
fn codex_acp_install_script() -> &'static str {
    r#"#!/bin/zsh
set -u

echo "Installing Codex ACP for Skribe..."
echo

if ! command -v npm >/dev/null 2>&1; then
  echo "npm was not found."
  echo "Install Node.js first, then return to Skribe and try again:"
  echo "https://nodejs.org/"
  echo
  printf "Press Return to close this window..."
  read -r _
  exit 1
fi

install_status=0
npm install -g @zed-industries/codex-acp || install_status=$?

GLOBAL_BIN="$(npm prefix -g 2>/dev/null)/bin"
export PATH="$GLOBAL_BIN:$PATH"

echo
if [ "$install_status" -ne 0 ]; then
  echo "Installation failed with exit code $install_status."
  echo "See npm output above."
  echo
fi

if command -v codex-acp >/dev/null 2>&1; then
  echo "Codex ACP installed:"
  codex-acp --version
else
  echo "Codex ACP installed, but codex-acp was not found on PATH."
  echo "Add this directory to PATH, then restart Skribe and verify again:"
  echo "$GLOBAL_BIN"
fi

echo
echo "Return to Skribe and click Verify installation."
printf "Press Return to close this window..."
read -r _
"#
}

#[cfg(test)]
mod tests {
    #[cfg(target_os = "macos")]
    #[test]
    fn codex_installer_uses_acp_package() {
        let script = super::codex_acp_install_script();

        assert!(script.contains("npm install -g @zed-industries/codex-acp"));
        assert!(script.contains("Installation failed with exit code $install_status."));
        assert!(script.contains("codex-acp --version"));
        assert!(!script.contains("@openai/codex"));
    }
}
