use serde::{Deserialize, Serialize};
use std::fs;
use std::path::{Path, PathBuf};

#[derive(Serialize, Deserialize, Clone, Debug, Default)]
pub struct AppConfig {
    pub groq_api_key: Option<String>,
    pub groq_model: Option<String>,
    pub setup_completed: bool,
    pub setup_completed_at: Option<String>,
}

pub fn user_data_dir() -> PathBuf {
    if cfg!(target_os = "windows") {
        if let Ok(appdata) = std::env::var("APPDATA") {
            return PathBuf::from(appdata).join("NexaFlow");
        }
    }
    PathBuf::from(".")
}

fn config_path() -> PathBuf {
    PathBuf::from(user_data_dir()).join("config.json")
}

fn read_config_at(path: &Path) -> Result<Option<AppConfig>, String> {
    if !path.exists() {
        return Ok(None);
    }
    let content = fs::read_to_string(path)
        .map_err(|e| format!("Impossible de lire config.json: {}", e))?;
    let config: AppConfig = serde_json::from_str(&content)
        .map_err(|e| format!("config.json corrompu: {}", e))?;
    Ok(Some(config))
}

fn write_config_at(path: &Path, config: &AppConfig) -> Result<(), String> {
    let parent = path.parent().unwrap_or(Path::new("."));
    fs::create_dir_all(parent)
        .map_err(|e| format!("Impossible de créer {}: {}", parent.display(), e))?;
    let content = serde_json::to_string_pretty(config)
        .map_err(|e| format!("Impossible de sérialiser: {}", e))?;
    fs::write(path, content)
        .map_err(|e| format!("Impossible d'écrire config.json: {}", e))?;
    Ok(())
}

fn delete_config_at(path: &Path) -> Result<(), String> {
    if path.exists() {
        fs::remove_file(path)
            .map_err(|e| format!("Impossible de supprimer config.json: {}", e))?;
    }
    Ok(())
}

#[tauri::command]
pub fn read_config(app: tauri::AppHandle) -> Result<Option<AppConfig>, String> {
    let _ = app;
    let path = config_path();
    read_config_at(&path)
}

#[tauri::command]
pub fn write_config(app: tauri::AppHandle, config: AppConfig) -> Result<(), String> {
    let _ = app;
    let path = config_path();
    write_config_at(&path, &config)
}

