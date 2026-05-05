use crate::{error::AppError, models::AppSettings};
use chrono::Utc;
use std::{
    fs,
    path::{Path, PathBuf},
};

pub fn settings_dir() -> Result<PathBuf, AppError> {
    dirs::data_dir()
        .map(|dir| dir.join("Skribe"))
        .ok_or_else(|| AppError::Internal("Could not resolve application support directory".into()))
}

pub fn settings_path() -> Result<PathBuf, AppError> {
    Ok(settings_dir()?.join("settings.json"))
}

pub fn load_settings() -> Result<AppSettings, AppError> {
    let path = settings_path()?;
    if !path.exists() {
        return Ok(AppSettings::default());
    }

    let content = fs::read_to_string(&path)?;
    match serde_json::from_str::<AppSettings>(&content) {
        Ok(settings) if settings.schema_version == 1 => Ok(settings),
        Ok(_) => {
            archive_bad_settings(&path)?;
            Ok(AppSettings::default())
        }
        Err(_) => {
            archive_bad_settings(&path)?;
            Ok(AppSettings::default())
        }
    }
}

pub fn save_settings(settings: &AppSettings) -> Result<(), AppError> {
    let dir = settings_dir()?;
    fs::create_dir_all(&dir)?;
    let path = settings_path()?;
    let tmp = path.with_extension("json.tmp");
    let content = serde_json::to_string_pretty(settings)?;
    fs::write(&tmp, content)?;
    fs::rename(tmp, path)?;
    Ok(())
}

fn archive_bad_settings(path: &Path) -> Result<(), AppError> {
    if !path.exists() {
        return Ok(());
    }
    let stamp = Utc::now().format("%Y%m%d%H%M%S");
    let backup = path.with_file_name(format!("settings.json.bak.{stamp}"));
    fs::rename(path, backup)?;
    Ok(())
}

pub fn add_recent_folder(folder_path: String) -> Result<AppSettings, AppError> {
    let mut settings = load_settings()?;
    settings
        .recent_folders
        .retain(|folder| folder != &folder_path);
    settings.recent_folders.insert(0, folder_path.clone());
    settings.recent_folders.truncate(10);
    settings.last_opened_folder = Some(folder_path);
    save_settings(&settings)?;
    Ok(settings)
}
