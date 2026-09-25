use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;

#[derive(Serialize, Deserialize)]
struct VercelCredentials {
    email: String,
    password: String,
}

fn credentials_path() -> Result<PathBuf, String> {
    let appdata = std::env::var("APPDATA")
        .map_err(|_| "APPDATA missing".to_string())?;
    let dir = PathBuf::from(appdata).join("NexaFlow");
    fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    Ok(dir.join("vercel-credentials.json"))
}

#[tauri::command]
pub fn save_vercel_credentials(email: String, password: String) -> Result<(), String> {
    let creds = VercelCredentials { email, password };
    let json = serde_json::to_string(&creds).map_err(|e| e.to_string())?;
    fs::write(credentials_path()?, json).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn clear_vercel_credentials() -> Result<(), String> {
    let path = credentials_path()?;
    if path.exists() {
        fs::remove_file(&path).map_err(|e| e.to_string())
    } else {
        Ok(())
    }
}

#[tauri::command]
pub fn has_vercel_credentials() -> bool {
    credentials_path().map(|p| p.exists()).unwrap_or(false)
}

fn get_vercel_credentials() -> Result<VercelCredentials, String> {
    let path = credentials_path()?;
    let json = fs::read_to_string(&path).map_err(|e| e.to_string())?;
    serde_json::from_str(&json).map_err(|e| e.to_string())
}

pub async fn request_inject_token(
    vercel_url: &str,
) -> Result<String, String> {
    let creds = get_vercel_credentials()?;

    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(30))
        .build()
        .map_err(|e| format!("Erreur construction client HTTP: {}", e))?;

    let url = format!(
        "{}/api/tauri-auth/token",
        vercel_url.trim_end_matches('/')
    );

    let resp = client
        .post(&url)
        .json(&serde_json::json!({
            "email": creds.email,
            "password": creds.password,
        }))
        .send()
        .await
        .map_err(|e| format!("HTTP error: {}", e))?;

    if !resp.status().is_success() {
        return Err(format!("Auth failed: {}", resp.status()));
    }

    let body: serde_json::Value = resp
        .json()
        .await
        .map_err(|e| format!("Erreur parsing JSON: {}", e))?;

    body.get("token")
        .and_then(|v| v.as_str())
        .map(|s| s.to_string())
        .ok_or_else(|| "No token in response".to_string())
}
