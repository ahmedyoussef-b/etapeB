use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::fs;
use std::path::{Path, PathBuf};
use tauri::{AppHandle, Emitter};
use walkdir::WalkDir;

use crate::vectorizer::{compute_sha256, extract_relative_path, vectorize_file, LocalChromaStore};

pub(crate) struct RepositoryFile {
    pub(crate) path: PathBuf,
    pub(crate) hash: Option<String>,
}

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

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct VectorizationConsistencyReport {
    #[serde(rename = "totalFiles")]
    pub total_files: usize,
    #[serde(rename = "vectorizedFiles")]
    pub vectorized_files: usize,
    #[serde(rename = "consistentFiles")]
    pub consistent_files: Vec<String>,
    #[serde(rename = "missingFiles")]
    pub missing_files: Vec<String>,
    #[serde(rename = "modifiedFiles")]
    pub modified_files: Vec<String>,
    #[serde(rename = "orphanedFiles")]
    pub orphaned_files: Vec<String>,
    #[serde(rename = "isConsistent")]
    pub is_consistent: bool,
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

fn is_indexable_file(path: &Path) -> bool {
    let ext = path
        .extension()
        .and_then(|e| e.to_str())
        .unwrap_or("")
        .to_lowercase();

    !matches!(
        ext.as_str(),
        "jpg" | "jpeg" | "png" | "gif" | "webp" | "pdf" | "zip" | "tar" | "gz" | "exe" | "dll"
    )
}

pub(crate) fn scan_repository(repo_path: &Path) -> HashMap<String, RepositoryFile> {
    let mut files = HashMap::new();

    if !repo_path.exists() {
        return files;
    }

    for entry in WalkDir::new(repo_path).into_iter().filter_map(|e| e.ok()) {
        if !entry.file_type().is_file() || !is_indexable_file(entry.path()) {
            continue;
        }

        let path = entry.path();
        let relative = extract_relative_path(path);

        if let Ok(bytes) = fs::read(path) {
            let hash = String::from_utf8(bytes)
                .ok()
                .map(|content| compute_sha256(&content));
            files.insert(
                relative,
                RepositoryFile {
                    path: path.to_path_buf(),
                    hash,
                },
            );
        }
    }

    files
}

pub async fn scan_and_vectorize(
    repo_path: &Path,
    chroma_path: &Path,
    app: Option<&AppHandle>,
) -> VectorizationStats {
    let meta_file = chroma_path.join("meta.json");
    let mut meta_state = read_meta_state(&meta_file);
    let current_files = scan_repository(repo_path);
    let total_files = current_files.len();

    // 2. Supprimer les fichiers qui n'existent plus
    let mut store = LocalChromaStore::load(chroma_path);
    let mut meta_changed = false;

    let deleted_keys: Vec<String> = meta_state
        .keys()
        .filter(|k| !current_files.contains_key(*k))
        .cloned()
        .collect();

    for deleted in &deleted_keys {
        store.remove_file(deleted);
        meta_state.remove(deleted);
        meta_changed = true;
    }

    if !deleted_keys.is_empty() {
        let _ = store.save(chroma_path);
    }

    // 3. Vectoriser les nouveaux fichiers ou modifiés
    for (relative, file) in &current_files {
        let Some(hash) = &file.hash else {
            if meta_state.remove(relative).is_some() {
                meta_changed = true;
            }
            continue;
        };

        let is_modified = meta_state.get(relative) != Some(hash);

        if is_modified {
            println!("[vectorizer] Indexation de {}", relative);
            match vectorize_file(&file.path, chroma_path).await {
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

pub fn check_consistency(repo_path: &Path, meta_file: &Path) -> VectorizationConsistencyReport {
    let current_files = scan_repository(repo_path);
    let meta_state = read_meta_state(meta_file);
    let mut consistent_files = Vec::new();
    let mut missing_files = Vec::new();
    let mut modified_files = Vec::new();

    for (relative, file) in &current_files {
        match (file.hash.as_deref(), meta_state.get(relative)) {
            (Some(current_hash), Some(stored_hash)) if stored_hash == current_hash => {
                consistent_files.push(relative.clone());
            }
            (Some(_), Some(_)) => modified_files.push(relative.clone()),
            _ => missing_files.push(relative.clone()),
        }
    }

    let mut orphaned_files: Vec<String> = meta_state
        .keys()
        .filter(|relative| !current_files.contains_key(*relative))
        .cloned()
        .collect();

    consistent_files.sort();
    missing_files.sort();
    modified_files.sort();
    orphaned_files.sort();

    let is_consistent = missing_files.is_empty()
        && modified_files.is_empty()
        && orphaned_files.is_empty();

    VectorizationConsistencyReport {
        total_files: current_files.len(),
        vectorized_files: meta_state.len(),
        consistent_files,
        missing_files,
        modified_files,
        orphaned_files,
        is_consistent,
    }
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

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_semantic_search_and_groq() {
        let appdata = std::env::var("APPDATA").unwrap_or_else(|_| ".".to_string());
        let chroma_path = PathBuf::from(format!("{}\\NexaFlow\\chroma", appdata));
        let store = LocalChromaStore::load(&chroma_path);

        assert!(!store.records.is_empty(), "Store ne doit pas être vide");

        let test_queries = vec![
            "machine qui tourne",
            "panne",
            "réparation",
            "chef",
            "arrêt pompe urgence",
        ];

        println!("\n=== RÉSULTATS DES TESTS SÉMANTIQUES (ONNX all-MiniLM-L6-v2) ===");
        for q in test_queries {
            let emb = crate::embeddings::generate_embedding_local(q).unwrap();
            assert_eq!(emb.len(), 384, "Dimension embedding doit être 384");
            let results = store.query(&emb, 3, None);
            println!("\n▶ Query: \"{}\" -> {} résultat(s)", q, results.len());
            for (i, r) in results.iter().enumerate() {
                println!(
                    "   [{}] Sim: {:.4} | Path: {} | Chunk: {}",
                    i + 1,
                    r.similarity,
                    r.path,
                    r.chunk.chars().take(80).collect::<String>().replace('\n', " ")
                );
            }
            assert!(!results.is_empty(), "Doit trouver au moins 1 résultat");
        }

        // Test Génération Groq
        println!("\n=== TEST GÉNÉRATION GROQ (llama-3.3-70b-versatile) ===");
        let groq_res = crate::embeddings::generate_ai_response(
            "En 1 phrase courte, que signifie le code B0 dans une centrale ?"
        ).await;
        match groq_res {
            Ok(ans) => println!("✅ Réponse Groq: {}", ans.trim()),
            Err(e) => println!("❌ Erreur Groq: {}", e),
        }
    }
}
