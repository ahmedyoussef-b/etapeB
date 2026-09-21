use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::fs;
use std::path::{Path, PathBuf};
use std::time::Instant;
use tauri::{AppHandle, Manager};
use walkdir::WalkDir;

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct InitResult {
    pub success: bool,
    pub initialized: bool,
    pub message: String,
}

#[allow(dead_code)]
#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct SyncFile {
    pub path: String,
    pub hash: String,
    pub size: u64,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct SyncResult {
    pub success: bool,
    pub copied: usize,
    pub deduplicated: usize,
    pub errors: usize,
    pub total: usize,
    pub duration_ms: u64,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct SyncStatus {
    pub aligned: bool,
    pub local_count: usize,
    pub web_count: usize,
    pub missing_in_db: Vec<String>,
    pub extra_in_db: Vec<String>,
}

fn user_data_root() -> PathBuf {
    PathBuf::from(if cfg!(target_os = "windows") {
        std::env::var("APPDATA")
            .map(|p| format!("{}\\NexaFlow", p))
            .unwrap_or_else(|_| ".".to_string())
    } else {
        ".".to_string()
    })
}

fn resolve_repository_dir(repository: Option<&str>) -> PathBuf {
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

fn resolve_source_data_dir(app: &AppHandle) -> PathBuf {
    let appdata_data = user_data_root().join(".data");
    if appdata_data.exists() {
        return appdata_data;
    }

    if let Ok(res_dir) = app.path().resource_dir() {
        let res_data = res_dir.join(".data");
        if res_data.exists() {
            return res_data;
        }
    }

    appdata_data
}

fn compute_file_hash(path: &Path) -> Result<String, std::io::Error> {
    let bytes = fs::read(path)?;
    let mut hasher = Sha256::new();
    hasher.update(&bytes);
    Ok(hex::encode(hasher.finalize()))
}

#[tauri::command]
pub async fn init_app(app: AppHandle) -> Result<InitResult, String> {
    let repo_dir = resolve_repository_dir(None);
    let _ = fs::create_dir_all(&repo_dir);

    // Initialiser les données depuis .data si vide
    let source_data = resolve_source_data_dir(&app);
    let mut initialized = false;

    let is_empty = match fs::read_dir(&repo_dir) {
        Ok(mut entries) => entries.next().is_none(),
        Err(_) => true,
    };

    if is_empty && source_data.exists() {
        println!("[sync::init_app] Initialisation repository depuis {}", source_data.display());
        for entry in WalkDir::new(&source_data).min_depth(1) {
            if let Ok(entry) = entry {
                let relative = match entry.path().strip_prefix(&source_data) {
                    Ok(r) => r,
                    Err(_) => continue,
                };
                let dest = repo_dir.join(relative);

                if entry.file_type().is_dir() {
                    let _ = fs::create_dir_all(&dest);
                } else if entry.file_type().is_file() {
                    if let Some(parent) = dest.parent() {
                        let _ = fs::create_dir_all(parent);
                    }
                    let _ = fs::copy(entry.path(), &dest);
                }
            }
        }
        initialized = true;
    }

    Ok(InitResult {
        success: true,
        initialized: true,
        message: if initialized {
            "Repository initialisé avec succès depuis les données sources".to_string()
        } else {
            "Repository prêt et opérationnel".to_string()
        },
    })
}

#[tauri::command]
pub async fn sync_from_web(
    app: AppHandle,
    _mode: String,
    repository: Option<String>,
    force: bool,
) -> Result<SyncResult, String> {
    let start_time = Instant::now();
    let target_dir = resolve_repository_dir(repository.as_deref());
    let source_dir = resolve_source_data_dir(&app);

    let _ = fs::create_dir_all(&target_dir);

    let mut copied = 0usize;
    let mut deduplicated = 0usize;
    let mut errors = 0usize;
    let mut total = 0usize;

    if !source_dir.exists() {
        return Ok(SyncResult {
            success: true,
            copied: 0,
            deduplicated: 0,
            errors: 0,
            total: 0,
            duration_ms: start_time.elapsed().as_millis() as u64,
        });
    }

    for entry in WalkDir::new(&source_dir).min_depth(1) {
        let entry = match entry {
            Ok(e) => e,
            Err(_) => {
                errors += 1;
                continue;
            }
        };

        if !entry.file_type().is_file() {
            continue;
        }

        total += 1;
        let relative = match entry.path().strip_prefix(&source_dir) {
            Ok(r) => r,
            Err(_) => {
                errors += 1;
                continue;
            }
        };

        let dest = target_dir.join(relative);

        if dest.exists() && !force {
            let src_hash = compute_file_hash(entry.path()).unwrap_or_default();
            let dest_hash = compute_file_hash(&dest).unwrap_or_default();

            if !src_hash.is_empty() && src_hash == dest_hash {
                deduplicated += 1;
                continue;
            }
        }

        if let Some(parent) = dest.parent() {
            if let Err(_) = fs::create_dir_all(parent) {
                errors += 1;
                continue;
            }
        }

        match fs::copy(entry.path(), &dest) {
            Ok(_) => copied += 1,
            Err(_) => errors += 1,
        }
    }

    let duration_ms = start_time.elapsed().as_millis() as u64;

    Ok(SyncResult {
        success: errors == 0,
        copied,
        deduplicated,
        errors,
        total,
        duration_ms,
    })
}

#[tauri::command]
pub async fn sync_status(
    app: AppHandle,
    repository: Option<String>,
) -> Result<SyncStatus, String> {
    let target_dir = resolve_repository_dir(repository.as_deref());
    let source_dir = resolve_source_data_dir(&app);

    let mut local_files: Vec<String> = vec![];
    let mut web_files: Vec<String> = vec![];

    if target_dir.exists() {
        for entry in WalkDir::new(&target_dir).min_depth(1).into_iter().flatten() {
            if entry.file_type().is_file() {
                if let Ok(rel) = entry.path().strip_prefix(&target_dir) {
                    local_files.push(rel.to_string_lossy().replace('\\', "/"));
                }
            }
        }
    }

    if source_dir.exists() {
        for entry in WalkDir::new(&source_dir).min_depth(1).into_iter().flatten() {
            if entry.file_type().is_file() {
                if let Ok(rel) = entry.path().strip_prefix(&source_dir) {
                    web_files.push(rel.to_string_lossy().replace('\\', "/"));
                }
            }
        }
    }

    let local_set: std::collections::HashSet<_> = local_files.iter().cloned().collect();
    let web_set: std::collections::HashSet<_> = web_files.iter().cloned().collect();

    let missing_in_db: Vec<String> = local_files
        .iter()
        .filter(|f| !web_set.contains(*f))
        .cloned()
        .collect();

    let extra_in_db: Vec<String> = web_files
        .iter()
        .filter(|f| !local_set.contains(*f))
        .cloned()
        .collect();

    let aligned = missing_in_db.is_empty() && extra_in_db.is_empty();

    Ok(SyncStatus {
        aligned,
        local_count: local_files.len(),
        web_count: web_files.len(),
        missing_in_db,
        extra_in_db,
    })
}

#[tauri::command]
pub async fn sync_progress(_app: AppHandle) -> Result<Vec<String>, String> {
    Ok(vec![])
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_sync_result_serialization() {
        let res = SyncResult {
            success: true,
            copied: 5,
            deduplicated: 10,
            errors: 0,
            total: 15,
            duration_ms: 120,
        };
        let json = serde_json::to_string(&res).unwrap();
        assert!(json.contains("\"copied\":5"));
        assert!(json.contains("\"deduplicated\":10"));
    }

    #[test]
    fn test_sync_status_aligned() {
        let status = SyncStatus {
            aligned: true,
            local_count: 20,
            web_count: 20,
            missing_in_db: vec![],
            extra_in_db: vec![],
        };
        assert!(status.aligned);
        assert_eq!(status.local_count, 20);
    }
}
