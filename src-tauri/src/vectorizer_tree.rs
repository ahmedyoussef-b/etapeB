use std::collections::{HashMap, HashSet};
use std::fs;
use std::path::{Path, PathBuf};

use serde_json::{json, Value};

use crate::structure::resolve_repository_path;
use crate::vectorizer::{extract_relative_path, LocalChromaStore};

#[tauri::command]
pub fn get_vectorization_tree(
    _app: tauri::AppHandle,
    path: Option<String>,
) -> Result<Value, String> {
    let user_path = crate::get_user_data_path();
    let chroma_path = PathBuf::from(&user_path).join("chroma");
    let meta_file = chroma_path.join("meta.json");

    let store = LocalChromaStore::load(&chroma_path);

    let mut chunk_counts: HashMap<String, usize> = HashMap::new();
    let mut last_modified_by_path: HashMap<String, String> = HashMap::new();
    for record in store.records.values() {
        let entry = chunk_counts
            .entry(record.metadata.path.clone())
            .or_insert(0);
        *entry += 1;
        if record.metadata.last_modified != "0001-01-01T00:00:00Z"
            && record.metadata.last_modified != "1970-01-01T00:00:00Z"
        {
            last_modified_by_path
                .entry(record.metadata.path.clone())
                .or_insert_with(|| record.metadata.last_modified.clone());
        }
    }

    let mut vectorized_files: HashSet<String> = HashSet::new();
    if meta_file.exists() {
        if let Ok(content) = fs::read_to_string(&meta_file) {
            if let Ok(meta) = serde_json::from_str::<HashMap<String, String>>(&content) {
                vectorized_files = meta.keys().cloned().collect();
            }
        }
    }

    let repo_path = resolve_repository_path(None);

    let base = if let Some(p) = path {
        if p.is_empty() {
            repo_path.clone()
        } else {
            repo_path.join(p)
        }
    } else {
        repo_path.clone()
    };

    if !base.exists() {
        return Ok(json!({
            "success": true,
            "data": [],
            "sourceUsed": "vector",
        }));
    }

    let nodes = build_vector_tree(
        &repo_path,
        &base,
        &chunk_counts,
        &vectorized_files,
        &last_modified_by_path,
    );
    Ok(json!({
        "success": true,
        "data": nodes,
        "sourceUsed": "vector",
    }))
}

fn build_vector_tree(
    repo_root: &Path,
    current: &Path,
    chunk_counts: &HashMap<String, usize>,
    vectorized_files: &HashSet<String>,
    last_modified_by_path: &HashMap<String, String>,
) -> Vec<Value> {
    let mut nodes = Vec::new();
    if let Ok(entries) = fs::read_dir(current) {
        for entry in entries.flatten() {
            let path = entry.path();
            let name = entry.file_name().to_string_lossy().to_string();
            let relative_str = extract_relative_path(&path);

            let node = if path.is_dir() {
                let children = build_vector_tree(
                    repo_root,
                    &path,
                    chunk_counts,
                    vectorized_files,
                    last_modified_by_path,
                );

                let mut total_chunks: usize = 0;
                let mut total_files: usize = 0;
                let mut vectorized_file_count: usize = 0;

                collect_vector_stats(
                    &children,
                    &mut total_chunks,
                    &mut total_files,
                    &mut vectorized_file_count,
                );

                let vectorized = total_chunks > 0;

                json!({
                    "name": name,
                    "path": relative_str,
                    "type": "directory",
                    "children": children,
                    "metadata": {
                        "vectorized": vectorized,
                        "chunkCount": total_chunks,
                        "fileCount": total_files,
                        "vectorizedFileCount": vectorized_file_count,
                    },
                })
            } else {
                let vectorized = vectorized_files.contains(&relative_str);
                let chunk_count = chunk_counts.get(&relative_str).copied().unwrap_or(0);
                let size = entry.metadata().map(|m| m.len()).unwrap_or(0);
                let last_vectorized = last_modified_by_path
                    .get(&relative_str)
                    .cloned()
                    .unwrap_or_default();

                json!({
                    "name": name,
                    "path": relative_str,
                    "type": "file",
                    "size": size,
                    "metadata": {
                        "vectorized": vectorized,
                        "chunkCount": chunk_count,
                        "lastVectorized": last_vectorized,
                    },
                })
            };

            nodes.push(node);
        }
    }

    nodes.sort_by(|a, b| {
        let a_dir = a.get("type").and_then(|v| v.as_str()) == Some("directory");
        let b_dir = b.get("type").and_then(|v| v.as_str()) == Some("directory");
        match (a_dir, b_dir) {
            (true, false) => std::cmp::Ordering::Less,
            (false, true) => std::cmp::Ordering::Greater,
            _ => a
                .get("name")
                .and_then(|v| v.as_str())
                .unwrap_or("")
                .cmp(b.get("name").and_then(|v| v.as_str()).unwrap_or("")),
        }
    });

    nodes
}

fn collect_vector_stats(
    nodes: &[Value],
    total_chunks: &mut usize,
    total_files: &mut usize,
    vectorized_file_count: &mut usize,
) {
    for node in nodes {
        let meta = node.get("metadata").and_then(|m| m.as_object());
        if let Some(m) = meta {
            if node.get("type").and_then(|t| t.as_str()) == Some("file") {
                *total_files += 1;
                if let Some(v) = m.get("vectorized").and_then(|v| v.as_bool()) {
                    if v {
                        *vectorized_file_count += 1;
                    }
                }
            }
            if let Some(v) = m.get("chunkCount").and_then(|c| c.as_u64()) {
                *total_chunks += v as usize;
            }
            if let Some(v) = m.get("fileCount").and_then(|c| c.as_u64()) {
                *total_files += v as usize;
            }
            if let Some(v) = m.get("vectorizedFileCount").and_then(|c| c.as_u64()) {
                *vectorized_file_count += v as usize;
            }
        }
        if let Some(children) = node.get("children").and_then(|c| c.as_array()) {
            collect_vector_stats(children, total_chunks, total_files, vectorized_file_count);
        }
    }
}
