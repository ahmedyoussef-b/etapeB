// src/lib/ai/rag-search.ts
// Service de recherche hybride (vectorielle + lexicale) avec fusion RRF.
// Session 20 - RAG Phase 2 E2 (Hybrid Search).
// Etendu en Session 20.1 - E4 (Fallback degrade, ADR 009 Q5 -> E2).
// ADR 009 Q3 -> C1 (Hybrid Search maintenant), Q4 -> D2 (Unification partielle).

import type { PrismaClient } from '@prisma/client';
import logger from '@/lib/logger';

// ----- Parametres RRF (decisions E2.3) -----
const RRF_K = 60;
const VECTOR_WEIGHT = 1.0;
const LEXICAL_WEIGHT = 1.0;
const LIST_MULTIPLIER = 2;

// ----- Types -----

export interface RagSearchResult {
  id: string;
  content: string;
  source: string;
  chunkIndex: number;
  similarity: number;
  rrfScore: number;
}

interface RawChunk {
  id: string;
  content: string;
  source: string;
  chunkIndex: number;
  similarity?: number;
  rank?: number;
}

// ----- Requete vectorielle -----

async function searchVectorial(
  prisma: PrismaClient,
  embeddingStr: string,
  limit: number
): Promise<RawChunk[]> {
  try {
    return await prisma.$queryRaw<RawChunk[]>`
      SELECT
        id,
        content,
        source,
        "chunkIndex",
        1 - (embedding <=> ${embeddingStr}::vector) AS similarity
      FROM document_chunks
      WHERE embedding IS NOT NULL
      ORDER BY embedding <=> ${embeddingStr}::vector
      LIMIT ${limit}
    `;
  } catch (error) {
    logger.error('RAG vectorial search failed', {
      error: error instanceof Error ? error.message : String(error),
    });
    return [];
  }
}

// ----- Requete lexicale -----

async function searchLexical(
  prisma: PrismaClient,
  question: string,
  limit: number
): Promise<RawChunk[]> {
  try {
    return await prisma.$queryRaw<RawChunk[]>`
      SELECT
        id,
        content,
        source,
        "chunkIndex",
        ts_rank(search_vector, plainto_tsquery('french', ${question})) AS rank
      FROM document_chunks
      WHERE search_vector @@ plainto_tsquery('french', ${question})
      ORDER BY rank DESC
      LIMIT ${limit}
    `;
  } catch (error) {
    logger.error('RAG lexical search failed', {
      error: error instanceof Error ? error.message : String(error),
    });
    return [];
  }
}

// ----- Fusion RRF -----

function fuseRRF(
  vectorial: RawChunk[],
  lexical: RawChunk[],
  topK: number
): RagSearchResult[] {
  const scores = new Map<string, {
    chunk: RawChunk;
    rrfScore: number;
    similarity: number;
  }>();

  vectorial.forEach((chunk, index) => {
    const rank = index + 1;
    const contribution = VECTOR_WEIGHT / (RRF_K + rank);
    const existing = scores.get(chunk.id);
    if (existing) {
      existing.rrfScore += contribution;
    } else {
      scores.set(chunk.id, {
        chunk,
        rrfScore: contribution,
        similarity: chunk.similarity ?? 0,
      });
    }
  });

  lexical.forEach((chunk, index) => {
    const rank = index + 1;
    const contribution = LEXICAL_WEIGHT / (RRF_K + rank);
    const existing = scores.get(chunk.id);
    if (existing) {
      existing.rrfScore += contribution;
    } else {
      scores.set(chunk.id, {
        chunk,
        rrfScore: contribution,
        similarity: chunk.similarity ?? 0,
      });
    }
  });

  return Array.from(scores.values())
    .sort((a, b) => b.rrfScore - a.rrfScore)
    .slice(0, topK)
    .map(({ chunk, rrfScore, similarity }) => ({
      id: chunk.id,
      content: chunk.content,
      source: chunk.source,
      chunkIndex: chunk.chunkIndex,
      similarity,
      rrfScore,
    }));
}

// ----- Point d'entree : hybrid search -----

export async function searchHybrid(
  prisma: PrismaClient,
  question: string,
  embedding: number[],
  topK: number
): Promise<RagSearchResult[]> {
  const limit = topK * LIST_MULTIPLIER;
  const embeddingStr = `[${embedding.join(',')}]`;

  const [vectorial, lexical] = await Promise.all([
    searchVectorial(prisma, embeddingStr, limit),
    searchLexical(prisma, question, limit),
  ]);

  logger.info('RAG hybrid search completed', {
    vectorialCount: vectorial.length,
    lexicalCount: lexical.length,
    topK,
  });

  return fuseRRF(vectorial, lexical, topK);
}

// ----- Fallback lexical seul (E4, ADR 009 Q5 -> E2) -----

/**
 * Recherche lexicale uniquement (sans embedding).
 * Utilise comme fallback quand embedTexts() echoue (Cloudflare indisponible,
 * configuration manquante, erreur reseau).
 *
 * Retourne les chunks classes par score lexical (ts_rank), convertis via RRF
 * (avec une liste vectorielle vide).
 */
export async function searchLexicalOnly(
  prisma: PrismaClient,
  question: string,
  topK: number
): Promise<RagSearchResult[]> {
  const limit = topK * LIST_MULTIPLIER;
  const lexical = await searchLexical(prisma, question, limit);

  logger.info('RAG lexical-only search completed', {
    lexicalCount: lexical.length,
    topK,
  });

  return fuseRRF([], lexical, topK);
}
