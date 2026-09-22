use std::fs;
use std::path::{Path, PathBuf};
use serde_json::{json, Value};
use tauri::{AppHandle, Manager};
use walkdir::WalkDir;

use crate::watcher;
use crate::auto_vectorizer;

fn user_data_root() -> PathBuf {
    PathBuf::from(if cfg!(target_os = "windows") {
        std::env::var("APPDATA")
            .map(|p| format!("{}\\NexaFlow", p))
            .unwrap_or_else(|_| ".".to_string())
    } else {
        ".".to_string()
    })
}

pub fn resolve_repository_path(repository: Option<&str>) -> PathBuf {
    match repository {
        Some(r) if !r.is_empty() => {
            let p = PathBuf::from(r);
            if p.is_absolute() {
                p
            } else {
                user_data_root().join(p)
            }
        }
        _ => user_data_root().join("repository"),
    }
}

pub fn resolve_data_path(app: &AppHandle) -> PathBuf {
    #[cfg(debug_assertions)]
    {
        let dev_data = PathBuf::from(env!("CARGO_MANIFEST_DIR"))
            .parent()
            .map(|p| p.join(".data"));
        if let Some(p) = dev_data {
            if p.exists() {
                return p;
            }
        }
    }

    let appdata_path = user_data_root().join(".data");
    if appdata_path.exists() {
        return appdata_path;
    }

    if let Ok(resource_dir) = app.path().resource_dir() {
        let resource_path = resource_dir.join(".data");
        if resource_path.exists() {
            return resource_path;
        }
    }

    appdata_path
}

#[tauri::command]
pub fn get_structure_tree(app: AppHandle, source: String, path: Option<String>, repository: Option<String>) -> Result<Value, String> {
    let base = match source.as_str() {
        "local" => {
            let resolved = resolve_repository_path(repository.as_deref());
            if resolved.exists() {
                resolved
            } else {
                user_data_root().join(".data")
            }
        }
        _ => resolve_data_path(&app),
    };

    let target = if let Some(p) = path {
        if p.is_empty() { base.clone() } else { base.join(p) }
    } else {
        base.clone()
    };

    if !target.exists() {
        return Ok(json!({
            "success": true,
            "data": [],
            "sourceUsed": source,
        }));
    }

    let nodes = build_tree(&target, &target);
    Ok(json!({
        "success": true,
        "data": nodes,
        "sourceUsed": source,
    }))
}

#[tauri::command]
pub fn get_repository_info() -> Result<Value, String> {
    let repo_dir = user_data_root().join("repository");

    let mut repositories = vec![];
    if let Ok(entries) = fs::read_dir(&repo_dir) {
        for entry in entries.flatten() {
            let path = entry.path();
            if path.is_dir() {
                repositories.push(
                    path.file_name()
                        .ok_or_else(|| format!("Chemin invalide dans repository: {}", path.display()))?
                        .to_string_lossy()
                        .to_string(),
                );
            }
        }
    }

    Ok(json!({
        "success": true,
        "repositories": repositories,
        "activeRepository": "repository",
        "basePath": ".",
    }))
}

#[tauri::command]
pub fn tree_action(app: AppHandle, action: String, path: String, _source: String, name: Option<String>, repository: Option<String>) -> Result<Value, String> {
    let base = resolve_repository_path(repository.as_deref());

    let target = base.join(&path);

    match action.as_str() {
        "rename" => {
            let new_name = name.filter(|n| !n.is_empty()).ok_or("missing name")?;
            let new_path = target.parent().map(|p| p.join(&new_name)).unwrap_or(PathBuf::from(&new_name));
            fs::rename(&target, &new_path).map_err(|e| e.to_string())?;
            Ok(json!({"success": true}))
        }
        "delete" => {
            if target.is_dir() {
                fs::remove_dir_all(&target).map_err(|e| e.to_string())?;
            } else {
                fs::remove_file(&target).map_err(|e| e.to_string())?;
            }
            Ok(json!({"success": true}))
        }
        "mkdir" => {
            let new_name = name.filter(|n| !n.is_empty()).ok_or("missing name")?;
            let new_path = target.join(&new_name);
            fs::create_dir_all(&new_path).map_err(|e| e.to_string())?;
            Ok(json!({"success": true}))
        }
        "resetFromData" => {
            let _ = watcher::stop_watching(&app);
            let repo_dir = resolve_repository_path(repository.as_deref());
            let source_dir = resolve_data_path(&app);
            let chroma_path = user_data_root().join("chroma");

            let mut files_deleted = 0usize;
            if repo_dir.exists() {
                for entry in fs::read_dir(&repo_dir).map_err(|e| e.to_string())? {
                    let entry = entry.map_err(|e| e.to_string())?;
                    let p = entry.path();
                    if p.is_dir() {
                        fs::remove_dir_all(&p).map_err(|e| e.to_string())?;
                    } else {
                        fs::remove_file(&p).map_err(|e| e.to_string())?;
                    }
                    files_deleted += 1;
                }
            }

            let mut files_copied = 0usize;
            if source_dir.exists() {
                for entry in WalkDir::new(&source_dir).min_depth(1) {
                    let entry = entry.map_err(|e| e.to_string())?;
                    let relative = entry
                        .path()
                        .strip_prefix(&source_dir)
                        .map_err(|e| e.to_string())?;
                    let dest = repo_dir.join(relative);

                    if entry.file_type().is_dir() {
                        fs::create_dir_all(&dest).map_err(|e| e.to_string())?;
                    } else if entry.file_type().is_file() {
                        if let Some(parent) = dest.parent() {
                            fs::create_dir_all(parent).map_err(|e| e.to_string())?;
                        }
                        fs::copy(entry.path(), &dest).map_err(|e| e.to_string())?;
                        files_copied += 1;
                    }
                }
            }

            let chroma_deleted = chroma_path.exists();
            if chroma_deleted {
                fs::remove_dir_all(&chroma_path).map_err(|e| e.to_string())?;
            }

            let _ = watcher::start_watching(app.clone(), repo_dir.clone());
            auto_vectorizer::start_auto_vectorizer(app, repo_dir.clone(), chroma_path);

            Ok(json!({
                "success": true,
                "filesDeleted": files_deleted,
                "filesCopied": files_copied,
                "chromaPurged": chroma_deleted,
                "message": "Repository réinitialisé avec succès"
            }))
        }
        _ => Err(format!("Unsupported action: {action}")),
    }
}

