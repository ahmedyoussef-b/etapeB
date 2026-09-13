import { GroqRequest, GroqResponse, GroqMessage } from './types';

const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';
const DEFAULT_MODEL = 'llama-3.1-8b-instant';
const DEFAULT_TIMEOUT = 10000;

export async function callGroq(
  messages: GroqMessage[],
  apiKey: string,
  options?: { model?: string; temperature?: number; maxTokens?: number; timeout?: number }
): Promise<{ content: string; model: string }> {
  const controller = new AbortController();
  const timeoutMs = options?.timeout ?? DEFAULT_TIMEOUT;
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const requestBody: GroqRequest = {
      model: options?.model ?? DEFAULT_MODEL,
      messages,
      temperature: options?.temperature ?? 0.3,
      max_tokens: options?.maxTokens ?? 500,
      stream: false,
    };

    const response = await fetch(GROQ_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(requestBody),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

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
    clearTimeout(timeoutId);
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error(`GROQ request timeout after ${timeoutMs}ms`);
    }
    throw error;
  }
}

export function getGroqApiKey(): string | undefined {
  return process.env.GROQ_API_KEY;
}