use crate::{error::AppError, models::AppSettings, settings};

#[tauri::command]
pub fn settings_load() -> Result<AppSettings, AppError> {
    settings::load_settings()
}

#[tauri::command]
pub fn settings_save(settings: AppSettings) -> Result<(), AppError> {
    settings::save_settings(&settings)
}

#[tauri::command]
pub fn settings_add_recent_folder(folder_path: String) -> Result<AppSettings, AppError> {
    settings::add_recent_folder(folder_path)
}
