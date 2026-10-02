# ADR 009 — RAG Phase 2 : planification et report à S20+

- **Date** : 2026-10-02
- **Statut** : Accepté (décision de report)
- **Session** : S19 (Session 19)
- **Concerne** : Evolution du RAG Web (Phase 2+) — suite ADR 003 (Phase 1)
- **ADR précédent** : `docs/adr/003-rag-web-phase-1.md`

## Contexte

L'application NexaFlow dispose d'un RAG (Retrieval Augmented Generation)
Web opérationnel depuis la Session 11 (ADR 003 — RAG Web Phase 1).

### État Phase 1 (implémentée S11)

| Composant | Choix | Statut |
|---|---|---|
| Stockage vectoriel | Neon PostgreSQL + pgvector | ✅ Opérationnel |
| Embeddings | Cloudflare Workers AI (`@cf/baai/bge-small-en-v1.5`, 384 dims) | ✅ Gratuit (10k neurons/jour) |
| LLM | Groq (`openai/gpt-oss-120b`) | ✅ Câblé |
| Index vectoriel | HNSW (`m=16, ef_construction=64`) | ✅ Actif |
| Script peuplement | One-shot idempotent (`scripts/vectorize-repertoire.ts`) | ✅ `ON CONFLICT (source, "chunkIndex")` |
| Endpoints | `/api/ai/rag` (RAG pgvector), `/api/ai/embed` (expose embedTexts) | ✅ En place |

**Corpus initial Phase 1 (S11) :**
- 3 JSON Neon : métadonnées d'images + Q/R admin (3 chunks)
- `docs/data-repertoire.json` : arborescence industrielle (170 chunks)
- **Total S11 : 173 chunks**

**Corpus actuel (snapshot T1, S19) :**
- Enrichissement intervenu en **S12** (hors périmètre de la présente ADR).
- **Total actuel : 252 chunks** dans `document_chunks`.

**Chaîne validée de bout en bout :** question → embedding → pgvector →
Groq LLM → réponse.

**Architecture cohérente avec ADR 002 :** la BDD Web Neon est un tampon
de transfert, pas la source de vérité. Le corpus riche (`data-repertoire.json`)
reste dans le repo.

### Plan de migration RAG (référence)

`RAG_MIGRATION_PLAN.md` (28/09/2026) prévoit 5 phases sur 10 semaines :

| Phase | Semaine | Objectif | Statut S19 |
|---|---|---|---|
| **Phase 1** | S1-2 | Fondations Web (pgvector, embeddings, vectorizer) | ✅ **FAIT** |
| **Phase 2** | S3-4 | Enrichissement (query cleaning, reranking, cache, validation, zone routing) | ⏸️ Non initié |
| **Phase 3** | S5-6 | Stabilisation (HTTP cache, rate limiting, fallbacks) | ⏸️ Non initié |
| **Phase 4** | S7-8 | Desktop enrichi + Sync bidirectionnel | ⏸️ Non initié |
| **Phase 5** | S9-10 | Optimisations (compression, late chunking, vision RAG) | ⏸️ Non initié |

### Limitations connues de Phase 1

Le RAG Web est fonctionnel mais présente des limitations documentées
depuis les sessions 13 à 18.

---

## Problème

Deux limitations critiques et deux limitations structurelles bloquent
l'adoption du RAG Web en production.

### Limitation critique 1 — Échec rappel KCZ001/010/030

Les codes système `KCZ001`, `KCZ010`, `KCZ030` (`SYSTEM/KCZ*`) sont
absents du top-20 des résultats RAG depuis la Session 13 (5 sessions).

**Causes identifiées (`NOTE_KCZ001_010_030_RAG.md`) :**
- Chunks courts (~65 caractères) → embedding peu discriminant.
- Labels génériques (`AA01-1 SYSTEM FUNCTION`) sans description métier.
- Pas de `description_fr` / `description_en` dans `data-repertoire.json`.
- Contexte limité (seul parent : `SYSTEM`).
- Moteur RAG basique : vector similarity uniquement, pas de hybrid search,
  pas de reranking.

**Options de correction documentées :**
- (a) Enrichir `data-repertoire.json` avec descriptions métier.
- (b) Query expansion (synonymes métier dans `cleanQuery`).
- (c) Reranking cross-encoder.
- (d) Hybrid search (vector + full-text).

### Limitation critique 2 — Architecture chat vs RAG divisée

Deux routes API coexistent pour l'IA :

| Caractéristique | `/api/ai/chat` | `/api/ai/rag` |
|---|---|---|
| Fichier | `src/app/api/ai/chat/route.ts` (102 lignes) | `src/app/api/ai/rag/route.ts` (148 lignes) |
| RAG | ❌ Non | ✅ Oui |
| Embedding | ❌ | ✅ Cloudflare |
| Recherche pgvector | ❌ | ✅ |
| Fallback | Mock `generateAssistantAdvice` | Aucun (erreur 500 si échec) |
| Appelé par | `useAiChat` (chat-ia) | Jamais appelé |

