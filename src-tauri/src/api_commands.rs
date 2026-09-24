use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;
use tauri::AppHandle;

#[allow(dead_code)]
#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct UploadFilePayload {
    pub file_name: String,
    pub relative_path: Option<String>,
    pub base64_data: String,
    pub repository: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct UploadResult {
    pub success: bool,
    pub message: String,
    pub file_path: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct PublishQueueItem {
    pub id: String,
    pub file_name: String,
    pub path: String,
    pub status: String,
    pub author: String,
    pub updated_at: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct PublishQueueResponse {
    pub success: bool,
    pub items: Vec<PublishQueueItem>,
    pub total: usize,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct SyncStatsResponse {
    pub success: bool,
    pub total_records: usize,
    pub last_sync: Option<String>,
    pub pending_sync: usize,
    pub status: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct SystemVersionInfo {
    pub name: String,
    pub version: String,
    pub status: String,
    pub updated_at: String,
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

#[tauri::command]
pub async fn upload_file(
    _app: AppHandle,
    file_name: String,
    destination_path: Option<String>,
    base64_data: String,
    repository: Option<String>,
) -> Result<UploadResult, String> {
    use base64::Engine;

    let bytes = base64::engine::general_purpose::STANDARD
        .decode(&base64_data)
        .map_err(|e| format!("Erreur décodage base64: {}", e))?;

    let base_dir = if let Some(repo) = repository {
        if !repo.is_empty() {
            let p = PathBuf::from(&repo);
            if p.is_absolute() { p } else { user_data_root().join(p) }
        } else {
            user_data_root().join("repository")
        }
    } else {
        user_data_root().join("repository")
    };

    let target_dir = if let Some(dest) = destination_path {
        base_dir.join(dest.trim_start_matches('/'))
    } else {
        base_dir
    };

    fs::create_dir_all(&target_dir)
        .map_err(|e| format!("Impossible de créer le dossier cible: {}", e))?;

    let file_path = target_dir.join(&file_name);
    fs::write(&file_path, &bytes)
        .map_err(|e| format!("Impossible d'écrire le fichier: {}", e))?;

    Ok(UploadResult {
        success: true,
        message: "Fichier enregistré avec succès".to_string(),
        file_path: file_path.to_string_lossy().to_string(),
    })
}

#[tauri::command]
pub async fn reset_web(
    _app: AppHandle,
    vercel_url: String,
    backup: Option<bool>,
) -> Result<serde_json::Value, String> {
    println!("[RESET-WEB-RUST][1] Début");
    println!("[RESET-WEB-RUST][2] URL: {}", vercel_url);
    println!("[RESET-WEB-RUST][3] Backup: {:?}", backup);

    let token = match crate::credentials::request_inject_token(&vercel_url).await {
        Ok(t) => {
            println!("[RESET-WEB-RUST][4] Token obtenu (len={})", t.len());
            t
        }
        Err(e) => {
            eprintln!("[RESET-WEB-RUST][ERROR] Token échoué: {}", e);
            return Err(format!("Token error: {}", e));
        }
    };

    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(30))
        .build()
        .map_err(|e| format!("Erreur construction client HTTP: {}", e))?;

    let url = format!(
        "{}/api/admin/reset",
        vercel_url.trim_end_matches('/')
    );

    let body = serde_json::json!({
        "backup": backup.unwrap_or(false),
    });
    println!("[RESET-WEB-RUST][5] POST {} body={}", url, body);

    let response = client
        .post(&url)
        .header("Authorization", format!("Bearer {}", token))
        .header("Content-Type", "application/json")
        .json(&body)
        .send()
        .await
        .map_err(|e| {
            eprintln!("[RESET-WEB-RUST][ERROR] HTTP échoué: {}", e);
            format!("HTTP error: {}", e)
        })?;

    let status = response.status();
    println!("[RESET-WEB-RUST][6] HTTP status: {}", status);

    let text = response.text().await.unwrap_or_default();
    println!("[RESET-WEB-RUST][7] Response body: {}", text);

    let json: serde_json::Value = serde_json::from_str(&text)
        .map_err(|e| {
            eprintln!("[RESET-WEB-RUST][ERROR] JSON parse: {}", e);
            format!("JSON error: {}", e)
        })?;

    if !status.is_success() {
        let err = json.get("error").and_then(|v| v.as_str()).unwrap_or("Unknown");
        eprintln!("[RESET-WEB-RUST][ERROR] Status: {}, error: {}", status, err);
        return Err(err.to_string());
    }

    println!("[RESET-WEB-RUST][8] SUCCESS");
    Ok(json)
}

#[tauri::command]
pub async fn tree_action_web(
    _app: AppHandle,
    vercel_url: String,
    action: String,
    path: String,
    name: Option<String>,
    repository: Option<String>,
) -> Result<serde_json::Value, String> {
    println!("[TREE-ACTION-RUST][1] Début");
    println!("[TREE-ACTION-RUST][2] URL: {}", vercel_url);
    println!("[TREE-ACTION-RUST][3] action={} path={} name={:?} repository={:?}", action, path, name, repository);

    let token = match crate::credentials::request_inject_token(&vercel_url).await {
        Ok(t) => {
            println!("[TREE-ACTION-RUST][4] Token obtenu (len={})", t.len());
            t
        }
        Err(e) => {
            eprintln!("[TREE-ACTION-RUST][ERROR] Token échoué: {}", e);
            return Err(format!("Token error: {}", e));
        }
    };

    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(30))
        .build()
        .map_err(|e| format!("Erreur construction client HTTP: {}", e))?;

    let url = format!(
        "{}/api/tree-actions",
        vercel_url.trim_end_matches('/')
    );

    let mut body = serde_json::json!({
        "action": action,
        "path": path,
        "source": "web",
    });

    if let Some(name) = name {
        body["name"] = serde_json::Value::String(name);
    }
    if let Some(repository) = repository {
        body["repository"] = serde_json::Value::String(repository);
    }

    println!("[TREE-ACTION-RUST][5] POST {} body={}", url, body);

    let response = client
        .post(&url)
        .header("Authorization", format!("Bearer {}", token))
        .header("Content-Type", "application/json")
        .json(&body)
        .send()
        .await
        .map_err(|e| {
            eprintln!("[TREE-ACTION-RUST][ERROR] HTTP échoué: {}", e);
            format!("HTTP error: {}", e)
        })?;

    let status = response.status();
    println!("[TREE-ACTION-RUST][6] HTTP status: {}", status);

    let text = response.text().await.unwrap_or_default();
    println!("[TREE-ACTION-RUST][7] Response body: {}", text);

    if !status.is_success() {
        eprintln!("[TREE-ACTION-RUST][ERROR] Status: {}, body: {}", status, text);
        return Err(format!("Erreur HTTP {}: {}", status, text));
    }

    let json: serde_json::Value = serde_json::from_str(&text)
        .map_err(|e| {
            eprintln!("[TREE-ACTION-RUST][ERROR] JSON parse: {}", e);
            format!("Erreur parsing JSON: {}", e)
        })?;

    println!("[TREE-ACTION-RUST][8] SUCCESS");
    Ok(json)
}

#[tauri::command]
pub async fn upload_web(
    _app: AppHandle,
    vercel_url: String,
    file_name: String,
    base64_data: String,
    target_path: Option<String>,
) -> Result<serde_json::Value, String> {
    eprintln!("[UPLOAD-WEB-RUST][1] Début file_name={}", file_name);

    let token = match crate::credentials::request_inject_token(&vercel_url).await {
        Ok(t) => {
            eprintln!("[UPLOAD-WEB-RUST][2] Token OK (len={})", t.len());
            t
        }
        Err(e) => {
            eprintln!("[UPLOAD-WEB-RUST][ERROR-TOKEN] {}", e);
            return Err(format!("Token error: {}", e));
        }
    };

    let url = format!("{}/api/upload", vercel_url.trim_end_matches('/'));
    eprintln!("[UPLOAD-WEB-RUST][3] POST {}", url);

    let body = serde_json::json!({
        "file": {
            "name": file_name,
            "base64": base64_data,
        },
        "targetPath": target_path,
        "source": "web",
        "repository": null,
    });

    let client = reqwest::Client::new();
    let response = client
        .post(&url)
        .header("Authorization", format!("Bearer {}", token))
        .header("Content-Type", "application/json")
        .json(&body)
        .send()
        .await
        .map_err(|e| {
            eprintln!("[UPLOAD-WEB-RUST][ERROR-HTTP] {}", e);
            format!("HTTP error: {}", e)
        })?;

    let status = response.status();
    let text = response.text().await.unwrap_or_default();
    eprintln!("[UPLOAD-WEB-RUST][4] HTTP status={} body={}", status, text);

    if !status.is_success() {
        eprintln!("[UPLOAD-WEB-RUST][ERROR-STATUS] {}", status);
        return Err(text);
    }

    let json: serde_json::Value = serde_json::from_str(&text)
        .map_err(|e| format!("JSON error: {}", e))?;

    eprintln!("[UPLOAD-WEB-RUST][5] SUCCESS");
    Ok(json)
}

#[tauri::command]
pub async fn get_publish_queue(
    _page: Option<usize>,
    _limit: Option<usize>,
    _filter: Option<String>,
) -> Result<PublishQueueResponse, String> {
    Ok(PublishQueueResponse {
        success: true,
        items: vec![],
        total: 0,
    })
}

#[tauri::command]
pub async fn get_sync_stats() -> Result<SyncStatsResponse, String> {
    Ok(SyncStatsResponse {
        success: true,
        total_records: 0,
        last_sync: Some(chrono::Utc::now().to_rfc3339()),
        pending_sync: 0,
        status: "synced".to_string(),
    })
}

#[tauri::command]
pub async fn get_system_versions() -> Result<Vec<SystemVersionInfo>, String> {
    Ok(vec![
        SystemVersionInfo {
            name: "NexaFlow Desktop (Tauri)".to_string(),
            version: "0.1.0".to_string(),
            status: "active".to_string(),
            updated_at: chrono::Utc::now().to_rfc3339(),
        },
        SystemVersionInfo {
            name: "Moteur Vectoriel (ONNX)".to_string(),
            version: "all-MiniLM-L6-v2".to_string(),
            status: "active".to_string(),
            updated_at: chrono::Utc::now().to_rfc3339(),
        },
        SystemVersionInfo {
            name: "Base Locale (JSON/Chroma)".to_string(),
            version: "v1.0".to_string(),
            status: "synced".to_string(),
            updated_at: chrono::Utc::now().to_rfc3339(),
        },
    ])
}

#[tauri::command]
pub async fn purge_sync_cache() -> Result<bool, String> {
    let user_path = user_data_root();
    let tmp_dir = user_path.join("tmp");
    if tmp_dir.exists() {
        let _ = fs::remove_dir_all(&tmp_dir);
    }
    Ok(true)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_publish_queue_response_serialization() {
        let resp = PublishQueueResponse {
            success: true,
            items: vec![],
            total: 0,
        };
        let json = serde_json::to_string(&resp).unwrap();
        assert!(json.contains("\"success\":true"));
        assert!(json.contains("\"items\":[]"));
    }

    #[test]
    fn test_sync_stats_response_serialization() {
        let stats = SyncStatsResponse {
            success: true,
            total_records: 12,
            last_sync: Some("2026-09-21T12:00:00Z".to_string()),
            pending_sync: 0,
            status: "synced".to_string(),
        };
        let json = serde_json::to_string(&stats).unwrap();
        assert!(json.contains("\"totalRecords\":12"));
        assert!(json.contains("\"status\":\"synced\""));
    }

    #[tokio::test]
    async fn test_get_system_versions() {
        let versions = get_system_versions().await.unwrap();
        assert_eq!(versions.len(), 3);
        assert_eq!(versions[0].name, "NexaFlow Desktop (Tauri)");
    }
}
