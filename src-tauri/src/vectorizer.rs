use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::fs;
use std::path::{Path, PathBuf};
use tauri::AppHandle;
use crate::_get_user_data_path;

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct ChunkMetadata {
    pub path: String,
    pub directory: String,
    pub filename: String,
    pub extension: String,
    #[serde(rename = "chunkIndex")]
    pub chunk_index: usize,
    #[serde(rename = "totalChunks")]
    pub total_chunks: usize,
    pub hash: String,
    #[serde(rename = "lastModified")]
    pub last_modified: String,
    #[serde(rename = "fileSize")]
    pub file_size: usize,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct VectorRecord {
    pub id: String,
    pub chunk: String,
    pub embedding: Vec<f32>,
    pub metadata: ChunkMetadata,
}

#[derive(Serialize, Deserialize, Clone, Debug, Default)]
pub struct LocalChromaStore {
    pub records: HashMap<String, VectorRecord>,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct SearchResult {
    pub path: String,
    pub directory: String,
    pub filename: String,
    pub chunk: String,
    #[serde(rename = "chunkIndex")]
    pub chunk_index: usize,
    pub similarity: f32,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct VectorizeResult {
    pub path: String,
    pub chunks_count: usize,
    pub success: bool,
    pub error: Option<String>,
}

impl LocalChromaStore {
    pub fn load(chroma_path: &Path) -> Self {
        let collections_dir = chroma_path.join("collections");
        let default_file = collections_dir.join("default.json");

        if default_file.exists() {
            if let Ok(content) = fs::read_to_string(&default_file) {
                if let Ok(store) = serde_json::from_str::<LocalChromaStore>(&content) {
                    return store;
                }
            }
        }

        LocalChromaStore::default()
    }

    pub fn save(&self, chroma_path: &Path) -> Result<(), String> {
        let collections_dir = chroma_path.join("collections");
        fs::create_dir_all(&collections_dir)
            .map_err(|e| format!("Impossible de créer le dossier collections: {}", e))?;

        let default_file = collections_dir.join("default.json");
        let json = serde_json::to_string_pretty(self)
            .map_err(|e| format!("Erreur sérialisation LocalChromaStore: {}", e))?;

        fs::write(&default_file, json)
            .map_err(|e| format!("Impossible d'écrire collections/default.json: {}", e))?;

        Ok(())
    }

    pub fn upsert_file_records(&mut self, relative_path: &str, new_records: Vec<VectorRecord>) {
        // Supprimer les anciens chunks associés à ce fichier
        self.records.retain(|_, r| r.metadata.path != relative_path);

        // Insérer les nouveaux
        for record in new_records {
            self.records.insert(record.id.clone(), record);
        }
    }

    pub fn remove_file(&mut self, relative_path: &str) {
        self.records.retain(|_, r| r.metadata.path != relative_path);
    }

    pub fn query(
        &self,
        query_embedding: &[f32],
        top_k: usize,
        directory_filter: Option<&str>,
    ) -> Vec<SearchResult> {
        let mut results: Vec<SearchResult> = self
            .records
            .values()
            .filter(|r| {
                if let Some(dir_filter) = directory_filter {
                    if !dir_filter.is_empty() {
                        return r.metadata.directory.starts_with(dir_filter)
                            || r.metadata.path.starts_with(dir_filter);
                    }
                }
                true
            })
            .map(|r| {
                let sim = cosine_similarity(query_embedding, &r.embedding);
                SearchResult {
                    path: r.metadata.path.clone(),
                    directory: r.metadata.directory.clone(),
                    filename: r.metadata.filename.clone(),
                    chunk: r.chunk.clone(),
                    chunk_index: r.metadata.chunk_index,
                    similarity: sim,
                }
            })
            .collect();

        // Trier par score de similarité décroissant
        results.sort_by(|a, b| b.similarity.partial_cmp(&a.similarity).unwrap_or(std::cmp::Ordering::Equal));
        results.truncate(top_k);
        results
    }
}

pub fn cosine_similarity(a: &[f32], b: &[f32]) -> f32 {
    if a.len() != b.len() || a.is_empty() {
        return 0.0;
    }
    let mut dot = 0.0f32;
    let mut norm_a = 0.0f32;
    let mut norm_b = 0.0f32;

    for (&val_a, &val_b) in a.iter().zip(b.iter()) {
        dot += val_a * val_b;
        norm_a += val_a * val_a;
        norm_b += val_b * val_b;
    }

    if norm_a <= 0.0 || norm_b <= 0.0 {
        return 0.0;
    }

    dot / (norm_a.sqrt() * norm_b.sqrt())
}

pub fn chunk_content(content: &str) -> Vec<String> {
    const MAX_CHUNK_CHARS: usize = 1500;
    const OVERLAP_CHARS: usize = 100;

    let trimmed = content.trim();
    if trimmed.is_empty() {
        return vec![];
    }

    // Collect char boundary offsets so we never slice mid-codepoint
    let char_boundaries: Vec<usize> = trimmed
        .char_indices()
        .map(|(i, _)| i)
        .chain(std::iter::once(trimmed.len()))
        .collect();

    let total_chars = char_boundaries.len() - 1; // last entry is len(), not a char start

    if total_chars <= MAX_CHUNK_CHARS {
        return vec![trimmed.to_string()];
    }

    let mut chunks: Vec<String> = vec![];
    let mut char_start: usize = 0; // index into char_boundaries

    while char_start < total_chars {
        let char_end = std::cmp::min(char_start + MAX_CHUNK_CHARS, total_chars);

        // Try to break at the last newline within the window (char indices)
        let byte_start = char_boundaries[char_start];
        let byte_end   = char_boundaries[char_end];

        let actual_char_end = trimmed[byte_start..byte_end]
            .rfind('\n')
            .map(|byte_offset| {
                // byte_start + byte_offset is a safe char boundary (rfind returns char boundaries)
                let abs_byte = byte_start + byte_offset;
                // Convert abs_byte back to a char index
                char_boundaries.partition_point(|&b| b <= abs_byte).saturating_sub(1)
            })
            .filter(|&ci| ci > char_start) // must advance
            .unwrap_or(char_end);

        let byte_s = char_boundaries[char_start];
        let byte_e = char_boundaries[actual_char_end];
        let chunk = trimmed[byte_s..byte_e].trim();
        if !chunk.is_empty() {
            chunks.push(chunk.to_string());
        }

        char_start = if actual_char_end > char_start + OVERLAP_CHARS {
            actual_char_end - OVERLAP_CHARS
        } else {
            actual_char_end
        };

        if char_start >= total_chars {
            break;
        }
    }

    if chunks.is_empty() {
        vec![trimmed.to_string()]
    } else {
        chunks
    }
}

pub fn extract_relative_path(full_path: &Path) -> String {
    let normalized = full_path.to_string_lossy().replace('\\', "/");
    if let Some(idx) = normalized.find("/repository/") {
        return normalized[idx + "/repository/".len()..].to_string();
    }
    normalized
}

pub fn compute_sha256(content: &str) -> String {
    use sha2::{Digest, Sha256};
    let mut hasher = Sha256::new();
    hasher.update(content.as_bytes());
    hex::encode(hasher.finalize())
}

pub async fn vectorize_file(
    file_path: &Path,
    chroma_path: &Path,
) -> Result<VectorizeResult, String> {
    let ext = file_path
        .extension()
        .and_then(|e| e.to_str())
        .unwrap_or("")
        .to_lowercase();

    // Skip des formats binaires ou non textuels
    if matches!(
        ext.as_str(),
        "jpg" | "jpeg" | "png" | "gif" | "webp" | "pdf" | "zip" | "tar" | "gz" | "exe" | "dll"
    ) {
        return Ok(VectorizeResult {
            path: file_path.to_string_lossy().to_string(),
            chunks_count: 0,
            success: true,
            error: None,
        });
    }

    let bytes = fs::read(file_path)
        .map_err(|e| format!("Lecture impossible {}: {}", file_path.display(), e))?;

    let content = match String::from_utf8(bytes) {
        Ok(s) => s,
        Err(_) => {
            // Fichier binaire non UTF-8, ignorer
            return Ok(VectorizeResult {
                path: file_path.to_string_lossy().to_string(),
                chunks_count: 0,
                success: true,
                error: None,
            });
        }
    };

    let relative_path = extract_relative_path(file_path);
    let parent_dir = file_path
        .parent()
        .and_then(|p| p.file_name())
        .and_then(|n| n.to_str())
        .unwrap_or("")
        .to_string();

    let filename = file_path
        .file_name()
        .and_then(|n| n.to_str())
        .unwrap_or("")
        .to_string();

    let hash = compute_sha256(&content);
    let file_size = content.len();
    let chunks = chunk_content(&content);
    let total_chunks = chunks.len();

    let last_modified = fs::metadata(file_path)
        .and_then(|m| m.modified())
        .map(|t| chrono::DateTime::<chrono::Utc>::from(t).to_rfc3339())
        .unwrap_or_else(|_| chrono::Utc::now().to_rfc3339());

    let embeddings = crate::embeddings::generate_embeddings_batch(chunks.clone())
        .map_err(|e| format!("Erreur vectorisation: {}", e))?;

    let mut vector_records = Vec::new();

    for (i, (chunk, embedding)) in chunks.into_iter().zip(embeddings.into_iter()).enumerate() {
        let metadata = ChunkMetadata {
            path: relative_path.clone(),
            directory: parent_dir.clone(),
            filename: filename.clone(),
            extension: ext.clone(),
            chunk_index: i,
            total_chunks,
            hash: hash.clone(),
            last_modified: last_modified.clone(),
            file_size,
        };

        let id = format!("{}_{}", relative_path.replace('/', "_"), i);
        vector_records.push(VectorRecord {
            id,
            chunk,
            embedding,
            metadata,
        });
    }

    // Charger le store existant, insérer et sauvegarder
    let mut store = LocalChromaStore::load(chroma_path);
    store.upsert_file_records(&relative_path, vector_records);
    store.save(chroma_path)?;

    Ok(VectorizeResult {
        path: relative_path,
        chunks_count: total_chunks,
        success: true,
        error: None,
    })
}

pub fn delete_from_chroma_internal(
    _app: &AppHandle,
    rel_path: &str,
) -> Result<usize, String> {
    let base = _get_user_data_path();
    let chroma_path = PathBuf::from(&base).join("chroma");

    let mut store = LocalChromaStore::load(&chroma_path);

    let prefix = format!("{}/", rel_path);
    let ids: Vec<String> = store
        .records
        .iter()
        .filter(|(_, r)| r.metadata.path == rel_path || r.metadata.path.starts_with(&prefix))
        .map(|(id, _)| id.clone())
        .collect();

    let count = ids.len();
    for id in &ids {
        store.records.remove(id);
    }

    store.save(&chroma_path)?;
    log::info!("[chroma] deleted {} chunks for {}", count, rel_path);
    Ok(count)
}

pub async fn vectorize_single_file_internal(
    _app: &AppHandle,
    path: &Path,
) -> Result<usize, String> {
    let base = _get_user_data_path();
    let chroma_path = PathBuf::from(&base).join("chroma");

    let result = vectorize_file(path, &chroma_path).await?;
    Ok(result.chunks_count)
}