**Conséquence :** `chat-ia` utilise `/api/ai/chat` → réponse **sans base
de connaissances**. Cela explique l'hallucination constatée en S14
(`CFI = Control Function Interface` au lieu de `FILTRATION EAU DE
REFRIGERATION`).

`/api/ai/rag` existe, implémente RAG complet, mais **n'est jamais
utilisé** par le frontend et **n'a aucun fallback**.

**Options documentées (`NOTE_AI_CHAT_VS_RAG.md`) :**
- (a) Documenter les rôles des deux routes.
- (b) Unifier : faire appeler `/api/ai/rag` depuis `chat-ia`.
- (c) Supprimer `/api/ai/chat`, migrer `chat-ia` vers `/api/ai/rag`.
- (d) Fusionner en une route unifiée chat+RAG.
- (e) Reporter la décision à S20+.

### Limitation structurelle 3 — Phases 2-3 du plan non traitées

Les fonctionnalités prévues en Phases 2-3 du plan de migration ne sont
pas implémentées :

| Fonctionnalité | Phase | Impact |
|---|---|---|
| Query cleaning / reranking | Phase 2.1 | Précision retrieval |
| Semantic cache | Phase 2.2 | Coût/latence Groq |
| Validation layer | Phase 2.3 | Hallucinations non détectées |
| Zone routing | Phase 2.4 | Précision retrieval (+25% estimé) |
| HTTP cache / ISR | Phase 3.1 | Charge Vercel |
| Rate limiting / quotas | Phase 3.2 | Protection quotas Groq/Vercel |
| Fallbacks en cascade | Phase 3.3 | Disponibilité < 99.9% |

### Limitation structurelle 4 — Sync Desktop ↔ Web absente

- Phase 4 du plan non initiée.
- Desktop (ChromaDB local + ONNX) et Web (pgvector + Groq) sont des
  silos indépendants.
- Aucun mécanisme bidirectionnel de synchronisation.

---

## Analyse technique

### Composants actuels (héritage Phase 1)

| Composant | Technologie | Statut S19 |
|---|---|---|
| Vector DB | Neon PostgreSQL + pgvector | ✅ Opérationnel |
| Embeddings | Cloudflare Workers AI (`bge-small-en-v1.5`, 384 dims) | ✅ Gratuit, 10k/jour |
| Index vectoriel | HNSW (`m=16, ef_construction=64`) | ✅ Actif |
| LLM | Groq (`openai/gpt-oss-120b`) | ✅ Câblé |
| Corpus | 252 chunks (snapshot T1, enrichissement S12) | ⚠️ Pauvre (corpus riche dans le repo) |
| Endpoint RAG | `/api/ai/rag` | ⚠️ Non utilisé par le frontend, sans fallback |
| Endpoint chat | `/api/ai/chat` | ⚠️ Utilisé par `chat-ia`, sans RAG |
| Script peuplement | `scripts/vectorize-repertoire.ts` | ✅ Idempotent |

### Limitations techniques identifiées

1. **Retrieval basique** : vector similarity seule (cosine), pas de
   reranking, pas de hybrid search.
2. **Pas de nettoyage de requête** : les 44 préfixes de
   `src/lib/ai/query-cleaning.ts` ne sont pas appliqués à `/api/ai/chat`.
3. **Pas de cache** : chaque requête = embedding + LLM (coût Groq,
   latence).
4. **Pas de validation** : hallucinations non détectées, couverture
   sémantique non mesurée.
5. **Architecture bifurquée** : deux routes indépendantes avec finalités
   floues (`chat` = libre, `rag` = documenté), mais `chat-ia` utilise
   `chat` au lieu de `rag`.

### Écart `docs/src` vs production

`docs/src` contient une plateforme RAG complète (12 collections ChromaDB,
9-phase pipeline, agentic, vision RAG, DragonMemory compression) mais
n'est pas intégrée à la production `src/`.

La production `src/` reste minimaliste : `askLocalRag` / `searchLocalRag`
via Tauri.

`docs/src` est une **référence stratégique** pour les innovations à
migrer (zone routing, semantic cache, validation), pas un blueprint à
copier tel quel.

---

## Options

Les options sont regroupées par thème.

### A. Précision du retrieval

