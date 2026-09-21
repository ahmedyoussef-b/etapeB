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
