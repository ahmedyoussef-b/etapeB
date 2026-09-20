use std::fs;
use std::path::{Path, PathBuf};
use serde_json::{json, Value};

fn user_data_root() -> PathBuf {
    PathBuf::from(if cfg!(target_os = "windows") {
        std::env::var("APPDATA")
            .map(|p| format!("{}\\NexaFlow", p))
            .unwrap_or_else(|_| ".".to_string())
    } else {
        ".".to_string()
    })
}

#[tauri::command]
pub fn get_structure_tree(source: String, path: Option<String>, repository: Option<String>) -> Result<Value, String> {
    let base = match source.as_str() {
        "local" => repository
            .filter(|r| !r.is_empty())
            .map(PathBuf::from)
            .unwrap_or_else(|| user_data_root().join(".data")),
        _ => user_data_root().join(".data"),
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
pub fn tree_action(action: String, path: String, _source: String, name: Option<String>, repository: Option<String>) -> Result<Value, String> {
    let base = repository
        .filter(|r| !r.is_empty())
        .map(PathBuf::from)
        .unwrap_or_else(|| user_data_root().join("repository"));

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
        _ => Err(format!("Unsupported action: {action}")),
    }
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
