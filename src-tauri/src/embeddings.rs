use fastembed::{EmbeddingModel, InitOptions, TextEmbedding};
use serde_json::json;
use std::sync::{Mutex, OnceLock};

static EMBEDDER: OnceLock<Mutex<TextEmbedding>> = OnceLock::new();

fn get_embedder() -> Result<&'static Mutex<TextEmbedding>, String> {
    if let Some(m) = EMBEDDER.get() {
        return Ok(m);
    }

    let model = TextEmbedding::try_new(
        InitOptions::new(EmbeddingModel::AllMiniLML6V2).with_show_download_progress(true),
    )
    .map_err(|e| format!("Erreur chargement modèle ONNX: {}", e))?;

    let _ = EMBEDDER.set(Mutex::new(model));
    Ok(EMBEDDER.get().unwrap())
}

/// Génère un embedding local via ONNX Runtime et le modèle all-MiniLM-L6-v2 (384 dimensions).
/// 100% offline après premier téléchargement du modèle, haute qualité sémantique.
pub fn generate_embedding_local(text: &str) -> Result<Vec<f32>, String> {
    let embedder = get_embedder()?;
    let guard = embedder
        .lock()
        .map_err(|e| format!("Erreur verrouillage embedder: {}", e))?;

    let embeddings = guard
        .embed(vec![text], None)
        .map_err(|e| format!("Erreur calcul embedding: {}", e))?;

    embeddings
        .into_iter()
        .next()
        .ok_or_else(|| "Aucun embedding retourné par le modèle".to_string())
}

/// Génère des embeddings par batch pour optimiser la vectorisation de plusieurs chunks.
pub fn generate_embeddings_batch(texts: Vec<String>) -> Result<Vec<Vec<f32>>, String> {
    if texts.is_empty() {
        return Ok(vec![]);
    }
    let embedder = get_embedder()?;
    let guard = embedder
        .lock()
        .map_err(|e| format!("Erreur verrouillage embedder: {}", e))?;

    guard
        .embed(texts, None)
        .map_err(|e| format!("Erreur calcul batch embedding: {}", e))
}

// ─── Clé Groq ────────────────────────────────────────────────────────────────
pub fn get_groq_api_key() -> Result<String, String> {
    // 1. Variable d'environnement
    if let Ok(key) = std::env::var("GROQ_API_KEY") {
        if !key.trim().is_empty() {
            return Ok(key.trim().to_string());
        }
    }

    // 2. Lecture depuis .env.local ou .env
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
                if trimmed.starts_with("GROQ_API_KEY=") {
                    let val = trimmed["GROQ_API_KEY=".len()..]
                        .trim()
                        .trim_matches('"')
                        .trim_matches('\'');
                    if !val.is_empty() {
                        return Ok(val.to_string());
                    }
                }
            }
        }
    }

    Err("GROQ_API_KEY introuvable".to_string())
}

pub fn get_groq_model() -> String {
    if let Ok(model) = std::env::var("GROQ_MODEL") {
        if !model.trim().is_empty() {
            return model.trim().to_string();
        }
    }
    // Modèle par défaut supporté par le compte Groq
    "openai/gpt-oss-120b".to_string()
}

/// Génère une réponse via Groq (OpenAI-compatible).
/// Utilisé par ask_local_rag pour la génération de texte.
pub async fn generate_ai_response(prompt: &str) -> Result<String, String> {
    let key = get_groq_api_key()?;
    let model = get_groq_model();
    let url = "https://api.groq.com/openai/v1/chat/completions";

    let client = reqwest::Client::new();
    let response = client
        .post(url)
        .bearer_auth(&key)
        .json(&json!({
            "model": model,
            "messages": [
                {
                    "role": "system",
                    "content": "Tu es l'assistant technique de terrain NexaFlow (Centrale thermique / Cycle combiné). \
                                Réponds en français, de façon précise et technique."
                },
                {
                    "role": "user",
                    "content": prompt
                }
            ],
            "temperature": 0.2,
            "max_tokens": 2048
        }))
        .send()
        .await
        .map_err(|e| format!("Erreur réseau Groq: {}", e))?;

    if !response.status().is_success() {
        let status = response.status();
        let body = response.text().await.unwrap_or_default();
        return Err(format!("Erreur API Groq {}: {}", status, body));
    }

    let data: serde_json::Value = response
        .json()
        .await
        .map_err(|e| format!("Erreur parsing JSON Groq: {}", e))?;

    let answer = data["choices"][0]["message"]["content"]
        .as_str()
        .ok_or_else(|| "Réponse Groq vide ou au format inattendu".to_string())?
        .to_string();

    Ok(answer)
}
