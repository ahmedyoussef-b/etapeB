use log::{info, error};
use std::fs;
use std::io::{Read, Write};
use std::path::{Path, PathBuf};
use serde_json::{json, Value};
use tauri::{AppHandle, Manager};
use walkdir::WalkDir;
use zip::write::FileOptions;
use zip::ZipWriter;

use crate::watcher;

pub const MANDATORY_ROOTS: &[&str] = &[
    "Centrale", "Groupes", "bank", "documents",
    "indexes", "library", "registry", "system",
];

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
    log::info!("[SDB-RUST-TREE] ENTRÉE source={:?} path={:?}", source, path);
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
    log::info!("[SDB-RUST-TREE] base résolu: {:?} existe: {}", base, base.exists());

    let target = if let Some(p) = &path {
        let clean = p.trim_start_matches(['/', '\\']);
        let t = if clean.is_empty() { base.clone() } else { base.join(clean) };
        log::info!("[SDB-RUST-TREE] target={:?} existe: {}", t, t.exists());
        t
    } else {
        base.clone()
    };

    if !target.exists() {
        log::info!("[SDB-RUST-TREE] get_structure_tree target missing -> empty tree target={}", target.display());
        return Ok(json!({
            "success": true,
            "data": [],
            "sourceUsed": source,
        }));
    }

    let nodes = build_tree(&base, &target);
    let root_names: Vec<String> = nodes.iter().filter_map(|n| n.get("name").and_then(|v| v.as_str()).map(|s| s.to_string())).collect();
    log::info!("[SDB-RUST-TREE] {} noeuds retournés target={} racines={:?}", nodes.len(), target.display(), root_names);
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
pub fn tree_action(app: AppHandle, action: String, path: String, source: String, name: Option<String>, repository: Option<String>) -> Result<Value, String> {
    if source != "local" {
        return Err(format!(
            "En mode desktop, seules les mutations de la source 'local' sont autorisées. \
             Les mutations Web passent par l'API Vercel. Source reçue: '{}'",
            source
        ));
    }

    let base = resolve_repository_path(repository.as_deref());

    let target = base.join(&path);

    match action.as_str() {
        "rename" => {
            let new_name = name.filter(|n| !n.is_empty()).ok_or("missing name")?;
            let new_path = target.parent().map(|p| p.join(&new_name)).unwrap_or(PathBuf::from(&new_name));
            let old_rel = crate::vectorizer::extract_relative_path(&target);
            fs::rename(&target, &new_path).map_err(|e| e.to_string())?;
            if let Err(e) = crate::vectorizer::delete_from_chroma_internal(&app, &old_rel) {
                log::warn!("[tree_action/rename] chroma delete failed: {}", e);
            }
            let app_clone = app.clone();
            let new_path_clone = new_path.clone();
            tauri::async_runtime::spawn(async move {
                if let Err(e) = crate::vectorizer::vectorize_single_file_internal(&app_clone, &new_path_clone).await {
                    log::warn!("[tree_action/rename] chroma vectorize failed: {}", e);
                }
            });
            Ok(json!({"success": true}))
        }
        "delete" => {
            if target.is_dir() {
                fs::remove_dir_all(&target).map_err(|e| e.to_string())?;
            } else {
                fs::remove_file(&target).map_err(|e| e.to_string())?;
            }
            let rel_path = crate::vectorizer::extract_relative_path(&target);
            if let Err(e) = crate::vectorizer::delete_from_chroma_internal(&app, &rel_path) {
                log::warn!("[tree_action/delete] chroma sync failed: {}", e);
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
            let mut dirs_created = 0usize;
            if source_dir.exists() {
                let _ = create_all_dirs(&source_dir, &repo_dir, &mut dirs_created);
            }
            if source_dir.exists() {
                for entry in WalkDir::new(&source_dir).min_depth(1) {
                    let entry = entry.map_err(|e| e.to_string())?;
                    let relative = entry
                        .path()
                        .strip_prefix(&source_dir)
                        .map_err(|e| e.to_string())?;
                    let dest = repo_dir.join(relative);

                    if entry.file_type().is_dir() {
                        continue;
                    } else if entry.file_type().is_file() {
                        if let Some(parent) = dest.parent() {
                            fs::create_dir_all(parent).map_err(|e| e.to_string())?;
                        }
                        fs::copy(entry.path(), &dest).map_err(|e| e.to_string())?;
                        files_copied += 1;
                    }
                }
            }
            log::info!("[SDB-RUST-RESET] tree_action resetFromData fichiers copiés={} dossiers créés={}", files_copied, dirs_created);
            if let Ok(entries) = fs::read_dir(&repo_dir) {
                let roots: Vec<String> = entries.flatten().filter_map(|e| e.path().file_name().and_then(|n| n.to_str().map(|s| s.to_string()))).collect();
                log::info!("[SDB-RUST-RESET] tree_action resetFromData repository racines={:?}", roots);
            }

            for root in MANDATORY_ROOTS {
                let path = repo_dir.join(root);
                if let Err(e) = fs::create_dir_all(&path) {
                    log::warn!("[SDB-RUST-RESET] impossible de créer {:?}: {}", path, e);
                } else {
                    log::info!("[SDB-RUST-RESET] racine garantie: {:?}", path);
                }
            }

            let registry_items = repo_dir.join("registry").join("items");
            if let Err(e) = fs::create_dir_all(&registry_items) {
                log::warn!("[SDB-RUST-RESET] impossible de créer registry/items: {}", e);
            } else {
                log::info!("[SDB-RUST-RESET] registry/items garantie: {:?}", registry_items);
            }

            let chroma_deleted = chroma_path.exists();
            if chroma_deleted {
                fs::remove_dir_all(&chroma_path).map_err(|e| e.to_string())?;
            }

            let _ = watcher::start_watching(app.clone(), repo_dir.clone());

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
    log::info!("[SDB-RUST] reset_local_repository ENTRÉE repo={} source={}", repo_dir.display(), source_dir.display());

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
    log::info!("[SDB-RUST] reset_local_repository fichiers supprimés={}", files_deleted);

    let mut files_copied = 0usize;
    let mut dirs_created = 0usize;

    if source_dir.exists() {
        let _ = create_all_dirs(&source_dir, &repo_dir, &mut dirs_created);
    }

    if source_dir.exists() {
        for entry in WalkDir::new(&source_dir).min_depth(1) {
            let entry = entry.map_err(|e| e.to_string())?;
            let relative = entry
                .path()
                .strip_prefix(&source_dir)
                .map_err(|e| e.to_string())?;
            let dest = repo_dir.join(relative);

            if entry.file_type().is_dir() {
                continue;
            } else if entry.file_type().is_file() {
                if let Some(parent) = dest.parent() {
                    fs::create_dir_all(parent).map_err(|e| e.to_string())?;
                }
                fs::copy(entry.path(), &dest).map_err(|e| e.to_string())?;
                files_copied += 1;
            }
        }
    }
    log::info!("[SDB-RUST-RESET] reset_local_repository fichiers copiés={} dossiers créés={}", files_copied, dirs_created);
    if let Ok(entries) = fs::read_dir(&repo_dir) {
        let roots: Vec<String> = entries.flatten().filter_map(|e| e.path().file_name().and_then(|n| n.to_str().map(|s| s.to_string()))).collect();
        log::info!("[SDB-RUST-RESET] reset_local_repository repository racines={:?}", roots);
    }

    for root in MANDATORY_ROOTS {
        let path = repo_dir.join(root);
        if let Err(e) = fs::create_dir_all(&path) {
            log::warn!("[SDB-RUST-RESET] impossible de créer {:?}: {}", path, e);
        } else {
            log::info!("[SDB-RUST-RESET] racine garantie: {:?}", path);
        }
    }

    let registry_items = repo_dir.join("registry").join("items");
    if let Err(e) = fs::create_dir_all(&registry_items) {
        log::warn!("[SDB-RUST-RESET] impossible de créer registry/items: {}", e);
    } else {
        log::info!("[SDB-RUST-RESET] registry/items garantie: {:?}", registry_items);
    }

    let chroma_deleted = chroma_path.exists();
    if chroma_deleted {
        fs::remove_dir_all(&chroma_path).map_err(|e| e.to_string())?;
    }

    let _ = watcher::start_watching(app.clone(), repo_dir.clone());

    log::info!("[SDB-RUST] reset_local_repository SORTIE success=true deleted={} copied={} chroma={}", files_deleted, files_copied, chroma_deleted);
    Ok(json!({
        "success": true,
        "filesDeleted": files_deleted,
        "filesCopied": files_copied,
        "chromaPurged": chroma_deleted,
        "message": "Repository réinitialisé avec succès"
    }))
}

#[tauri::command]
pub fn create_backup(repository: Option<String>) -> Result<String, String> {
    let repo_dir = resolve_repository_path(repository.as_deref());
    if !repo_dir.exists() {
        return Err("Le répertoire repository n'existe pas".to_string());
    }

    let backups_dir = user_data_root().join("backups");
    fs::create_dir_all(&backups_dir).map_err(|e| format!("Impossible de créer le dossier backups: {}", e))?;

    let timestamp = chrono::Local::now().format("%Y%m%d-%H%M%S");
    let zip_name = format!("backup-{}.zip", timestamp);
    let zip_path = backups_dir.join(&zip_name);

    let file = fs::File::create(&zip_path).map_err(|e| format!("Impossible de créer le zip: {}", e))?;
    let mut zip = ZipWriter::new(file);
    let mut buffer = Vec::new();

    for entry in WalkDir::new(&repo_dir).min_depth(1) {
        let entry = entry.map_err(|e| format!("Erreur walkdir: {}", e))?;
        let relative = entry.path().strip_prefix(&repo_dir).map_err(|e| format!("Erreur strip_prefix: {}", e))?;
        let entry_path = relative.to_string_lossy().replace("\\", "/");

        if entry.file_type().is_dir() {
            continue;
        } else if entry.file_type().is_file() {
            let mut f = fs::File::open(entry.path()).map_err(|e| format!("Impossible d'ouvrir le fichier: {}", e))?;
            f.read_to_end(&mut buffer).map_err(|e| format!("Erreur lecture: {}", e))?;
            zip.start_file(entry_path, FileOptions::<()>::default()).map_err(|e| format!("Erreur start_file: {}", e))?;
            zip.write_all(&buffer).map_err(|e| format!("Erreur write_all: {}", e))?;
            buffer.clear();
        }
    }

    zip.finish().map_err(|e| format!("Erreur finish zip: {}", e))?;

    let mut backup_files: Vec<_> = fs::read_dir(&backups_dir)
        .map_err(|e| format!("Impossible de lister backups: {}", e))?
        .filter_map(|e| e.ok())
        .filter(|e| e.path().extension().map(|ext| ext == "zip").unwrap_or(false))
        .collect();

    backup_files.sort_by(|a, b| b.file_name().cmp(&a.file_name()));

    for old_backup in backup_files.iter().skip(5) {
        let _ = fs::remove_file(old_backup.path());
    }

    Ok(zip_path.to_string_lossy().to_string())
}

fn create_all_dirs(src: &Path, dst: &Path, dirs_created: &mut usize) -> Result<(), String> {
    for entry in fs::read_dir(src).map_err(|e| e.to_string())? {
        let entry = entry.map_err(|e| e.to_string())?;
        let dest = dst.join(entry.file_name());
        let ft = entry.file_type().map_err(|e| e.to_string())?;
        if ft.is_dir() {
            fs::create_dir_all(&dest).map_err(|e| e.to_string())?;
            *dirs_created += 1;
            create_all_dirs(&entry.path(), &dest, dirs_created)?;
        }
    }
    Ok(())
}

fn build_tree(base: &Path, current: &Path) -> Vec<Value> {
    let mut nodes = Vec::new();
    if let Ok(entries) = fs::read_dir(current) {
        for entry in entries.flatten() {
            let path = entry.path();
            let name = entry.file_name().to_string_lossy().to_string();
            if name.starts_with('.') && name != ".meta.json" {
                continue;
            }
            let relative = path.strip_prefix(base).unwrap_or(&path);
            let relative_str = relative.to_string_lossy().replace('\\', "/");

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
