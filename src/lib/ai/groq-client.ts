import { GroqRequest, GroqResponse, GroqMessage } from './types';

const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';
const DEFAULT_MODEL = process.env.GROQ_MODEL || 'openai/gpt-oss-120b';
const GROQ_TIMEOUT_MS = 30_000;

export async function callGroq(
  messages: GroqMessage[],
  apiKey: string,
  options?: { model?: string; temperature?: number; maxTokens?: number; timeout?: number }
): Promise<{ content: string; model: string }> {
  const timeoutMs = options?.timeout ?? GROQ_TIMEOUT_MS;

  try {
    const requestBody: GroqRequest = {
      model: options?.model ?? DEFAULT_MODEL,
      messages,
      temperature: options?.temperature ?? 0.2,
      max_tokens: options?.maxTokens ?? 2048,
      stream: false,
    };

    const response = await fetch(GROQ_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(requestBody),
      signal: AbortSignal.timeout(timeoutMs),
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => 'Unknown error');
      throw new Error(`GROQ API error: ${response.status} ${response.statusText} - ${errorText}`);
    }

    const data: GroqResponse = await response.json();

    if (!data.choices || data.choices.length === 0) {
      throw new Error('GROQ API returned empty choices');
    }

    return {
      content: data.choices[0].message.content,
      model: data.model,
    };
  } catch (error) {
    if (error instanceof DOMException && error.name === 'TimeoutError') {
      throw new Error(`GROQ request timeout after ${timeoutMs}ms`);
    }
    throw error;
  }
}

export function getGroqApiKey(): string | undefined {
  return process.env.GROQ_API_KEY;
}