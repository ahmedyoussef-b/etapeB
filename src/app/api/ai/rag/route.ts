export const runtime = 'nodejs';
import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/api/auth-guard';
import { embedTexts } from '@/lib/ai/cloudflare-embeddings';
import { cleanQuery } from '@/lib/ai/query-cleaning';
import { callGroq, getGroqApiKey } from '@/lib/ai/groq-client';
import { getPrismaClient } from '@/lib/services/db';
import { GroqMessage } from '@/lib/ai/types';
import { searchHybrid, type RagSearchResult } from '@/lib/ai/rag-search';
import logger from '@/lib/logger';

async function handleRag(
  req: NextRequest,
  { user }: { user: { id: string; email: string; role: string; name?: string | null } }
): Promise<NextResponse> {
  let body: { question?: string; topK?: number };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Corps de requête JSON invalide' }, { status: 400 });
  }

  const question = typeof body.question === 'string' ? body.question.trim() : '';
  if (question.length === 0) {
    return NextResponse.json({ error: 'Le champ "question" est requis' }, { status: 400 });
  }

  const topK = typeof body.topK === 'number' && Number.isFinite(body.topK) ? Math.min(Math.max(Math.trunc(body.topK), 1), 20) : 5;

  let prisma;
  try {
    prisma = getPrismaClient();
  } catch (error) {
    logger.error('Prisma unavailable for RAG', {
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json({ error: 'Base de données indisponible' }, { status: 500 });
  }

  const cleaned = cleanQuery(question);
  logger.info('RAG cleaned query', { userId: user.id, question, cleanedQuery: cleaned });

  let embedding: number[];
  try {
    const [embeddingResult] = await embedTexts([cleaned]);
    embedding = embeddingResult;
    if (!Array.isArray(embedding) || embedding.length === 0) {
      return NextResponse.json({ error: 'Embedding vide' }, { status: 502 });
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logger.warn('RAG embed failed', { userId: user.id, message });

    if (message.startsWith('Cloudflare API error')) {
      return NextResponse.json({ error: 'Service d\'embedding indisponible' }, { status: 502 });
    }

    if (message === 'Configuration Cloudflare manquante') {
      return NextResponse.json({ error: 'Configuration Cloudflare manquante' }, { status: 500 });
    }

    return NextResponse.json({ error: 'Erreur lors de la génération de l\'embedding' }, { status: 500 });
  }

  let results: RagSearchResult[];

  try {
    results = await searchHybrid(prisma, cleaned, embedding, topK);
  } catch (error) {
    logger.error('RAG hybrid search failed', {
      userId: user.id,
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json({ error: 'Base de connaissances indisponible' }, { status: 500 });
  }

  if (results.length === 0) {
    return NextResponse.json({
      answer: 'Aucune information pertinente trouvée dans la base de connaissances.',
      context: [],
      model: process.env.GROQ_MODEL || 'openai/gpt-oss-120b',
      question,
      cleanedQuery: cleaned,
    });
  }

  const contextStr = results
    .map(r => `[Source: ${r.source}#${r.chunkIndex}]\n${r.content}`)
    .join('\n\n');

  const systemPrompt = 'Tu es un assistant industriel. Réponds en français, en te basant UNIQUEMENT sur le contexte fourni. Si l\'information n\'est pas dans le contexte, dis-le explicitement.';
  const userPrompt = `Contexte:\n${contextStr}\n\nQuestion: ${question}\n\nRéponse:`;

  const apiKey = getGroqApiKey();
  if (!apiKey) {
    logger.error('GROQ_API_KEY missing for RAG', { userId: user.id });
    return NextResponse.json({ error: 'GROQ_API_KEY non configurée' }, { status: 500 });
  }

  try {
    const messages: GroqMessage[] = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ];
    const groqResult = await callGroq(messages, apiKey, { model: process.env.GROQ_MODEL });

    logger.info('RAG Groq response', { userId: user.id, model: groqResult.model });

    return NextResponse.json({
      answer: groqResult.content,
      context: results.map(r => ({
        id: r.id,
        source: r.source,
        chunkIndex: r.chunkIndex,
        content: r.content,
        similarity: r.similarity,
      })),
      model: groqResult.model,
      question,
      cleanedQuery: cleaned,
    });
  } catch (error) {
    logger.error('RAG Groq failed', {
      userId: user.id,
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json({ error: 'Erreur lors de la génération de la réponse' }, { status: 500 });
  }
}

export const POST = withAuth(handleRag, 'procedures:view');
