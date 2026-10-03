# ADR 009 — RAG Phase 2 : décisions Q1→Q8 et implémentation S20+

- **Date** : 2026-10-02 (création S19) · 2026-10-03 (décisions S20 · documentation S20.1)
- **Statut** : Accepté (décisions Q1→Q8 tranchées en S20 · implémentation en cours S20.1)
- **Session** : S19 (création) · S20 (décisions + Hybrid Search) · S20.1 (documentation)
- **Concerne** : Evolution du RAG Web (Phase 2+) — suite ADR 003 (Phase 1)
- **ADR précédent** : `docs/adr/003-rag-web-phase-1.md`
- **Incident associé** : `docs/INCIDENT_S20_E1.5_SQL_DIRECT.md`

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

### Mise à jour S20 — Hybrid Search opérationnel

La Session 20 a franchi une étape structurante de la Phase 2 : le
**Hybrid Search** (option A4 de la section « Options » de la présente
ADR) est désormais **opérationnel** en production Web.

**Composants livrés en S20 :**

| Composant | Détail | Session |
|---|---|---|
| Migration 17 | Colonne `search_vector` (`tsvector`), trigger de mise à jour automatique, index GIN | S20 (E1) |
| Peuplement | 252/252 chunks peuplés (`search_vector IS NOT NULL`) | S20 (E1) |
| Service `src/lib/ai/rag-search.ts` | Recherche hybride vector + full-text avec **RRF** (Reciprocal Rank Fusion) | S20 (E2) |
| Route `/api/ai/rag` | Modifiée pour appeler `rag-search.ts` | S20 (E2) |
| Tests | 9 tests unitaires (`vitest run`) + 3 tests manuels OK | S20 (E2) |
| Commits locaux | `69129d2` (E1) · `2084313` (E2) · `cd6a39b` (incident E1.5) | S20 |

**Incident associé — E1.5 (SQL direct hors migration) :**

Lors de la mise en place de la migration 17, une **écriture SQL directe
hors migration** a été tentée (colonne `search_vector`, trigger, index
GIN créés sans passer par `prisma migrate`). Un **rollback complet** a
été exécuté et documenté dans `docs/INCIDENT_S20_E1.5_SQL_DIRECT.md`.

**Leçon S20 :** `prisma migrate dev --create-only` (ou `migrate deploy`)
est **non négociable**. Toute écriture SQL directe doit être mandatée
explicitement.

**Conséquence sur l'ADR :** la décision Q3 (Hybrid Search) est passée
de « à trancher » à « **C1 — Hybrid Search maintenant** », et l'étape
correspondante du plan d'implémentation est passée de 📋 à ✅.

### Plan de migration RAG (référence)

`RAG_MIGRATION_PLAN.md` (28/09/2026) prévoit 5 phases sur 10 semaines :

| Phase | Semaine | Objectif | Statut S19 |
|---|---|---|
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
|---|---|---|
| **B1 — Semantic Cache** | Upstash Redis + DragonMemory compression (768→64 dims, `docs/src`) | Moyenne | Élevé |
| **B2 — HTTP Cache + ISR** | `revalidate=60`, Cache-Control headers (`RAG_MIGRATION_PLAN.md` Phase 3.1) | Faible | Moyen |
| **B3 — Rate Limiting** | Upstash Rate Limit + usage tracker (`RAG_MIGRATION_PLAN.md` Phase 3.2) | Faible | Moyen |
| **B4 — Fallbacks cascade** | RAG → keyword search → Groq direct → mock (`RAG_MIGRATION_PLAN.md` Phase 3.3) | Faible | Élevé |

### C. Qualité des réponses

| Option | Description | Complexité | Impact |
|---|---|---|
| **C1 — Validation Layer** | Context validator (couverture, hallucinations, `RAG_MIGRATION_PLAN.md` Phase 2.3) | Faible | Élevé |
| **C2 — Enrichissement corpus KCZ** | Ajouter `description_fr` métier à KCZ001/010/030 + revectoriser | Faible | Élevé |

### D. Architecture & Sync

