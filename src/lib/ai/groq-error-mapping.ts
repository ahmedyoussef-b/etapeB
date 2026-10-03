// src/lib/ai/groq-error-mapping.ts
// Mapping des erreurs (Groq, Cloudflare embeddings, Prisma) vers des messages utilisateur + statuts HTTP.
// Session 20.1 - E3 (Unification partielle API, ADR 009 Q4 -> D2).
// Extrait de src/app/api/ai/rag/route.ts.
// Note E4 : etendre ce mapping a d'autres types d'erreurs (Groq, Prisma) via un type union si necessaire.

export interface ErrorMapping {
  error: string;
  status: number;
}

/**
 * Mappe une erreur d'embedding Cloudflare vers un message + statut HTTP.
 * Utilise par /api/ai/rag quand embedTexts() echoue.
 */
export function mapEmbeddingError(errorMessage: string): ErrorMapping {
  if (errorMessage.startsWith('Cloudflare API error')) {
    return { error: 'Service d\'embedding indisponible', status: 502 };
  }

  if (errorMessage === 'Configuration Cloudflare manquante') {
    return { error: 'Configuration Cloudflare manquante', status: 500 };
  }

  return { error: 'Erreur lors de la generation de l\'embedding', status: 500 };
}