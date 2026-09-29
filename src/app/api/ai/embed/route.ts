export const runtime = 'nodejs';
import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/api/auth-guard';
import { embedTexts, getCloudflareEmbeddingModel, getCloudflareEmbeddingDimensions } from '@/lib/ai/cloudflare-embeddings';
import logger from '@/lib/logger';

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

  try {
    const embeddings = await embedTexts(texts);

    return NextResponse.json({
      embeddings,
      model: getCloudflareEmbeddingModel(),
      dimensions: getCloudflareEmbeddingDimensions(),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);

    if (message === 'Configuration Cloudflare manquante') {
      logger.error('Cloudflare credentials missing for embed route');
      return NextResponse.json(
        { error: 'Configuration Cloudflare manquante' },
        { status: 500 }
      );
    }

    if (message.startsWith('Cloudflare API error')) {
      logger.error('Cloudflare embed API error', { message });
      return NextResponse.json(
        { error: 'Erreur lors de la génération des embeddings' },
        { status: 502 }
      );
    }

    logger.error('Embed route failed', {
      error: message,
    });
    return NextResponse.json(
      { error: 'Erreur interne lors de la génération des embeddings' },
      { status: 500 }
    );
  }
}

export const POST = withAuth(handleEmbed);