| Option | Description | Complexité | Impact |
|---|---|---|---|
| **A1 — Query Cleaning** | Strip 44 préfixes (`src/lib/ai/query-cleaning.ts`) + synonymes métier (ex: `KCZ` → `system function`) | Faible | Élevé |
| **A2 — Reranking heuristique** | Boost `path` ×1.5, `chunk` ×1.1 (`RAG_MIGRATION_PLAN.md` Phase 2.1) | Faible | Élevé |
| **A3 — Reranking cross-encoder** | Modèle dédié (ex: `cross-encoder/ms-marco-MiniLM-L-6-v2`) | Moyenne | Élevé |
| **A4 — Hybrid Search** | Vector + full-text (inverted index sur `chunk`) | Élevée | Élevé |
| **A5 — Zone Routing** | Détection équipement/zone → filtre SQL LIKE (`RAG_MIGRATION_PLAN.md` Phase 2.4) | Faible | Élevé |

### B. Coût, latence, disponibilité

| Option | Description | Complexité | Impact |
|---|---|---|---|
| **B1 — Semantic Cache** | Upstash Redis + DragonMemory compression (768→64 dims, `docs/src`) | Moyenne | Élevé |
| **B2 — HTTP Cache + ISR** | `revalidate=60`, Cache-Control headers (`RAG_MIGRATION_PLAN.md` Phase 3.1) | Faible | Moyen |
| **B3 — Rate Limiting** | Upstash Rate Limit + usage tracker (`RAG_MIGRATION_PLAN.md` Phase 3.2) | Faible | Moyen |
| **B4 — Fallbacks cascade** | RAG → keyword search → Groq direct → mock (`RAG_MIGRATION_PLAN.md` Phase 3.3) | Faible | Élevé |

### C. Qualité des réponses

| Option | Description | Complexité | Impact |
|---|---|---|---|
| **C1 — Validation Layer** | Context validator (couverture, hallucinations, `RAG_MIGRATION_PLAN.md` Phase 2.3) | Faible | Élevé |
| **C2 — Enrichissement corpus KCZ** | Ajouter `description_fr` métier à KCZ001/010/030 + revectoriser | Faible | Élevé |

### D. Architecture & Sync

| Option | Description | Complexité | Impact |
|---|---|---|---|
| **D1 — Unification chat/RAG** | Fusion `/api/ai/chat` + `/api/ai/rag` avec paramètre `rag: true` | Moyenne | Élevé (UX) |
| **D2 — Migration chat-ia** | Faire appeler `/api/ai/rag` depuis `useAiChat` + fallback (`NOTE_AI_CHAT_VS_RAG.md`) | Moyenne | Élevé |
| **D3 — Sync Desktop ↔ Web** | Bidirectionnel via `/api/sync/chunks` + Tauri (`RAG_MIGRATION_PLAN.md` Phase 4) | Élevée | Moyen |
| **D4 — Corpus riche sur Neon** | Publier `data-repertoire.json` sur Neon + revectoriser (mandat écriture BDD) | Moyenne | Élevé |

---

## Décision

**Report de l'implémentation de la RAG Phase 2 à S20+ avec mandat humain.**

### Justification

1. **Phase 1 validée techniquement** : la chaîne bout en bout est
   opérationnelle (252 chunks, test V22 réussi, coût quasi nul).
2. **Limitations critiques identifiées mais nécessitent des décisions
   métier** : enrichissement du corpus KCZ (qui fournit les descriptions ?),
   unification des routes chat/RAG (impact UX), priorisation des chantiers.
3. **Phases 2-3 du plan représentent des chantiers structurants** :
   reranking, cache sémantique, validation layer, fallbacks — ces choix
   ne peuvent être décidés en fin de S19 sans mandat humain explicite.
4. **L'ADR 009 acte la planification, pas l'exécution** : elle formalise
   les options, les questions et le plan d'implémentation pour S20+.

---

## Questions à trancher (S20+)

| # | Question | Options | Source |
|---|----------|---------|--------|
| **Q1** | Enrichir `data-repertoire.json` pour KCZ001/010/030 ? | (a) Oui — expert métier fournit descriptions → revectoriser / (b) Non — investir RAG (A1-A5, B1-B4, C1-C2) | `NOTE_KCZ001_010_030_RAG.md` |
| **Q2** | Priorité RAG Phase 2 : quel ordre d'exécution ? | Reranking → Query cleaning → Semantic Cache → Validation → Zone Routing (ordre à confirmer) | `RAG_MIGRATION_PLAN.md` Phases 2-3 |
| **Q3** | Hybrid Search (vector + full-text) — maintenant ou plus tard ? | Maintenant (A4, complexe) / Phase 3+ / Jamais (pgvector suffit) | `RAG_MIGRATION_PLAN.md` Phase 1.2, `NOTE_KCZ001_010_030_RAG.md` |
| **Q4** | Unifier `/api/ai/chat` et `/api/ai/rag` ? | (a) Fusionner en `/api/ai/chat` avec `rag: true` / (b) Supprimer `/api/ai/chat`, migrer `chat-ia` / (c) Conserver deux routes, documenter | `NOTE_AI_CHAT_VS_RAG.md` |
| **Q5** | Ajouter fallback à `/api/ai/rag` ? | Oui (cascade B4) / Non | `NOTE_AI_CHAT_VS_RAG.md` |
| **Q6** | Sync Desktop ↔ Web — priorité ? | Maintenant (D3) / Phase 3+ / Jamais | `RAG_MIGRATION_PLAN.md` Phase 4 |
| **Q7** | Corpus riche sur Neon — quand ? | Maintenant (D4, mandat écriture BDD) / Plus tard / Jamais (repo = source, ADR 002) | ADR 003, `RAG_MIGRATION_PLAN.md` |
| **Q8** | Vision RAG — intégrer ? | Oui (D4, TensorFlow.js MobileNet) / Non / Plus tard | `RAG_MIGRATION_PLAN.md` Phase 5.3 |

