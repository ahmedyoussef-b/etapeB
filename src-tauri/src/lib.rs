mod auto_vectorizer;
mod embeddings;
mod vectorizer;
mod vectorizer_tree;
mod watcher;
mod groq_stream;
mod config;
mod auth;
mod structure;
mod sync;
mod api_commands;
pub use config::{read_config, write_config, delete_config};
pub use auth::{login, logout, get_session};

use auto_vectorizer::{VectorizationConsistencyReport, VectorizationStats};
use crate::structure::{resolve_repository_path, resolve_data_path};
use std::path::{Path, PathBuf};
use tauri::Emitter;
use walkdir::WalkDir;
use tauri::Manager;
use crate::vectorizer::{LocalChromaStore, SearchResult};
use crate::watcher::WatcherState;

#[derive(serde::Serialize, serde::Deserialize, Clone, Debug)]
pub struct RagAnswer {
    pub answer: String,
    pub sources: Vec<SearchResult>,
}

#[derive(serde::Serialize)]
struct FileContent {
    success: bool,
    kind: String,
    content: String,
    #[serde(rename = "mimeType")]
    mime_type: String,
    path: String,
    size: i32,
    hash: String,
    #[serde(rename = "textContent")]
    text_content: Option<String>,
    #[serde(rename = "base64Content")]
    base64_content: Option<String>,
}

#[tauri::command]
fn start_file_watcher(app: tauri::AppHandle, path: String) -> Result<(), String> {
    let path_buf = PathBuf::from(&path);
    if !path_buf.exists() {
        return Err(format!("Le dossier {} n'existe pas", path));
    }
    watcher::start_watching(app, path_buf)
}

#[tauri::command]
fn stop_file_watcher(app: tauri::AppHandle) -> Result<(), String> {
    watcher::stop_watching(&app)
}

   /// NOTE: actuellement inutilisée côté frontend.
   /// Utilitaire pour accéder au `.data/` embarqué (read-only) en production packagée.
   /// Le frontend utilise `get_user_data_path` (working copy) + chemin `.data/` relatif.
   /// À conserver pour de futurs usages (lecture de ressources embarquées).
   #[tauri::command]
   fn get_resource_path(app: tauri::AppHandle) -> Result<String, String> {
    // Retourne le chemin absolu du .data/ embarqué comme resource Tauri.
    // En production packagée, il faut utiliser l'API Tauri (app.path().resource_dir())
    // et NON std::env::current_dir() qui ne pointe pas vers les resources.
    app.path()
        .resource_dir()
        .map(|dir| dir.join(".data").to_string_lossy().to_string())
        .map_err(|e| format!("Impossible de resoudre le resource_dir: {}", e))
}

/// Vérifie si un répertoire est vide (aucun fichier, aucun sous-dossier).
fn is_directory_empty(path: &Path) -> bool {
    match std::fs::read_dir(path) {
        Ok(mut entries) => entries.next().is_none(),
        Err(_) => true, // Considérer vide si inaccessible
    }
}