#[tauri::command]
pub fn reset_local_repository(app: AppHandle, repository: Option<String>) -> Result<Value, String> {
    let repo_dir = resolve_repository_path(repository.as_deref());
    let source_dir = resolve_data_path(&app);
    let chroma_path = user_data_root().join("chroma");

    let _ = watcher::stop_watching(&app);

    let mut files_deleted = 0usize;
    if repo_dir.exists() {
        for entry in fs::read_dir(&repo_dir).map_err(|e| e.to_string())? {
            let entry = entry.map_err(|e| e.to_string())?;
            let path = entry.path();
            if path.is_dir() {
                fs::remove_dir_all(&path).map_err(|e| e.to_string())?;
            } else {
                fs::remove_file(&path).map_err(|e| e.to_string())?;
            }
            files_deleted += 1;
        }
    }

    let mut files_copied = 0usize;
    if source_dir.exists() {
        for entry in WalkDir::new(&source_dir).min_depth(1) {
            let entry = entry.map_err(|e| e.to_string())?;
            let relative = entry
                .path()
                .strip_prefix(&source_dir)
                .map_err(|e| e.to_string())?;
            let dest = repo_dir.join(relative);

            if entry.file_type().is_dir() {
                fs::create_dir_all(&dest).map_err(|e| e.to_string())?;
            } else if entry.file_type().is_file() {
                if let Some(parent) = dest.parent() {
                    fs::create_dir_all(parent).map_err(|e| e.to_string())?;
                }
                fs::copy(entry.path(), &dest).map_err(|e| e.to_string())?;
                files_copied += 1;
            }
        }
    }

    let chroma_deleted = chroma_path.exists();
    if chroma_deleted {
        fs::remove_dir_all(&chroma_path).map_err(|e| e.to_string())?;
    }

    let _ = watcher::start_watching(app.clone(), repo_dir.clone());
    auto_vectorizer::start_auto_vectorizer(app, repo_dir.clone(), chroma_path);

    Ok(json!({
        "success": true,
        "filesDeleted": files_deleted,
        "filesCopied": files_copied,
        "chromaPurged": chroma_deleted,
        "message": "Repository réinitialisé avec succès"
    }))
}

fn build_tree(base: &Path, current: &Path) -> Vec<Value> {
    let mut nodes = Vec::new();
    if let Ok(entries) = fs::read_dir(current) {
        for entry in entries.flatten() {
            let path = entry.path();
            let name = entry.file_name().to_string_lossy().to_string();
            let relative = path.strip_prefix(base).unwrap_or(&path);
            let relative_str = relative.to_string_lossy().to_string();

            let metadata = json!({});
            let node = if path.is_dir() {
                json!({
                    "name": name,
                    "path": relative_str,
                    "type": "directory",
                    "children": build_tree(base, &path),
                    "metadata": metadata,
                })
            } else {
                let size = entry.metadata().map(|m| m.len()).unwrap_or(0);
                json!({
                    "name": name,
                    "path": relative_str,
                    "type": "file",
                    "size": size,
                    "metadata": metadata,
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
            _ => a.get("name").and_then(|v| v.as_str()).unwrap_or("").cmp(b.get("name").and_then(|v| v.as_str()).unwrap_or("")),
        }
    });

    nodes
}
