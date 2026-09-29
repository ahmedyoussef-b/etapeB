import logger from '@/lib/logger';

const CLOUDFLARE_ACCOUNT_ID = process.env.CLOUDFLARE_ACCOUNT_ID;
const CLOUDFLARE_API_TOKEN = process.env.CLOUDFLARE_API_TOKEN;
const CLOUDFLARE_EMBEDDING_MODEL = process.env.CLOUDFLARE_EMBEDDING_MODEL || '@cf/baai/bge-small-en-v1.5';
const CLOUDFLARE_EMBEDDING_DIMENSIONS = Number(process.env.CLOUDFLARE_EMBEDDING_DIMENSIONS || '384');

export function getCloudflareEmbeddingModel(): string {
  return CLOUDFLARE_EMBEDDING_MODEL;
}

export function getCloudflareEmbeddingDimensions(): number {
  return CLOUDFLARE_EMBEDDING_DIMENSIONS;
}

export async function embedTexts(texts: string[]): Promise<number[][]> {
  if (texts.length === 0) {
    throw new Error('Aucun texte à vectoriser');
  }

  if (!CLOUDFLARE_ACCOUNT_ID || !CLOUDFLARE_API_TOKEN) {
    throw new Error('Configuration Cloudflare manquante');
  }

  const url = `https://api.cloudflare.com/client/v4/accounts/${CLOUDFLARE_ACCOUNT_ID}/ai/run/${encodeURIComponent(CLOUDFLARE_EMBEDDING_MODEL)}`;

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${CLOUDFLARE_API_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ text: texts }),
  });

  if (!response.ok) {
    const body = await response.text().catch(() => 'Unknown error');
    throw new Error(`Cloudflare API error: ${response.status} - ${body}`);
  }

  const result = await response.json();

  if (!Array.isArray(result?.result?.data)) {
    throw new Error('Réponse Cloudflare invalide');
  }

  return result.result.data;
}