#[tauri::command]
pub fn delete_config(app: tauri::AppHandle) -> Result<(), String> {
    let _ = app;
    let path = config_path();
    delete_config_at(&path)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn test_config_path() -> PathBuf {
        use std::sync::atomic::{AtomicU64, Ordering};
        static COUNTER: AtomicU64 = AtomicU64::new(0);
        let n = COUNTER.fetch_add(1, Ordering::Relaxed);
        std::env::temp_dir().join(format!("nexaflow_test_{}.json", n))
    }

    fn cleanup(path: &Path) {
        let _ = fs::remove_file(path);
    }

    #[test]
    fn test_read_config_absent() {
        let path = test_config_path();
        cleanup(&path);
        let result = read_config_at(&path).unwrap();
        assert!(result.is_none(), "Attendu: None pour fichier absent");
    }

    #[test]
    fn test_read_config_valid() {
        let path = test_config_path();
        cleanup(&path);

        let config = AppConfig {
            groq_api_key: Some("test-key-123".to_string()),
            groq_model: Some("openai/gpt-oss-120b".to_string()),
            setup_completed: true,
            setup_completed_at: Some("2026-09-17T01:30:00Z".to_string()),
        };
        write_config_at(&path, &config).unwrap();

        let result = read_config_at(&path).unwrap();
        assert!(result.is_some(), "Attendu: Some pour fichier valide");
        let result = result.unwrap();
        assert_eq!(result.groq_api_key, Some("test-key-123".to_string()));
        assert_eq!(result.groq_model, Some("openai/gpt-oss-120b".to_string()));
        assert!(result.setup_completed);
        assert_eq!(
            result.setup_completed_at,
            Some("2026-09-17T01:30:00Z".to_string())
        );

        cleanup(&path);
    }

    #[test]
    fn test_read_config_corrupted() {
        let path = test_config_path();
        cleanup(&path);
        fs::write(&path, "not-valid-json{{{").unwrap();

        let result = read_config_at(&path);
        assert!(result.is_err(), "Attendu: erreur pour JSON corrompu");
        let err_msg = result.err().unwrap();
        assert!(
            err_msg.contains("corrompu"),
            "Message devrait contenir 'corrompu', got: {}",
            err_msg
        );

        cleanup(&path);
    }

    #[test]
    fn test_write_config_basic() {
        let path = test_config_path();
        cleanup(&path);

        let config = AppConfig {
            groq_api_key: Some("gsk_test".to_string()),
            groq_model: Some("llama-3.3-70b-versatile".to_string()),
            setup_completed: false,
            setup_completed_at: None,
        };
        let result = write_config_at(&path, &config);
        assert!(result.is_ok(), "write_config_at échoué: {:?}", result);
        assert!(path.exists(), "Le fichier devrait exister après écriture");

        cleanup(&path);
    }

    #[test]
    fn test_write_config_partial_fields() {
        let path = test_config_path();
        cleanup(&path);

        let config = AppConfig::default();
        write_config_at(&path, &config).unwrap();

        let result = read_config_at(&path).unwrap();
        assert!(result.is_some());
        let result = result.unwrap();
        assert_eq!(result.groq_api_key, None);
        assert_eq!(result.groq_model, None);
        assert!(!result.setup_completed);
        assert_eq!(result.setup_completed_at, None);

        cleanup(&path);
    }

    #[test]
    fn test_write_config_roundtrip() {
        let path = test_config_path();
        cleanup(&path);

        let original = AppConfig {
            groq_api_key: Some("roundtrip-key".to_string()),
            groq_model: Some("deepseek-r1-distill-llama-70b".to_string()),
            setup_completed: true,
            setup_completed_at: Some("2026-01-15T12:00:00Z".to_string()),
        };
        write_config_at(&path, &original).unwrap();
        let restored = read_config_at(&path).unwrap().unwrap();

        assert_eq!(original.groq_api_key, restored.groq_api_key);
        assert_eq!(original.groq_model, restored.groq_model);
        assert_eq!(original.setup_completed, restored.setup_completed);
        assert_eq!(original.setup_completed_at, restored.setup_completed_at);

        cleanup(&path);
    }

    #[test]
    fn test_delete_config_existent() {
        let path = test_config_path();
        cleanup(&path);

        write_config_at(&path, &AppConfig::default()).unwrap();
        assert!(path.exists());

        let result = delete_config_at(&path);
        assert!(result.is_ok(), "delete_config_at échoué: {:?}", result);
        assert!(!path.exists(), "Le fichier devrait être supprimé");
    }

    #[test]
    fn test_delete_config_absent() {
        let path = test_config_path();
        cleanup(&path);

        let result = delete_config_at(&path);
        assert!(
            result.is_ok(),
            "delete_config_at devrait réussir même si fichier absent"
        );
    }

    #[test]
    fn test_config_serialization() {
        let config = AppConfig {
            groq_api_key: Some("key".to_string()),
            groq_model: Some("model".to_string()),
            setup_completed: true,
            setup_completed_at: Some("2026-09-17T00:00:00Z".to_string()),
        };

        let json = serde_json::to_string_pretty(&config).unwrap();
        let deserialized: AppConfig = serde_json::from_str(&json).unwrap();

        assert_eq!(config.groq_api_key, deserialized.groq_api_key);
        assert_eq!(config.groq_model, deserialized.groq_model);
        assert_eq!(config.setup_completed, deserialized.setup_completed);
        assert_eq!(config.setup_completed_at, deserialized.setup_completed_at);
    }

    #[test]
    fn test_app_data_dir_windows() {
        let path = user_data_dir();
        if cfg!(target_os = "windows") {
            assert!(
                path.to_string_lossy().contains("NexaFlow"),
                "Sur Windows, app_data_dir devrait contenir NexaFlow, got: {}",
                path.display()
            );
        }
    }

    #[test]
    fn test_config_path_ends_with_config_json() {
        let path = config_path();
        assert!(
            path.to_string_lossy().ends_with("config.json"),
            "config_path devrait se terminer par config.json, got: {}",
            path.display()
        );
    }
}
