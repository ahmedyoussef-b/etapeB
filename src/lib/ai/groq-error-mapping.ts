// src/lib/ai/groq-error-mapping.ts
// Mapping des erreurs (Groq, Cloudflare embeddings, Prisma) vers des messages utilisateur + statuts HTTP.
// Session 20.1 - E3 (Unification partielle API, ADR 009 Q4 -> D2).
// Etendu en E4 (Fallback degrade, ADR 009 Q5 -> E2).

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

  if (errorMessage === 'Aucun texte a vectoriser') {
    return { error: 'Aucun texte a vectoriser', status: 400 };
  }

  if (errorMessage === 'Reponse Cloudflare invalide') {
    return { error: 'Reponse Cloudflare invalide', status: 502 };
  }

  return { error: 'Erreur lors de la generation de l\'embedding', status: 500 };
}

/**
 * Mappe une erreur Groq vers un message + statut HTTP.
 * Utilise par /api/ai/rag en fallback N2 (chunks bruts si Groq echoue).
 */
export function mapGroqError(errorMessage: string): ErrorMapping {
  if (errorMessage.includes('GROQ API error')) {
    return { error: 'Service LLM indisponible', status: 503 };
  }

  if (errorMessage.includes('GROQ request timeout')) {
    return { error: 'Service LLM timeout', status: 504 };
  }

  return { error: 'Erreur lors de la generation de la reponse', status: 500 };
}

/**
 * Mappe une erreur Prisma/Neon vers un message + statut HTTP.
 * Utilise par /api/ai/rag en fallback N3 (base indisponible).
 */
export function mapPrismaError(errorMessage: string): ErrorMapping {
  if (errorMessage.includes('prisma') || errorMessage.includes('Prisma')) {
    return { error: 'Base de donnees indisponible', status: 503 };
  }

  return { error: 'Base de connaissances indisponible', status: 503 };
}