| Option | Description | Complexité | Impact |
|---|---|---|
| **D1 — Unification chat/RAG** | Fusion `/api/ai/chat` + `/api/ai/rag` avec paramètre `rag: true` | Moyenne | Élevé (UX) |
| **D2 — Migration chat-ia** | Faire appeler `/api/ai/rag` depuis `useAiChat` + fallback (`NOTE_AI_CHAT_VS_RAG.md`) | Moyenne | Élevé |
| **D3 — Sync Desktop ↔ Web** | Bidirectionnel via `/api/sync/chunks` + Tauri (`RAG_MIGRATION_PLAN.md` Phase 4) | Élevée | Moyen |
| **D4 — Corpus riche sur Neon** | Publier `data-repertoire.json` sur Neon + revectoriser (mandat écriture BDD) | Moyenne | Élevé |

---

## Décision

**Décisions Q1→Q8 tranchées en S20. Implémentation démarrée en S20
(Hybrid Search, S-E2). Poursuite en S20.1+ selon le plan ci-dessous.**

### Décisions Q1→Q8 (Session 20)

| Q | Décision retenue | Référence option | Justification courte |
|---|---|---|---|
| **Q1** | **A2** | Enrichir `data-repertoire.json` plus tard | E5 reportée S21 — priorité architecture d'abord |
| **Q2** | **B1** | Architecture d'abord | Séquence E1→E11 : fondations avant enrichissement |
| **Q3** | **C1** | Hybrid Search maintenant | **S-E2 exécutée en S20** — colonne `search_vector` + RRF |
| **Q4** | **D2** | Unification partielle API | S-E3 à faire S20.1 — extraire services partagés |
| **Q5** | **E2** | Fallback dégradé | S-E4 à faire S20.1 — robustesse terrain |
| **Q6** | **F2** | Sync Desktop ↔ Web planifiée | S-E7 reportée S21 |
| **Q7** | **G2** | Corpus riche en S21 | S-E6 reportée S21 — source = repo (ADR 002) |
| **Q8** | **H2** | Vision RAG en Phase 3 | S-E10 retirée du périmètre Phase 2 |

### Justification

1. **Phase 1 validée techniquement** : chaîne bout en bout opérationnelle
   (252 chunks, coût quasi nul).
2. **Hybrid Search (Q3→C1) déjà exécutée en S20** : colonne `search_vector`
   peuplée à 100% (252/252), service `rag-search.ts` avec RRF, tests 9/9.
3. **Décisions métier tranchées en S20** : enrichissement KCZ (Q1→A2,
   reporté S21), unification API (Q4→D2, partielle en S20.1), fallback
   (Q5→E2, S20.1), sync Desktop (Q6→F2, S21), corpus riche (Q7→G2, S21),
   Vision RAG (Q8→H2, Phase 3).
4. **L'ADR 009 devient l'ADR de référence Phase 2** : décisions actées,
   plan d'implémentation mis à jour, livrables S20 tracés.

### Numérotation — clarification

Deux numérotations coexistent :

