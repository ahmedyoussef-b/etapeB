mod watcher;

#[tauri::command]
fn start_file_watcher(app: tauri::AppHandle, path: String) -> Result<(), String> {
    let path_buf = std::path::PathBuf::from(&path);
    if !path_buf.exists() {
        return Err(format!("Le dossier {} n'existe pas", path));
    }
    watcher::start_watching(app, path_buf)
}

#[tauri::command]
fn get_resource_path() -> String {
    // Retourne le chemin du .data/ embarqué
    // (sera utilisé plus tard)
    std::env::current_dir()
        .map(|p| p.join(".data").to_string_lossy().to_string())
        .unwrap_or_else(|_| ".data".to_string())
}

#[tauri::command]
fn get_user_data_path() -> String {
    // Retourne %APPDATA%/NexaFlow/
    #[cfg(target_os = "windows")]
    {
        if let Ok(appdata) = std::env::var("APPDATA") {
            return format!("{}\\NexaFlow", appdata);
        }
    }
    ".".to_string()
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .setup(|app| {
            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
            }
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            start_file_watcher,
            get_resource_path,
            get_user_data_path,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
