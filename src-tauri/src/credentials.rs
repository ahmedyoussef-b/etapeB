use keyring::Entry;
use serde::{Deserialize, Serialize};

const SERVICE_NAME: &str = "com.nexaflow.app";
const USERNAME: &str = "vercel";

#[derive(Serialize, Deserialize)]
struct VercelCredentials {
    email: String,
    password: String,
}

fn entry() -> Result<Entry, String> {
    Entry::new(SERVICE_NAME, USERNAME).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn save_vercel_credentials(email: String, password: String) -> Result<(), String> {
    let creds = VercelCredentials { email, password };
    let json = serde_json::to_string(&creds).map_err(|e| e.to_string())?;
    entry()?.set_password(&json).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn clear_vercel_credentials() -> Result<(), String> {
    entry()?.delete_credential().map_err(|e| e.to_string())
}

#[tauri::command]
pub fn has_vercel_credentials() -> bool {
    entry()
        .ok()
        .and_then(|e| e.get_password().ok())
        .is_some()
}

fn get_vercel_credentials() -> Result<VercelCredentials, String> {
    let json = entry()?.get_password().map_err(|e| e.to_string())?;
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