/// Copie récursivement le contenu de .data (resource Tauri) vers
/// %APPDATA%\NexaFlow\repository\, UNIQUEMENT si le répertoire cible
/// est vide. Ne JAMAIS écraser les données utilisateur existantes.
fn ensure_initial_repository(app: &tauri::AppHandle) -> Result<(), String> {
    // 1. Résoudre le chemin source (.data dans resource_dir)
    let source = app
        .path()
        .resource_dir()
        .map_err(|e| format!("Impossible de résoudre resource_dir: {}", e))?
        .join(".data");

    if !source.exists() {
        return Err(format!(
            "Le répertoire source .data n'existe pas: {}",
            source.display()
        ));
    }

    // 2. Résoudre le chemin cible (%APPDATA%\NexaFlow\repository)
    let target = PathBuf::from(get_user_data_path()).join("repository");

    // 3. Créer le répertoire cible s'il n'existe pas
    std::fs::create_dir_all(&target)
        .map_err(|e| format!("Impossible de créer {}: {}", target.display(), e))?;

    // 4. Vérifier si le répertoire cible est vide
    if !is_directory_empty(&target) {
        println!(
            "[init] repository/ non vide, copie ignorée (données préservées)"
        );
        return Ok(());
    }

    println!("[init] Copie initiale de .data vers repository/...");

    // 5. Copie récursive
    let mut copied = 0usize;
    for entry in WalkDir::new(&source).min_depth(1) {
        let entry = entry.map_err(|e| format!("Erreur parcours: {}", e))?;
        let relative = entry
            .path()
            .strip_prefix(&source)
            .map_err(|e| format!("Erreur strip_prefix: {}", e))?;
        let dest = target.join(relative);

        if entry.file_type().is_dir() {
            std::fs::create_dir_all(&dest)
                .map_err(|e| format!("Impossible de créer {}: {}", dest.display(), e))?;
        } else if entry.file_type().is_file() {
            // Créer le dossier parent si nécessaire
            if let Some(parent) = dest.parent() {
                std::fs::create_dir_all(parent).map_err(|e| {
                    format!("Impossible de créer {}: {}", parent.display(), e)
                })?;
            }
            std::fs::copy(entry.path(), &dest).map_err(|e| {
                format!(
                    "Impossible de copier {} vers {}: {}",
                    entry.path().display(),
                    dest.display(),
                    e
                )
            })?;
            copied += 1;
        }
    }

    println!("[init] {} fichiers copiés dans repository/", copied);
    Ok(())
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
async fn read_file_content(app: tauri::AppHandle, path: String) -> Result<FileContent, String> {
    use sha2::{Digest, Sha256};
    use std::fs;
    use std::path::PathBuf;

    let p = PathBuf::from(&path);
    let resolved_path: PathBuf = if p.is_absolute() {
        p
    } else {
        let repo_path = resolve_repository_path(None).join(&p);
        if repo_path.exists() {
            repo_path
        } else {
            let data_path = resolve_data_path(&app).join(&p);
            if data_path.exists() {
                data_path
            } else {
                return Err(format!("Fichier introuvable: {}", path));
            }
        }
    };

    let bytes = fs::read(&resolved_path)
        .map_err(|e| format!("Impossible de lire {}: {}", resolved_path.display(), e))?;

    let size = bytes.len();
    let hash = {
        let mut hasher = Sha256::new();
        hasher.update(&bytes);
        hex::encode(hasher.finalize())
    };

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

    let ext = resolved_path
        .extension()
        .and_then(|e| e.to_str())
        .unwrap_or("")
        .to_lowercase();

    let (kind, mime_type, content) = match ext.as_str() {
        "json" | "txt" | "md" | "csv" | "log" | "xml" => (
            "text",
            "text/plain",
            text_content.clone().unwrap_or_default(),
        ),
        "jpg" | "jpeg" => (
            "image",
            "image/jpeg",
            base64_content.clone().unwrap_or_default(),
        ),
        "png" => (
            "image",
            "image/png",
            base64_content.clone().unwrap_or_default(),
        ),
        "gif" => (
            "image",
            "image/gif",
            base64_content.clone().unwrap_or_default(),
        ),
        "svg" => (
            "image",
            "image/svg+xml",
            base64_content.clone().unwrap_or_default(),
        ),
        "pdf" => (
            "pdf",
            "application/pdf",
            base64_content.clone().unwrap_or_default(),
        ),
        _ => (
            "binary",
            "application/octet-stream",
            base64_content.clone().unwrap_or_default(),
        ),
    };

    Ok(FileContent {
        success: true,
        kind: kind.to_string(),
        content,
        mime_type: mime_type.to_string(),
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

    let path_ref = Path::new(&path);

    if let Some(parent) = path_ref.parent() {
        fs::create_dir_all(parent)
            .map_err(|e| format!("Impossible de créer {}: {}", parent.display(), e))?;
    }

    let tmp_path = format!("{}.tmp", path);

    fs::write(&tmp_path, content.as_bytes())
        .map_err(|e| format!("Impossible d'écrire {}: {}", tmp_path, e))?;

    fs::rename(&tmp_path, path_ref).map_err(|e| {
        let _ = fs::remove_file(&tmp_path);
        format!("Impossible de renommer {} vers {}: {}", tmp_path, path, e)
    })?;

    Ok(())
}

#[tauri::command]
async fn search_local_rag(
    query: String,
    top_k: Option<usize>,
    directory_filter: Option<String>,
) -> Result<Vec<SearchResult>, String> {
    let user_path = get_user_data_path();
    let chroma_path = PathBuf::from(user_path).join("chroma");
    let store = LocalChromaStore::load(&chroma_path);

    if store.records.is_empty() {
        return Ok(vec![]);
    }

    // 1. Générer l'embedding local de la question (ONNX all-MiniLM-L6-v2, 100% offline)
    let query_embedding = embeddings::generate_embedding_local(&query)?;

    // 2. Chercher dans la base locale
    let top_k = top_k.unwrap_or(5);
    let results = store.query(&query_embedding, top_k, directory_filter.as_deref());

    Ok(results)
}

#[tauri::command]
async fn ask_local_rag(question: String) -> Result<RagAnswer, String> {
    let results = search_local_rag(question.clone(), Some(5), None).await?;

    if results.is_empty() {
        return Ok(RagAnswer {
            answer: "Aucun document pertinent trouvé dans la base vectorielle locale.".to_string(),
            sources: vec![],
        });
    }

    // Construire le contexte avec les chemins et fichiers
    let context = results
        .iter()
        .enumerate()
        .map(|(i, r)| {
            format!(
                "[Source {}]\nChemin: {}\nDossier: {}\nFichier: {}\nContenu:\n{}\n",
                i + 1,
                r.path,
                r.directory,
                r.filename,
                r.chunk
            )
        })
        .collect::<Vec<_>>()
        .join("\n---\n");

    let prompt = format!(
        "Tu es l'assistant technique de terrain NexaFlow (Centrale thermique / Cycle combiné).\n\
         Réponds à la question suivante en te basant STRICTEMENT et UNIQUEMENT sur les sources locales fournies.\n\
         Les dossiers et noms de fichiers reflètent la structure des équipements et sous-systèmes.\n\
         Si les sources ne contiennent pas l'information, dis clairement que l'information n'est pas présente dans la base locale.\n\n\
         SOURCES LOCALES :\n{}\n\n\
         QUESTION :\n{}\n\n\
         RÉPONSE :",
        context, question
    );

    let answer = embeddings::generate_ai_response(&prompt).await?;

    Ok(RagAnswer {
        answer,
        sources: results,
    })
}

#[tauri::command]
async fn ask_local_rag_stream(
    app: tauri::AppHandle,
    question: String,
    conversation_id: String,
) -> Result<(), String> {
    // Adaptive top_k based on question length
    let top_k = if question.len() < 50 { 5 } else { 3 };
    // Reuse search_local_rag logic (already async)
    let sources = search_local_rag(question.clone(), Some(top_k), None).await?;

    if sources.is_empty() {
        // Emit done with default message
        let _ = app.emit(
            "rag-stream-done",
            serde_json::json!({
                "conversation_id": conversation_id,
                "sources": [],
                "full_answer": "Aucun document pertinent trouvé dans la base locale."
            })
        );
        return Ok(());
    }

    // Build context string from sources
    let context = sources
        .iter()
        .enumerate()
        .map(|(i, r)| {
            format!(
                "[Source {}]\nDossier: {}\nFichier: {}\nContenu: {}\n",
                i + 1,
                r.directory,
                r.filename,
                r.chunk
            )
        })
        .collect::<Vec<_>>()
        .join("\n---\n");

    let prompt = format!(
        "Tu es un assistant technique. Réponds en français, en te basant UNIQUEMENT sur les sources.\n\n\
        Les dossiers et noms de fichiers reflètent le contexte.\n\n\
        Si les sources ne contiennent pas l'information, indique-le.\n\n\
        SOURCES LOCALES :\n{}\n\nQUESTION :\n{}\n\nRÉPONSE :",
        context,
        question,
    );

    // Call streaming helper
    groq_stream::stream_groq_response(app, prompt, conversation_id, sources).await
}



#[tauri::command]
async fn get_vectorization_stats() -> Result<VectorizationStats, String> {
    let user_path = get_user_data_path();
    let repo_path = PathBuf::from(&user_path).join("repository");
    let chroma_path = PathBuf::from(&user_path).join("chroma");
    let meta_file = chroma_path.join("meta.json");

    let current_files = auto_vectorizer::scan_repository(&repo_path);
    let meta_state = auto_vectorizer::read_meta_state(&meta_file);
    let store = LocalChromaStore::load(&chroma_path);
    let vectorized_files = current_files
        .iter()
        .filter(|(path, file)| file.hash.is_some() && meta_state.contains_key(*path))
        .count();
    let total_chunks = store
        .records
        .values()
        .filter(|record| current_files.contains_key(&record.metadata.path))
        .count();
    let last_update = meta_file
        .metadata()
        .and_then(|metadata| metadata.modified())
        .map(|modified| chrono::DateTime::<chrono::Utc>::from(modified).to_rfc3339())
        .ok()
        .or_else(|| {
            store
                .records
                .values()
                .map(|record| record.metadata.last_modified.clone())
                .max()
        })
        .unwrap_or_else(|| chrono::Utc::now().to_rfc3339());

    Ok(VectorizationStats {
        total_files: current_files.len(),
        vectorized_files,
        total_chunks,
        last_update,
    })
}

#[tauri::command]
async fn check_vectorization_consistency() -> Result<VectorizationConsistencyReport, String> {
    let user_path = get_user_data_path();
    let repo_path = PathBuf::from(&user_path).join("repository");
    let meta_file = PathBuf::from(&user_path).join("chroma").join("meta.json");

    Ok(auto_vectorizer::check_consistency(&repo_path, &meta_file))
}

#[tauri::command]
async fn trigger_local_vectorization(app: tauri::AppHandle) -> Result<VectorizationStats, String> {
    let user_path = get_user_data_path();
    let repo_path = PathBuf::from(&user_path).join("repository");
    let chroma_path = PathBuf::from(&user_path).join("chroma");

    let stats = auto_vectorizer::scan_and_vectorize(&repo_path, &chroma_path, Some(&app)).await;
    Ok(stats)
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

            let app_handle = app.handle().clone();
            let user_path = get_user_data_path();
            let repo_path = PathBuf::from(&user_path).join("repository");
            let chroma_path = PathBuf::from(&user_path).join("chroma");

            let _ = std::fs::create_dir_all(&repo_path);
            let _ = std::fs::create_dir_all(&chroma_path);

            // Copie initiale .data → repository/ (si repository/ est vide)
            if let Err(e) = ensure_initial_repository(app.handle()) {
                eprintln!("[init] Erreur copie initiale: {}", e);
            }

            // Seed admin local pour l'auth Tauri
            if let Err(e) = auth::ensure_default_admin(app.handle()) {
                eprintln!("[init] Erreur seed admin: {}", e);
            }

            // Enregistrer le State du watcher AVANT de démarrer le watcher
            app.manage(WatcherState::new());

            // Démarrer la surveillance locale des fichiers
            let _ = watcher::start_watching(app_handle.clone(), repo_path.clone());

            // Démarrer la vectorisation locale automatique
            auto_vectorizer::start_auto_vectorizer(app_handle, repo_path, chroma_path);

            // Arrêter le watcher quand la fenêtre se ferme
            if let Some(window) = app.get_webview_window("main") {
                let app_for_close = app.handle().clone();
                window.on_window_event(move |event| {
                    if let tauri::WindowEvent::CloseRequested { .. } = event {
                        let _ = watcher::stop_watching(&app_for_close);
                    }
                });
            }

            // Ouvrir les DevTools pour debug release MSI
            if let Some(window) = app.get_webview_window("main") {
                let _ = window.open_devtools();
            }

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            start_file_watcher,
            stop_file_watcher,
            get_resource_path,
            get_user_data_path,
            read_file_content,
            write_file_content,
            search_local_rag,
            ask_local_rag,
            get_vectorization_stats,
            vectorizer_tree::get_vectorization_tree,
            check_vectorization_consistency,
            trigger_local_vectorization,
            ask_local_rag_stream,
            read_config,
            write_config,
            delete_config,
            login,
            logout,
            get_session,
            structure::get_structure_tree,
            structure::get_repository_info,
            structure::tree_action,
            structure::reset_local_repository,
            sync::init_app,
            sync::sync_from_web,
            sync::sync_status,
            sync::sync_progress,
            api_commands::upload_file,
            api_commands::get_publish_queue,
            api_commands::get_sync_stats,
            api_commands::get_system_versions,
            api_commands::purge_sync_cache,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

#[cfg(test)]
mod tests_atomic_write {
    use super::*;
    use std::path::PathBuf;

    #[tokio::test]
    async fn test_write_file_content_atomic_basic() {
        let dir = std::env::temp_dir().join("nexaflow_test_c1");
        let _ = std::fs::remove_dir_all(&dir);
        std::fs::create_dir_all(&dir).unwrap();

        let target = dir.join("test_file.txt");
        let content = "hello atomic world";

        write_file_content(target.to_string_lossy().to_string(), content.to_string()).await.unwrap();

        let read_back = std::fs::read(&target).unwrap();
        assert_eq!(read_back, content.as_bytes(), "contenu identique");

        let tmp = PathBuf::from(format!("{}.tmp", target.to_string_lossy()));
        assert!(!tmp.exists(), "aucun .tmp résiduel");

        let _ = std::fs::remove_dir_all(&dir);
    }

    #[tokio::test]
    async fn test_write_file_content_overwrite() {
        let dir = std::env::temp_dir().join("nexaflow_test_c1_overwrite");
        let _ = std::fs::remove_dir_all(&dir);
        std::fs::create_dir_all(&dir).unwrap();

        let target = dir.join("test_file.txt");

        write_file_content(target.to_string_lossy().to_string(), "version 1".to_string()).await.unwrap();
        assert_eq!(std::fs::read(&target).unwrap(), b"version 1");

        write_file_content(target.to_string_lossy().to_string(), "version 2".to_string()).await.unwrap();
        assert_eq!(std::fs::read(&target).unwrap(), b"version 2");

        let tmp = PathBuf::from(format!("{}.tmp", target.to_string_lossy()));
        assert!(!tmp.exists(), "aucun .tmp résiduel après overwrite");

        let _ = std::fs::remove_dir_all(&dir);
    }

    #[tokio::test]
    async fn test_write_file_content_creates_parent() {
        let dir = std::env::temp_dir().join("nexaflow_test_c1_parent");
        let _ = std::fs::remove_dir_all(&dir);

        let target = dir.join("subdir").join("nested").join("file.txt");
        write_file_content(target.to_string_lossy().to_string(), "nested content".to_string()).await.unwrap();

        assert!(target.exists(), "fichier créé dans répertoire imbriqué");
        assert_eq!(std::fs::read(&target).unwrap(), b"nested content");

        let _ = std::fs::remove_dir_all(&dir);
    }
}
