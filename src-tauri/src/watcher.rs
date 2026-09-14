use notify_debouncer_mini::new_debouncer;
use std::path::PathBuf;
use std::sync::mpsc::channel;
use std::time::Duration;
use tauri::{AppHandle, Emitter};

pub fn start_watching(app_handle: AppHandle, path: PathBuf) -> Result<(), String> {
    let (tx, rx) = channel();
    
    let mut debouncer = new_debouncer(Duration::from_secs(5), tx)
        .map_err(|e| format!("Failed to create debouncer: {}", e))?;
    
    debouncer
        .watcher()
        .watch(&path, notify::RecursiveMode::Recursive)
        .map_err(|e| format!("Failed to watch: {}", e))?;
    
    // Thread qui écoute les événements
    std::thread::spawn(move || {
        for result in rx {
            match result {
                Ok(events) => {
                    let paths: Vec<String> = events
                        .iter()
                        .map(|e| e.path.to_string_lossy().to_string())
                        .collect();
                    
                    if !paths.is_empty() {
                        println!("[watcher] {} fichiers modifiés", paths.len());
                        let _ = app_handle.emit("files-changed", paths);
                    }
                }
                Err(e) => {
                    eprintln!("[watcher] erreur: {:?}", e);
                }
            }
        }
    });
    
    // Garder le debouncer en vie (le déplacer dans un thread qui dort)
    std::mem::forget(debouncer);
    
    Ok(())
}
