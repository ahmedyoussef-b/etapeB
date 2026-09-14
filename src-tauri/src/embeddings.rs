use serde_json::json;

pub fn get_gemini_api_key() -> Result<String, String> {
    if let Ok(key) = std::env::var("GEMINI_API_KEY") {
        if !key.trim().is_empty() {
            return Ok(key.trim().to_string());
        }
    }

    // Tenter de lire depuis .env ou .env.local
    let possible_paths = [
        std::path::PathBuf::from(".env.local"),
        std::path::PathBuf::from(".env"),
        std::path::PathBuf::from("../.env.local"),
        std::path::PathBuf::from("../.env"),
    ];

    for path in &possible_paths {
        if let Ok(content) = std::fs::read_to_string(path) {
            for line in content.lines() {
                let trimmed = line.trim();
                if trimmed.starts_with("GEMINI_API_KEY=") {
                    let val = trimmed["GEMINI_API_KEY=".len()..].trim().trim_matches('"').trim_matches('\'');
                    if !val.is_empty() {
                        return Ok(val.to_string());
                    }
                }
            }
        }
    }

    // Fallback direct
    Ok("AIzaSyCJ8Ipa_lgPhispOO1WjyNirE8lak13iQQ".to_string())
}

pub async fn generate_embedding(text: &str) -> Result<Vec<f32>, String> {
    let api_key = get_gemini_api_key()?;
    let url = "https://generativelanguage.googleapis.com/v1beta/models/text-embedding-004:embedContent";

    let client = reqwest::Client::new();
    let response = client
        .post(format!("{}?key={}", url, api_key))
        .json(&json!({
            "content": {
                "parts": [{ "text": text }]
            }
        }))
        .send()
        .await
        .map_err(|e| format!("Erreur réseau embedding: {}", e))?;

    if !response.status().is_success() {
        let status = response.status();
        let body = response.text().await.unwrap_or_default();
        return Err(format!("Erreur API Embedding {}: {}", status, body));
    }

    let data: serde_json::Value = response
        .json()
        .await
        .map_err(|e| format!("Erreur parsing JSON embedding: {}", e))?;

    let values = data["embedding"]["values"]
        .as_array()
        .ok_or_else(|| "Structure de réponse d'embedding invalide".to_string())?
        .iter()
        .map(|v| v.as_f64().unwrap_or(0.0) as f32)
        .collect();

    Ok(values)
}

pub async fn generate_gemini_response(prompt: &str) -> Result<String, String> {
    let api_key = get_gemini_api_key()?;
    let url = "https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent";

    let client = reqwest::Client::new();
    let response = client
        .post(format!("{}?key={}", url, api_key))
        .json(&json!({
            "contents": [
                {
                    "parts": [{ "text": prompt }]
                }
            ],
            "generationConfig": {
                "temperature": 0.2,
                "maxOutputTokens": 2048
            }
        }))
        .send()
        .await
        .map_err(|e| format!("Erreur réseau Gemini: {}", e))?;

    if !response.status().is_success() {
        let status = response.status();
        let body = response.text().await.unwrap_or_default();
        return Err(format!("Erreur API Gemini {}: {}", status, body));
    }

    let data: serde_json::Value = response
        .json()
        .await
        .map_err(|e| format!("Erreur parsing JSON Gemini: {}", e))?;

    let answer = data["candidates"][0]["content"]["parts"][0]["text"]
        .as_str()
        .ok_or_else(|| "Réponse Gemini vide ou au format inattendu".to_string())?
        .to_string();

    Ok(answer)
}
