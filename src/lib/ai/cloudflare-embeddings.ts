import logger from '@/lib/logger';

function getCloudflareConfig() {
  return {
    accountId: process.env.CLOUDFLARE_ACCOUNT_ID,
    apiToken: process.env.CLOUDFLARE_API_TOKEN,
    model: process.env.CLOUDFLARE_EMBEDDING_MODEL || '@cf/baai/bge-small-en-v1.5',
    dimensions: Number(process.env.CLOUDFLARE_EMBEDDING_DIMENSIONS || '384'),
  };
}

export function getCloudflareEmbeddingModel(): string {
  return getCloudflareConfig().model;
}

export function getCloudflareEmbeddingDimensions(): number {
  return getCloudflareConfig().dimensions;
}

export async function embedTexts(texts: string[]): Promise<number[][]> {
  if (texts.length === 0) {
    throw new Error('Aucun texte à vectoriser');
  }

  const config = getCloudflareConfig();

  if (!config.accountId || !config.apiToken) {
    throw new Error('Configuration Cloudflare manquante');
  }

  const url = `https://api.cloudflare.com/client/v4/accounts/${config.accountId}/ai/run/${config.model}`;

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${config.apiToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ text: texts, pooling: 'cls' }),
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
