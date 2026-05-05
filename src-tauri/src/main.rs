#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod claude_path;
mod commands;
mod error;
mod models;
mod settings;
mod state;

use commands::{acp, claude, fs, settings as settings_commands};
use state::{AcpState, PreflightState, WatcherState};

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .manage(WatcherState::default())
        .manage(PreflightState::default())
        .manage(AcpState::default())
        .setup(|_| {
            std::panic::set_hook(Box::new(|info| {
                if let Some(dir) = dirs::data_dir().map(|dir| dir.join("Skribe").join("crashes")) {
                    let _ = std::fs::create_dir_all(&dir);
                    let path = dir.join(format!(
                        "crash-{}.log",
                        chrono::Utc::now().format("%Y%m%d%H%M%S")
                    ));
                    let _ = std::fs::write(path, info.to_string());
                }
            }));
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            fs::fs_pick_folder,
            fs::fs_list_markdown_files,
            fs::fs_read_file,
            fs::fs_write_file,
            fs::fs_create_file,
            fs::fs_rename_file,
            fs::fs_delete_file,
            fs::fs_watch_folder,
            fs::fs_unwatch_folder,
            settings_commands::settings_load,
            settings_commands::settings_save,
            settings_commands::settings_add_recent_folder,
            claude::claude_preflight,
            acp::acp_start,
            acp::acp_send_prompt,
            acp::acp_respond_clarification,
            acp::acp_cancel,
            acp::acp_stop
        ])
        .run(tauri::generate_context!())
        .expect("error while running Skribe");
}
