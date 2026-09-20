use notify::{RecommendedWatcher, RecursiveMode};
use notify_debouncer_mini::{new_debouncer, Debouncer};
use std::path::PathBuf;
use std::sync::mpsc::channel;
use std::sync::Mutex;
use std::time::Duration;
use tauri::{AppHandle, Emitter, Manager};

/// State Tauri pour stocker le debouncer et permettre son arrêt.
pub struct WatcherState(pub Mutex<Option<Debouncer<RecommendedWatcher>>>);

impl WatcherState {
    pub fn new() -> Self {
        WatcherState(Mutex::new(None))
    }
}

pub fn start_watching(app_handle: AppHandle, path: PathBuf) -> Result<(), String> {
    let (tx, rx) = channel();

    let debouncer = new_debouncer(Duration::from_secs(5), tx)
        .map_err(|e| format!("Failed to create debouncer: {}", e))?;

    // Stocker le debouncer dans le State
    {
        let state = app_handle.state::<WatcherState>();
        let mut guard = state.0.lock().map_err(|e| format!("Lock error: {}", e))?;
        *guard = Some(debouncer);
    }

    // Accéder au debouncer stocké pour lancer le watch
    {
        let state = app_handle.state::<WatcherState>();
        let mut guard = state.0.lock().map_err(|e| format!("Lock error: {}", e))?;
        if let Some(deb) = guard.as_mut() {
            deb.watcher()
                .watch(&path, RecursiveMode::Recursive)
                .map_err(|e| format!("Failed to watch: {}", e))?;
        } else {
            return Err("Debouncer non initialisé".to_string());
        }
    }

    // Thread qui écoute les événements
    let app_handle_for_thread = app_handle.clone();
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
                        let _ = app_handle_for_thread.emit("files-changed", paths);
                    }
                }
                Err(e) => {
                    eprintln!("[watcher] erreur: {:?}", e);
                }
            }
        }
        println!("[watcher] thread terminé proprement");
    });

    Ok(())
}

/// Arrête le watcher en droppant le debouncer stocké.
/// Le drop ferme le channel, ce qui termine le thread rx.
pub fn stop_watching(app_handle: &AppHandle) -> Result<(), String> {
    let state = app_handle.state::<WatcherState>();
    let mut guard = state.0.lock().map_err(|e| format!("Lock error: {}", e))?;

    if guard.take().is_some() {
        println!("[watcher] arrêté proprement");
    }

    Ok(())
}