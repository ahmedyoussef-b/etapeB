export const runtime = 'nodejs';
import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/api/auth-guard';
import logger from '@/lib/logger';

const CLOUDFLARE_ACCOUNT_ID = process.env.CLOUDFLARE_ACCOUNT_ID;
const CLOUDFLARE_API_TOKEN = process.env.CLOUDFLARE_API_TOKEN;
const CLOUDFLARE_EMBEDDING_MODEL = process.env.CLOUDFLARE_EMBEDDING_MODEL || '@cf/baai/bge-small-en-v1.5';
const CLOUDFLARE_EMBEDDING_DIMENSIONS = Number(process.env.CLOUDFLARE_EMBEDDING_DIMENSIONS || '384');

async function handleEmbed(req: NextRequest): Promise<NextResponse> {
  let payload: { texts?: string[]; text?: string };
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json({ error: 'Corps de requête JSON invalide' }, { status: 400 });
  }

  const texts: string[] = payload.texts?.length
    ? payload.texts.filter((item): item is string => typeof item === 'string')
    : typeof payload.text === 'string'
      ? [payload.text]
      : [];

  if (texts.length === 0) {
    return NextResponse.json(
      { error: 'Le champ "text" ou "texts" est requis' },
      { status: 400 }
    );
  }

  if (!CLOUDFLARE_ACCOUNT_ID || !CLOUDFLARE_API_TOKEN) {
    logger.error('Cloudflare credentials missing for embed route');
    return NextResponse.json(
      { error: 'Configuration Cloudflare manquante' },
      { status: 500 }
    );
  }

  const url = `https://api.cloudflare.com/client/v4/accounts/${CLOUDFLARE_ACCOUNT_ID}/ai/run/${encodeURIComponent(CLOUDFLARE_EMBEDDING_MODEL)}`;

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${CLOUDFLARE_API_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ text: texts }),
    });

    if (!response.ok) {
      const text = await response.text();
      logger.error('Cloudflare embed API error', { status: response.status, body: text });
      return NextResponse.json(
        { error: 'Erreur lors de la génération des embeddings' },
        { status: 502 }
      );
    }

    const result = await response.json();
    const embeddings: number[][] = Array.isArray(result?.result?.data)
      ? result.result.data
      : [];

    return NextResponse.json({
      embeddings,
      model: CLOUDFLARE_EMBEDDING_MODEL,
      dimensions: CLOUDFLARE_EMBEDDING_DIMENSIONS,
    });
  } catch (error) {
    logger.error('Embed route failed', {
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json(
      { error: 'Erreur interne lors de la génération des embeddings' },
      { status: 500 }
    );
  }
}

export const POST = withAuth(handleEmbed);
