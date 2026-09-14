mod watcher;

#[derive(serde::Serialize)]
struct FileContent {
    path: String,
    size: i32,
    hash: String,
    text_content: Option<String>,
    base64_content: Option<String>,
}

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

#[tauri::command]
async fn read_file_content(path: String) -> Result<FileContent, String> {
    use sha2::{Digest, Sha256};
    use std::fs;
    
    let bytes = fs::read(&path)
        .map_err(|e| format!("Impossible de lire {}: {}", path, e))?;
    
    let size = bytes.len();
    let hash = {
        let mut hasher = Sha256::new();
        hasher.update(&bytes);
        hex::encode(hasher.finalize())
    };
    
    // Détecter si c'est du texte ou du binaire
    let is_text = std::str::from_utf8(&bytes).is_ok() 
        && !path.ends_with(".jpg") 
        && !path.ends_with(".png")
        && !path.ends_with(".pdf");
    
    let (text_content, base64_content) = if is_text {
        (Some(String::from_utf8_lossy(&bytes).to_string()), None)
    } else {
        use base64::Engine;
        let b64 = base64::engine::general_purpose::STANDARD.encode(&bytes);
        (None, Some(b64))
    };
    
    Ok(FileContent {
        path,
        size: size as i32,
        hash,
        text_content,
        base64_content,
    })
}

#[tauri::command]
async fn write_file_content(path: String, content: String) -> Result<(), String> {
    use std::fs;
    use std::path::Path;
    
    if let Some(parent) = Path::new(&path).parent() {
        fs::create_dir_all(parent)
            .map_err(|e| format!("Impossible de créer {}: {}", parent.display(), e))?;
    }
    
    fs::write(&path, content)
        .map_err(|e| format!("Impossible d'écrire {}: {}", path, e))?;
    
    Ok(())
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
            read_file_content,
            write_file_content,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