---

## Plan d'implémentation (S20+)

Les étapes sont conditionnées par les réponses aux questions Q1→Q8.

| Étape | Description | Dépendances | Statut S19 |
|---|---|---|---|
| **E1** | Décision humaine sur Q1→Q8 | — | ⏸️ En attente |
| **E2** | Enrichir `data-repertoire.json` (si Q1 = a) + revectoriser | Q1 = a | 📋 Planifié |
| **E3** | Implémenter Query Cleaning (A1) + Reranking heuristique (A2) | E2 (optionnel) | 📋 Planifié |
| **E4** | Implémenter Semantic Cache (B1) + HTTP Cache (B2) | — | 📋 Planifié |
| **E5** | Implémenter Validation Layer (C1) | E3 | 📋 Planifié |
| **E6** | Implémenter Zone Routing (A5) | E3 | 📋 Planifié |
| **E7** | Implémenter Fallbacks cascade (B4) + Rate Limiting (B3) | E4 | 📋 Planifié |
| **E8** | Unifier routes chat/RAG (D1/D2 selon Q4) | E3, E7 | 📋 Planifié |
| **E9** | Implémenter Hybrid Search (A4) si Q3 = Maintenant | E3 | 📋 Planifié |
| **E10** | Implémenter Sync Desktop ↔ Web (D3) si Q6 = Maintenant | E8 | 📋 Planifié |
| **E11** | Implémenter Vision RAG (D4) si Q8 = Oui | — | 📋 Planifié |

**Livrables S20+ :**
- `src/lib/rag/query-cleaner.ts` (A1)
- `src/lib/rag/reranker.ts` (A2)
- `src/lib/rag/semantic-cache.ts` (B1)
- `src/lib/rag/validators/context-validator.ts` (C1)
- `src/lib/rag/zone-router.ts` (A5)
- `src/lib/rag/fallback-strategy.ts` (B4)
- `src/lib/api/rate-limit.ts` (B3)
- `src/app/api/ai/chat/route.ts` modifié (unification D1/D2)
- `src/app/api/sync/chunks/route.ts` (D3, si Q6 = Maintenant)
- `src/lib/vision/vision-rag.ts` (D4, si Q8 = Oui)

---

## Règles de non-régression

1. **Chaîne RAG Phase 1 préservée** : pgvector + Cloudflare embeddings
   + Groq LLM + HNSW index ne doivent pas être modifiés pendant les
   chantiers Phase 2+.
2. **Endpoint `/api/ai/rag` maintenu** : ne pas casser l'existant pendant
   la refonte chat/RAG (E8).
3. **Script `vectorize-repertoire.ts` idempotent** : toute revectorisation
   (E2, E9) doit utiliser `ON CONFLICT (source, "chunkIndex")`.
4. **Corpus source = repo** : `data-repertoire.json` reste la référence
   immuable (ADR 002). Neon = tampon de transfert.
5. **252 chunks minimum** : ne pas descendre en dessous du snapshot T1
   sans validation humaine explicite.

---

## Références

1. `docs/adr/003-rag-web-phase-1.md` — ADR Phase 1 (implémentée S11)
2. `docs/adr/002-web-as-buffer-architecture.md` — BDD Web = tampon
3. `docs/RAG_MIGRATION_PLAN.md` — Plan 10 semaines / 5 phases
4. `docs/RAG_AI_CHAT_ANALYSIS_REPORT.md` — Analyse `docs/src` vs production
5. `docs/NOTE_KCZ001_010_030_RAG.md` — Cas KCZ (échec rappel S13-18)
6. `docs/NOTE_AI_CHAT_VS_RAG.md` — Problème architecture chat vs RAG
7. `src/app/api/ai/chat/route.ts` — Route chat actuelle (102 lignes)
8. `src/app/api/ai/rag/route.ts` — Route RAG actuelle (148 lignes)
9. `src/lib/ai/use-ai-chat.ts` — Hook frontend (254 lignes)
10. `scripts/vectorize-repertoire.ts` — Script peuplement idempotent
