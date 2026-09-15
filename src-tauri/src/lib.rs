mod auto_vectorizer;
mod embeddings;
mod vectorizer;
mod watcher;

use auto_vectorizer::{VectorizationConsistencyReport, VectorizationStats};
use std::path::PathBuf;
use vectorizer::{LocalChromaStore, SearchResult};

#[derive(serde::Serialize, serde::Deserialize, Clone, Debug)]
pub struct RagAnswer {
    pub answer: String,
    pub sources: Vec<SearchResult>,
}

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
    let path_buf = PathBuf::from(&path);
    if !path_buf.exists() {
        return Err(format!("Le dossier {} n'existe pas", path));
    }
    watcher::start_watching(app, path_buf)
}

#[tauri::command]
fn get_resource_path() -> String {
    // Retourne le chemin du .data/ embarqué
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

            // Démarrer la surveillance locale des fichiers
            let _ = watcher::start_watching(app_handle.clone(), repo_path.clone());

            // Démarrer la vectorisation locale automatique
            auto_vectorizer::start_auto_vectorizer(app_handle, repo_path, chroma_path);

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            start_file_watcher,
            get_resource_path,
            get_user_data_path,
            read_file_content,
            write_file_content,
            search_local_rag,
            ask_local_rag,
            get_vectorization_stats,
            check_vectorization_consistency,
            trigger_local_vectorization,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
