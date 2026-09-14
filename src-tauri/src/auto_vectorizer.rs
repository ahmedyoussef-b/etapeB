use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::fs;
use std::path::{Path, PathBuf};
use tauri::{AppHandle, Emitter};
use walkdir::WalkDir;

use crate::vectorizer::{compute_sha256, extract_relative_path, vectorize_file, LocalChromaStore};

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct VectorizationStats {
    #[serde(rename = "totalFiles")]
    pub total_files: usize,
    #[serde(rename = "vectorizedFiles")]
    pub vectorized_files: usize,
    #[serde(rename = "totalChunks")]
    pub total_chunks: usize,
    #[serde(rename = "lastUpdate")]
    pub last_update: String,
}

pub fn read_meta_state(meta_file: &Path) -> HashMap<String, String> {
    if meta_file.exists() {
        if let Ok(content) = fs::read_to_string(meta_file) {
            if let Ok(map) = serde_json::from_str::<HashMap<String, String>>(&content) {
                return map;
            }
        }
    }
    HashMap::new()
}

pub fn write_meta_state(meta_file: &Path, state: &HashMap<String, String>) -> Result<(), String> {
    if let Some(parent) = meta_file.parent() {
        fs::create_dir_all(parent)
            .map_err(|e| format!("Impossible de créer le dossier meta: {}", e))?;
    }
    let json = serde_json::to_string_pretty(state)
        .map_err(|e| format!("Erreur sérialisation meta: {}", e))?;
    fs::write(meta_file, json)
        .map_err(|e| format!("Impossible d'écrire meta.json: {}", e))?;
    Ok(())
}

pub async fn scan_and_vectorize(
    repo_path: &Path,
    chroma_path: &Path,
    app: Option<&AppHandle>,
) -> VectorizationStats {
    let meta_file = chroma_path.join("meta.json");
    let mut meta_state = read_meta_state(&meta_file);

    let mut total_files = 0;
    let mut current_files = HashMap::new();

    // 1. Scanner le répertoire
    for entry in WalkDir::new(repo_path).into_iter().filter_map(|e| e.ok()) {
        if !entry.file_type().is_file() {
            continue;
        }

        let path = entry.path();
        let ext = path
            .extension()
            .and_then(|e| e.to_str())
            .unwrap_or("")
            .to_lowercase();

        // Ignorer les binaires lourds
        if matches!(
            ext.as_str(),
            "jpg" | "jpeg" | "png" | "gif" | "webp" | "pdf" | "zip" | "tar" | "gz" | "exe" | "dll"
        ) {
            continue;
        }

        total_files += 1;
        let relative = extract_relative_path(path);

        if let Ok(bytes) = fs::read(path) {
            if let Ok(content) = String::from_utf8(bytes) {
                let hash = compute_sha256(&content);
                current_files.insert(relative.clone(), (path.to_path_buf(), hash));
            }
        }
    }

    // 2. Supprimer les fichiers qui n'existent plus
    let mut store = LocalChromaStore::load(chroma_path);
    let mut meta_changed = false;

    let deleted_keys: Vec<String> = meta_state
        .keys()
        .filter(|k| !current_files.contains_key(*k))
        .cloned()
        .collect();

    for deleted in deleted_keys {
        store.remove_file(&deleted);
        meta_state.remove(&deleted);
        meta_changed = true;
    }

    // 3. Vectoriser les nouveaux fichiers ou modifiés
    for (relative, (full_path, hash)) in &current_files {
        let is_modified = meta_state.get(relative) != Some(hash);

        if is_modified {
            println!("[vectorizer] Indexation de {}", relative);
            match vectorize_file(full_path, chroma_path).await {
                Ok(res) => {
                    if res.success {
                        meta_state.insert(relative.clone(), hash.clone());
                        meta_changed = true;
                        println!("[vectorizer] ✅ {} chunks indexés pour {}", res.chunks_count, relative);
                    }
                }
                Err(e) => {
                    eprintln!("[vectorizer] ❌ Échec indexation {}: {}", relative, e);
                }
            }
        }
    }

    if meta_changed {
        let _ = write_meta_state(&meta_file, &meta_state);
        let _ = store.save(chroma_path);
    }

    // Recharger store à jour pour les stats
    let final_store = LocalChromaStore::load(chroma_path);
    let stats = VectorizationStats {
        total_files,
        vectorized_files: meta_state.len(),
        total_chunks: final_store.records.len(),
        last_update: chrono::Utc::now().to_rfc3339(),
    };

    if let Some(app_handle) = app {
        let _ = app_handle.emit("vectorization-updated", &stats);
    }

    stats
}

pub fn start_auto_vectorizer(
    app: AppHandle,
    repo_path: PathBuf,
    chroma_path: PathBuf,
) {
    std::thread::spawn(move || {
        let runtime = tokio::runtime::Builder::new_multi_thread()
            .enable_all()
            .build();

        if let Ok(rt) = runtime {
            rt.block_on(async {
                println!("[auto_vectorizer] Démarrage du scan initial...");
                let stats = scan_and_vectorize(&repo_path, &chroma_path, Some(&app)).await;
                println!(
                    "[auto_vectorizer] Scan initial terminé : {}/{} fichiers vectorisés ({} chunks)",
                    stats.vectorized_files, stats.total_files, stats.total_chunks
                );

                // Polling périodique de réconciliation toutes les 3 minutes
                let mut interval = tokio::time::interval(std::time::Duration::from_secs(180));
                loop {
                    interval.tick().await;
                    scan_and_vectorize(&repo_path, &chroma_path, Some(&app)).await;
                }
            });
        }
    });
}
