export const runtime = 'nodejs';
import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/api/auth-guard';
import { embedTexts } from '@/lib/ai/cloudflare-embeddings';
import { cleanQuery } from '@/lib/ai/query-cleaning';
import { callGroq, getGroqApiKey } from '@/lib/ai/groq-client';
import { getPrismaClient } from '@/lib/services/db';
import {
  searchHybrid,
  searchLexicalOnly,
  type RagSearchResult,
} from '@/lib/ai/rag-search';
import { buildRagMessages } from '@/lib/ai/rag-prompts';
import {
  mapEmbeddingError,
  mapGroqError,
  mapPrismaError,
} from '@/lib/ai/groq-error-mapping';
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

  // ----- N3 (Prisma/Neon) -----
  let prisma;
  try {
    prisma = getPrismaClient();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logger.error('Prisma unavailable for RAG', { userId: user.id, error: message });
    const mapped = mapPrismaError(message);
    return NextResponse.json({ error: mapped.error }, { status: mapped.status });
  }

  const cleaned = cleanQuery(question);
  logger.info('RAG cleaned query', { userId: user.id, question, cleanedQuery: cleaned });

  // ----- N1 (Embedding) : fallback lexical si echec -----
  let embedding: number[] | null = null;
  let embeddingFailed = false;

  try {
    const [embeddingResult] = await embedTexts([cleaned]);
    if (!Array.isArray(embeddingResult) || embeddingResult.length === 0) {
      embeddingFailed = true;
      logger.warn('RAG embed empty, fallback lexical', { userId: user.id });
    } else {
      embedding = embeddingResult;
    }
  } catch (error) {
    embeddingFailed = true;
    const message = error instanceof Error ? error.message : String(error);
    logger.warn('RAG embed failed, fallback lexical', { userId: user.id, error: message });
    const mapped = mapEmbeddingError(message);
    logger.info('RAG embed error mapped', { mapped });
  }

  // ----- Recherche : hybride OU lexical seul -----
  let results: RagSearchResult[];
  let searchMode: 'hybrid' | 'lexical-only' = 'hybrid';

  try {
    if (embeddingFailed || embedding === null) {
      searchMode = 'lexical-only';
      results = await searchLexicalOnly(prisma, cleaned, topK);
    } else {
      results = await searchHybrid(prisma, cleaned, embedding, topK);
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logger.error('RAG search failed', { userId: user.id, error: message });
    const mapped = mapPrismaError(message);
    return NextResponse.json({ error: mapped.error }, { status: mapped.status });
  }

  if (results.length === 0) {
    return NextResponse.json({
      answer: 'Aucune information pertinente trouvee dans la base de connaissances.',
      context: [],
      model: process.env.GROQ_MODEL || 'openai/gpt-oss-120b',
      question,
      cleanedQuery: cleaned,
      searchMode,
    });
  }

  // ----- N2 (Groq) : fallback chunks bruts si echec -----
  const apiKey = getGroqApiKey();
  if (!apiKey) {
    logger.error('GROQ_API_KEY missing for RAG, fallback chunks bruts', { userId: user.id });
    return NextResponse.json({
      answer: null,
      fallback: 'chunks-only',
      reason: 'GROQ_API_KEY non configuree',
      context: results.map((r) => ({
        id: r.id,
        source: r.source,
        chunkIndex: r.chunkIndex,
        content: r.content,
        similarity: r.similarity,
        rrfScore: r.rrfScore,
      })),
      model: null,
      question,
      cleanedQuery: cleaned,
      searchMode,
    });
  }

  try {
    const messages = buildRagMessages(question, results);
    const groqResult = await callGroq(messages, apiKey, { model: process.env.GROQ_MODEL });

    logger.info('RAG Groq response', { userId: user.id, model: groqResult.model, searchMode });

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
      searchMode,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logger.warn('RAG Groq failed, fallback chunks bruts', { userId: user.id, error: message });

    const mapped = mapGroqError(message);

    return NextResponse.json({
      answer: null,
      fallback: 'chunks-only',
      reason: mapped.error,
      context: results.map((r) => ({
        id: r.id,
        source: r.source,
        chunkIndex: r.chunkIndex,
        content: r.content,
        similarity: r.similarity,
        rrfScore: r.rrfScore,
      })),
      model: null,
      question,
      cleanedQuery: cleaned,
      searchMode,
    });
  }
}

export const POST = withAuth(handleRag, 'procedures:view');
