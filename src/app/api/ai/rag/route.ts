export const runtime = 'nodejs';
import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/api/auth-guard';
import { embedTexts } from '@/lib/ai/cloudflare-embeddings';
import { cleanQuery } from '@/lib/ai/query-cleaning';
import { callGroq, getGroqApiKey } from '@/lib/ai/groq-client';
import { getPrismaClient } from '@/lib/services/db';
import { searchHybrid, type RagSearchResult } from '@/lib/ai/rag-search';
import { buildRagMessages } from '@/lib/ai/rag-prompts';
import { mapEmbeddingError } from '@/lib/ai/groq-error-mapping';
import logger from '@/lib/logger';

async function handleRag(
  req: NextRequest,
  { user }: { user: { id: string; email: string; role: string; name?: string | null } }
): Promise<NextResponse> {
  let body: { question?: string; topK?: number };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Corps de requete JSON invalide' }, { status: 400 });
  }

  const question = typeof body.question === 'string' ? body.question.trim() : '';
  if (question.length === 0) {
    return NextResponse.json({ error: 'Le champ "question" est requis' }, { status: 400 });
  }

  const topK = typeof body.topK === 'number' && Number.isFinite(body.topK)
    ? Math.min(Math.max(Math.trunc(body.topK), 1), 20)
    : 5;

  let prisma;
  try {
    prisma = getPrismaClient();
  } catch (error) {
    logger.error('Prisma unavailable for RAG', {
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json({ error: 'Base de donnees indisponible' }, { status: 500 });
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
    const mapped = mapEmbeddingError(message);
    return NextResponse.json({ error: mapped.error }, { status: mapped.status });
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
      answer: 'Aucune information pertinente trouvee dans la base de connaissances.',
      context: [],
      model: process.env.GROQ_MODEL || 'openai/gpt-oss-120b',
      question,
      cleanedQuery: cleaned,
    });
  }

  const apiKey = getGroqApiKey();
  if (!apiKey) {
    logger.error('GROQ_API_KEY missing for RAG', { userId: user.id });
    return NextResponse.json({ error: 'GROQ_API_KEY non configuree' }, { status: 500 });
  }

  try {
    const messages = buildRagMessages(question, results);
    const groqResult = await callGroq(messages, apiKey, { model: process.env.GROQ_MODEL });

    logger.info('RAG Groq response', { userId: user.id, model: groqResult.model });

    return NextResponse.json({
      answer: groqResult.content,
      context: results.map((r) => ({
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
    return NextResponse.json({ error: 'Erreur lors de la generation de la reponse' }, { status: 500 });
  }
}

export const POST = withAuth(handleRag, 'procedures:view');