- **`ADR-E{n}`** : étapes du plan d'implémentation **de la présente ADR**
  (section « Plan d'implémentation » ci-dessous).
- **`S-E{n}`** : étapes **de session** (E1, E2, E3… telles qu'utilisées
  dans les prompts de passation S20/S20.1).

La correspondance est explicite dans le tableau du plan.

---

## Décisions tranchées (S20) — historique

Les questions Q1→Q8 ouvertes en S19 ont été **tranchées en S20**.
Voir section « Décision » ci-dessus pour le tableau récapitulatif.

| # | Question (rappel S19) | Décision S20 | Statut implémentation |
|---|---|---|---|
| **Q1** | Enrichir `data-repertoire.json` pour KCZ001/010/030 ? | **A2** — Plus tard (S21) | 📋 S-E5 reportée S21 |
| **Q2** | Priorité RAG Phase 2 : quel ordre d'exécution ? | **B1** — Architecture d'abord (E1→E11) | ✅ Séquence actée |
| **Q3** | Hybrid Search — maintenant ou plus tard ? | **C1** — Maintenant | ✅ **S-E2 faite S20** |
| **Q4** | Unifier `/api/ai/chat` et `/api/ai/rag` ? | **D2** — Unification partielle | 📋 S-E3 à faire S20.1 |
| **Q5** | Ajouter fallback à `/api/ai/rag` ? | **E2** — Oui, fallback dégradé | 📋 S-E4 à faire S20.1 |
| **Q6** | Sync Desktop ↔ Web — priorité ? | **F2** — Planifiée S21 | 📋 S-E7 reportée S21 |
| **Q7** | Corpus riche sur Neon — quand ? | **G2** — S21 | 📋 S-E6 reportée S21 |
| **Q8** | Vision RAG — intégrer ? | **H2** — Phase 3 | 📋 S-E10 retirée Phase 2 |

---

## Plan d'implémentation (S20.1+)

Les étapes `ADR-E{n}` ci-dessous correspondent au plan **interne à la
présente ADR**. La colonne « Session » indique la correspondance avec
les étapes **de session** (`S-E{n}`).

| Étape ADR | Description | Dépendances | Session | Statut |
|---|---|---|---|---|
| **ADR-E1** | Décision humaine sur Q1→Q8 | — | S20 | ✅ **Fait S20** |
| **ADR-E2** | Enrichir `data-repertoire.json` (si Q1=a) + revectoriser | Q1=a | S21 (S-E5) | 📋 Reporté S21 (Q1=A2) |
| **ADR-E3** | Query Cleaning (A1) + Reranking heuristique (A2) | ADR-E2 (optionnel) | S20.1+ (S-E3) | 📋 En cours S20.1 |
| **ADR-E4** | Semantic Cache (B1) + HTTP Cache (B2) | — | S21+ | 📋 Planifié |
| **ADR-E5** | Validation Layer (C1) | ADR-E3 | S21+ | 📋 Planifié |
| **ADR-E6** | Zone Routing (A5) | ADR-E3 | S21+ (S-E6) | 📋 Planifié |
| **ADR-E7** | Fallbacks cascade (B4) + Rate Limiting (B3) | ADR-E4 | S20.1 (S-E4) | 📋 À faire S20.1 |
| **ADR-E8** | Unifier routes chat/RAG (D1/D2) | ADR-E3, ADR-E7 | S20.1 (S-E3) | 📋 À faire S20.1 |
| **ADR-E9** | **Hybrid Search (A4)** | — | **S20 (S-E2)** | ✅ **Fait S20** |
| **ADR-E10** | Sync Desktop ↔ Web (D3) | ADR-E8 | S21 (S-E7) | 📋 Reporté S21 (Q6=F2) |
| **ADR-E11** | Vision RAG (D4) | — | Phase 3 (S-E10) | 📋 Retiré Phase 2 (Q8=H2) |

### Livrables S20 (acquis)

- Migration 17 : `prisma/migrations/..._add_hybrid_search_tsvector/`
- Colonne `search_vector` (`tsvector`) + trigger + index GIN
- Peuplement 252/252 chunks
- `src/lib/ai/rag-search.ts` (RRF fusion)
- `/api/ai/rag` modifié (hybrid search)
- 9 tests unitaires + 3 tests manuels OK
- `docs/INCIDENT_S20_E1.5_SQL_DIRECT.md`

### Livrables S20.1+ (cible)

- `src/lib/ai/groq-client.ts` (service partagé, S-E3)
- `src/lib/ai/rag-search.ts` (service partagé, S-E3 — déjà partiellement fait)
- `src/app/api/ai/chat/route.ts` (adaptateur mince, S-E3)
- `src/app/api/ai/rag/route.ts` (adaptateur mince, S-E3)
- Fallback dégradé dans `/api/ai/rag` (S-E4)
- `src/lib/rag/fallback-strategy.ts` (S-E4)
- `src/app/api/admin/audit-logs/route.ts` (ADR 008, S20.1)
- `src/lib/services/audit.ts` (ADR 008, S20.1)

### Règles de non-régression — MAJ S20

1. **Hybrid Search opérationnel** : la colonne `search_vector` et le
   service `rag-search.ts` sont **acquis**. Aucune modification
   destructive ne doit casser la fusion RRF.
2. **Peuplement 252/252** : toute revectorisation ou migration doit
   préserver `search_vector IS NOT NULL` pour les 252 chunks.
3. **Migration via `prisma migrate`** : toute évolution du schéma
   (colonne, trigger, index) passe par `prisma migrate dev --create-only`
   ou `migrate deploy`. **Aucune écriture SQL directe.** (Leçon S20 E1.5.)
4. **Chaîne RAG Phase 1 préservée** : pgvector + Cloudflare embeddings
   + Groq LLM + HNSW index inchangés.
5. **Endpoint `/api/ai/rag` maintenu** : ne pas casser l'existant
   pendant la refonte chat/RAG (ADR-E8).
6. **Script `vectorize-repertoire.ts` idempotent** : `ON CONFLICT
   (source, "chunkIndex")` obligatoire.
7. **Corpus source = repo** : `data-repertoire.json` reste la référence
   (ADR 002). Neon = tampon.
8. **252 chunks minimum** : ne pas descendre en dessous du snapshot T1
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
