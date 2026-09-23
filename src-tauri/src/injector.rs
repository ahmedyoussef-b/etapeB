use reqwest::Client;
use serde::{Deserialize, Serialize};
use std::path::{Path, PathBuf};
use std::fs;
use tauri::{AppHandle, Emitter};
use crate::_get_user_data_path;

#[derive(Debug, Deserialize, Clone)]
struct WebFileInfo {
    path: String,
}

#[derive(Debug, Serialize)]
pub struct InjectReport {
    pub injected: usize,
    pub conflicts: usize,
    pub errors: Vec<String>,
    pub skipped: usize,
}

fn repo_dir() -> PathBuf {
    PathBuf::from(_get_user_data_path()).join("repository")
}

fn versioned_path(repo: &Path, rel_path: &str) -> (PathBuf, bool) {
    let target = repo.join(rel_path);
    if !target.exists() {
        return (target, false);
    }

    let parent = match target.parent() {
        Some(p) => p,
        None => return (target, true),
    };

    let stem = match target.file_stem().and_then(|s| s.to_str()) {
        Some(s) => s,
        None => return (target, true),
    };
    let ext = target.extension().and_then(|s| s.to_str());

    let version_dir = parent.join(stem);
    let _ = fs::create_dir_all(&version_dir);

    let v1_name = match ext {
        Some(e) => format!("{}_1.{}", stem, e),
        None => format!("{}_1", stem),
    };
    let v1_path = version_dir.join(&v1_name);
    if !v1_path.exists() {
        let _ = fs::rename(&target, &v1_path);
    }

    let mut index = 2usize;
    loop {
        let version_name = match ext {
            Some(e) => format!("{}_{}.{}", stem, index, e),
            None => format!("{}_{}", stem, index),
        };
        let candidate = version_dir.join(&version_name);
        if !candidate.exists() {
            return (candidate, true);
        }
        index += 1;
    }
}

async fn download_file(client: &Client, base_url: &str, token: &str, rel_path: &str) -> Result<Vec<u8>, String> {
    let url = format!(
        "{}/api/web-files/download?path={}",
        base_url,
        urlencoding::encode(rel_path)
    );

    let response = client
        .get(&url)
        .header("Authorization", format!("Bearer {}", token))
        .send()
        .await
        .map_err(|e| format!("Erreur réseau pour {}: {}", rel_path, e))?;

    if !response.status().is_success() {
        return Err(format!(
            "Erreur HTTP {} pour {}",
            response.status(),
            rel_path
        ));
    }

    response
        .bytes()
        .await
        .map(|b| b.to_vec())
        .map_err(|e| format!("Erreur lecture binaire pour {}: {}", rel_path, e))
}

#[tauri::command]
pub async fn inject_from_web(
    app: AppHandle,
    vercel_url: String,
) -> Result<InjectReport, String> {
    let token = crate::credentials::request_inject_token(&vercel_url).await?;

    let client = Client::builder()
        .timeout(std::time::Duration::from_secs(30))
        .build()
        .map_err(|e| format!("Erreur construction client HTTP: {}", e))?;

    let list_url = format!("{}/api/web-files", vercel_url);
    let list_response = client
        .get(&list_url)
        .header("Authorization", format!("Bearer {}", token))
        .send()
        .await
        .map_err(|e| format!("Erreur réseau lors du listing: {}", e))?;

    if !list_response.status().is_success() {
        return Err(format!(
            "Erreur HTTP {} lors du listing",
            list_response.status()
        ));
    }

    let payload: serde_json::Value = list_response
        .json()
        .await
        .map_err(|e| format!("Erreur parsing JSON listing: {}", e))?;

    let files: Vec<WebFileInfo> = serde_json::from_value(payload["files"].clone())
        .map_err(|e| format!("Erreur déserialisation fichiers: {}", e))?;

    let total = files.len();
    if total == 0 {
        return Ok(InjectReport {
            injected: 0,
            conflicts: 0,
            errors: vec![],
            skipped: 0,
        });
    }

    let repo = repo_dir();
    let mut report = InjectReport {
        injected: 0,
        conflicts: 0,
        errors: vec![],
        skipped: 0,
    };

    let mut marked_paths: Vec<String> = Vec::with_capacity(total);

    for (index, file) in files.iter().enumerate() {
        let current = index + 1;
        let _ = app.emit(
            "inject-progress",
            serde_json::json!({
                "current": current,
                "total": total,
                "path": file.path,
            }),
        );

        match download_file(&client, &vercel_url, &token, &file.path).await {
            Ok(bytes) => {
                let target_rel = &file.path;
                let target_abs = repo.join(target_rel);

                if let Some(parent) = target_abs.parent() {
                    if let Err(e) = fs::create_dir_all(parent) {
                        report.errors.push(format!(
                            "Impossible de créer {}: {}",
                            parent.display(),
                            e
                        ));
                        report.skipped += 1;
                        continue;
                    }
                }

                let (final_path, is_conflict) = versioned_path(&repo, target_rel);

                if is_conflict {
                    report.conflicts += 1;
                }

                if let Err(e) = fs::write(&final_path, bytes) {
                    report.errors.push(format!(
                        "Impossible d'écrire {}: {}",
                        final_path.display(),
                        e
                    ));
                    report.skipped += 1;
                    continue;
                }

                if target_abs.exists() {
                    if let Err(e) = fs::remove_file(&target_abs) {
                        log::warn!("[inject] failed to remove original {}: {}", target_abs.display(), e);
                    }
                }

                report.injected += 1;
                marked_paths.push(file.path.clone());
            }
            Err(e) => {
                report.errors.push(e);
                report.skipped += 1;
            }
        }
    }

    if !marked_paths.is_empty() {
        let mark_url = format!("{}/api/web-files/mark-injected", vercel_url);
        let _ = client
            .post(&mark_url)
            .header("Authorization", format!("Bearer {}", token))
            .header("Content-Type", "application/json")
            .json(&serde_json::json!({ "paths": marked_paths }))
            .send()
            .await;
    }

    let _ = app.emit(
        "inject-complete",
        serde_json::json!({
            "injected": report.injected,
            "conflicts": report.conflicts,
            "errors": report.errors.len(),
        }),
    );

    Ok(report)
}
