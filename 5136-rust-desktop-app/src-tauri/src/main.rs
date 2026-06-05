#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod batch;
mod commands;
mod convert;
mod exif_handler;
mod path_utils;
mod resize;
mod watermark;

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .manage(commands::CancellationState::default())
        .invoke_handler(tauri::generate_handler![
            commands::batch_resize,
            commands::batch_convert,
            commands::batch_watermark,
            commands::read_exif_batch,
            commands::export_exif_csv,
            commands::batch_clear_exif,
            commands::cancel_task,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
