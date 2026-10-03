// src/lib/ai/rag-prompts.ts
// Prompts dédiés au RAG documentaire.
// Session 20.1 — E3 (Unification partielle API, ADR 009 Q4 → D2).
// Extraits de src/app/api/ai/rag/route.ts pour réutilisation.

import type { GroqMessage } from './types';
import type { RagSearchResult } from './rag-search';

export const RAG_SYSTEM_PROMPT =
  'Tu es un assistant industriel. Réponds en français, en te basant UNIQUEMENT sur le contexte fourni. Si l\'information n\'est pas dans le contexte, dis-le explicitement.';

/**
 * Formate les chunks retournés par searchHybrid() en une chaîne de contexte.
 * Format : [Source: <source>#<chunkIndex>]\n<content>, séparés par \n\n.
 */
export function buildRagContextString(results: RagSearchResult[]): string {
  return results
    .map((r) => `[Source: ${r.source}#${r.chunkIndex}]\n${r.content}`)
    .join('\n\n');
}

/**
 * Construit les messages Groq pour une requête RAG.
 * Retourne [system, user] avec le contexte et la question.
 */
export function buildRagMessages(
  question: string,
  results: RagSearchResult[]
): GroqMessage[] {
  const contextStr = buildRagContextString(results);
  const userPrompt = `Contexte:\n${contextStr}\n\nQuestion: ${question}\n\nRéponse:`;

  return [
    { role: 'system', content: RAG_SYSTEM_PROMPT },
    { role: 'user', content: userPrompt },
  ];
}