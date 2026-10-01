# ADR 003 — RAG Web Phase 1 : implémentation pgvector + Cloudflare embeddings

- **Date** : 2026-10-01
- **Statut** : Accepté
- **Décideur** : Équipe NexaFlow
- **Contexte** : Session 11 (suite ADR 002 Web-as-buffer, incident 2026-10-01)

## Contexte

L'application NexaFlow est une application hybride (web + desktop Tauri) de
gestion de procédures industrielles. Elle dispose d'un RAG (Retrieval
Augmented Generation) pour répondre aux questions des utilisateurs sur le
contenu documentaire.

Deux implémentations RAG coexistent :

1. **RAG local (Tauri)** : ChromaDB local, fonctionnel, offline-first.
2. **RAG Web (Neon)** : `document_chunks` + pgvector, planifié mais non
   implémenté.

L'ADR 002 (Web-as-buffer) a documenté que la BDD Web Neon est un tampon de
transfert, pas la source de vérité. Le RAG Web était cassé : `document_chunks`
absente de Neon, endpoint `/api/ai/rag` retournant 500.

`RAG_MIGRATION_PLAN.md` (28/09/2026) prévoit 5 phases sur 10 semaines pour
un RAG Web complet. La Phase 1 (fondations Web) couvre : embeddings, pgvector,
vectorizer.

Session 11 a reçu le mandat de peupler `document_chunks` et de valider la
chaîne technique `embeddings → pgvector → LLM`.

### Problèmes identifiés

1. **`document_chunks` absente de Neon** : la migration
   `20260929090536_add_document_chunk` était en attente depuis le 29/09.
2. **Index HNSW manquant** : sans index, la recherche pgvector est un scan
   séquentiel (lent).
3. **Bug `encodeURIComponent`** : le nom du modèle Cloudflare
   (`@cf/baai/bge-small-en-v1.5`) était URL-encodé, ce qui cassait la route
   `/ai/run/`. Erreur 400 code 7000.
4. **Paramètre `pooling` manquant** : le modèle `bge-small-en-v1.5` requiert
   `pooling: 'cls'` ou `'mean'` explicite.

## Décision

**Implémenter la Phase 1 du RAG Web : pgvector sur Neon + Cloudflare Workers AI
pour les embeddings.**

### Choix techniques

| Composant | Choix | Justification |
|---|---|---|
| Stockage vectoriel | **Neon PostgreSQL + pgvector** | Déjà dans le schéma Prisma, gratuit |
| Embeddings | **Cloudflare Workers AI** (`@cf/baai/bge-small-en-v1.5`, 384 dims) | Gratuit (10 000 neurons/jour), déjà câblé |
| LLM | **Groq** (`openai/gpt-oss-120b`) | Déjà câblé |
| Index vectoriel | **HNSW** (`m=16, ef_construction=64`) | Standard pgvector, rapide |
| Script de peuplement | **One-shot idempotent** (`scripts/vectorize-repertoire.ts`) | Simple, traçable, réversible |

### Corpus initial

- **3 JSON Neon** : métadonnées d'images + Q/R admin (3 chunks)
- **`docs/data-repertoire.json`** : arborescence industrielle (170 chunks)
- **Total** : 173 chunks

### Endpoints

- **`/api/ai/rag`** : déjà écrit, consomme `document_chunks` via pgvector
- **`/api/ai/embed`** : déjà écrit, expose `embedTexts` en HTTP

## Conséquences

### Positives

- **RAG Web opérationnel** : 173 chunks insérés, 0 NULL, test V22 réussi.
- **Chaîne validée de bout en bout** : question → embedding → pgvector →
  Groq LLM → réponse.
- **Coût quasi nul** : Cloudflare Workers AI gratuit (10 000 neurons/jour).
- **Script idempotent** : peut être relancé sans doublon
  (`ON CONFLICT (source, "chunkIndex")`).
- **Architecture cohérente** avec ADR 002 : la BDD Web est un tampon, le
  corpus riche reste dans le repo.

### Négatives

- **Corpus initial pauvre** : les 3 JSON Neon sont des métadonnées d'images
  et un Q/R trivial. Le corpus riche (`data-repertoire.json`) est dans le
  repo, pas sur Neon.
- **Pas de synchronisation Desktop ↔ Web** : Phase 4 du plan, non traitée.
- **Pas de reranking ni de validation layer** : Phase 2 du plan, non traitée.
- **Warning SSL** `pg-connection-string` (non bloquant, à traiter).

### Neutres

- **173 chunks pour ~152 équipements** : répartition cohérente (1 chunk par
  nœud de l'arborescence).
- **`randomUUID()`** utilisé pour les nouveaux `id` (au lieu de `cuid()`
  Prisma) : format UUID v4, compatible String.
- **Taille des chunks** : min 40, max 424, moyenne 76 caractères.

## Alternatives rejetées

### Alternative 1 — Groq pour les embeddings

**Rejetée** car : Groq ne fait pas d'embeddings (spécialisé LLM). Le plan
`RAG_MIGRATION_PLAN.md` mentionnait Groq par abus de langage.

### Alternative 2 — Chroma hébergé côté Web

**Rejetée** car : latence, coût d'hébergement, duplication avec le Chroma
local. Le RAG local reste suffisant pour l'usage terrain.

### Alternative 3 — Attendre Phase 2 avant de peupler

**Rejetée** car : la validation technique de Phase 1 est un prérequis pour
Phase 2. Peupler d'abord permet de tester la chaîne.

### Alternative 4 — Publier le corpus riche sur Neon avant vectorisation

**Rejetée** car : hors scope session 11. La publication est une écriture BDD
qui nécessite un mandat séparé.

### Alternative 5 — Endpoint `/api/ai/embed` pour vectoriser

**Rejetée** car : le script one-shot est plus simple, plus traçable, plus
réversible. L'endpoint reste pour un usage HTTP externe.

## Références

- **ADR précédent** : `docs/adr/002-web-as-buffer-architecture.md`
- **Snapshot BDD** : `docs/DB_STATE_2026-10-01.md`
- **Incident** : `docs/INCIDENT_2026-10-01.md`
- **Plan RAG** : `docs/RAG_MIGRATION_PLAN.md`
- **Analyse RAG** : `docs/RAG_AI_CHAT_ANALYSIS_REPORT.md`
- **Commit script** : `8a79459` — `feat(scripts): add one-shot vectorization script for document_chunks`
- **Commit fix** : `4741f38` — `fix(ai): fix Cloudflare embeddings URL and add pooling`
