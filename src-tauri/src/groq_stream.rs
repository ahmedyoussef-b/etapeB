use tauri::{AppHandle, Emitter};
use futures_util::StreamExt;
use serde_json::Value;

use crate::vectorizer::SearchResult;

/// Streams a Groq chat completion with `stream = true`.
/// Emits `rag-stream-token` events for each token (including the conversation ID),
/// and at the end emits `rag-stream-done` with the collected sources and the full answer.
/// On error, emits `rag-stream-error`.
pub async fn stream_groq_response(
    app: AppHandle,
    prompt: String,
    conversation_id: String,
    sources: Vec<SearchResult>,
) -> Result<(), String> {
    // Build request body (same as in embeddings.rs but with stream=true)
    let key = crate::embeddings::get_groq_api_key()?;
    let model = crate::embeddings::get_groq_model();
    let client = reqwest::Client::new();
    let response = client
        .post("https://api.groq.com/openai/v1/chat/completions")
        .bearer_auth(&key)
        .json(&serde_json::json!({
            "model": model,
            "messages": [
                {"role": "system", "content": "Tu es l'assistant technique de terrain NexaFlow (Centrale thermique / Cycle combiné). Réponds en français, de façon précise et technique."},
                {"role": "user", "content": prompt}
            ],
            "temperature": 0.2,
            "max_tokens": 2048,
            "stream": true,
        }))
        .send()
        .await
        .map_err(|e| format!("Erreur réseau Groq (stream) : {}", e))?;

    if !response.status().is_success() {
        let status = response.status();
        let body = response.text().await.unwrap_or_default();
        // Emit error event before returning
        let _ = app.emit(
            "rag-stream-error",
            serde_json::json!({
                "conversation_id": conversation_id,
                "error": format!("Erreur API Groq {}: {}", status, body)
            }),
        );
        return Err(format!("Erreur API Groq {}: {}", status, body));
    }

    let mut stream = response.bytes_stream();
    let mut full_answer = String::new();
    while let Some(item) = stream.next().await {
        let chunk = item.map_err(|e| format!("Erreur lors du streaming Groq : {}", e))?;
        let text = String::from_utf8_lossy(&chunk);
        for line in text.lines() {
            let trimmed = line.trim();
            if trimmed.is_empty() { continue; }
            if trimmed.starts_with("data: ") {
                let data = &trimmed[6..];
                if data == "[DONE]" {
                    // End of stream
                    break;
                }
                let v: Value = match serde_json::from_str(data) {
                    Ok(val) => val,
                    Err(e) => {
                        // Emit parsing error but continue
                        let _ = app.emit(
                            "rag-stream-error",
                            serde_json::json!({
                                "conversation_id": conversation_id,
                                "error": format!("Erreur parsing JSON Groq stream: {}", e)
                            }),
                        );
                        continue;
                    }
                };
                if let Some(token) = v["choices"][0]["delta"]["content"].as_str() {
                    full_answer.push_str(token);
                    let _ = app.emit(
                        "rag-stream-token",
                        serde_json::json!({
                            "conversation_id": conversation_id,
                            "token": token,
                        }),
                    );
                }
            }
        }
    }

    // Emit final done event with sources and full answer
    let _ = app.emit(
        "rag-stream-done",
        serde_json::json!({
            "conversation_id": conversation_id,
            "sources": sources,
            "full_answer": full_answer,
        }),
    );
    Ok(())
}
