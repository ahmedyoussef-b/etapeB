# INCIDENT S20 — E1.5 SQL DIRECT HORS MIGRATION

## Contexte

- Session 20 du projet NexaFlow (ETAPE-B-CCP)
- Étape E1.5 — Reprise propre du RAG Phase 2 (Hybrid Search)
- Décisions préalables validées : E1.1 → E1.4 (schéma, migrations, base, conception)

## Chronologie

### Avant incident
- E1.1 : inspection schéma Prisma — validée
- E1.2 : inspection migrations 15, 16 — validée
- E1.3 : revue index/colonnes/extensions en base — validée
- E1.4 : décisions L1→L5 — validées (L1-A, L2-A, L3-B, L4-A, L5-B)
- Spécification migration 17 figée (colonne search_vector, trigger, index GIN)

### Incident
- E1.5 : au lieu de générer la migration via `prisma migrate dev --create-only`,
  des commandes SQL directes ont été exécutées sur Neon :
  - `CREATE EXTENSION IF NOT EXISTS unaccent` → *« already exists, skipping »*
  - `CREATE OR REPLACE FUNCTION document_chunks_search_vector_update()` → créée
  - `ALTER TABLE document_chunks ADD COLUMN search_vector tsvector` → créée
  - `DROP TRIGGER IF EXISTS ...` → *« does not exist, skipping »*
  - `CREATE INDEX document_chunks_search_vector_idx ... USING GIN` → créé
  - `UPDATE document_chunks SET search_vector = ...` → **ERROR: text search dictionary "french" does not exist (SQLSTATE 42704)**

## Diagnostic

### Violation de protocole
- Section 7 du prompt de passation : « `prisma migrate dev --create-only` obligatoire »
- Aucune migration Prisma générée
- Aucun commit Git avant écriture BDD
- Aucune validation superviseur préalable

### Infrastructure créée hors migration
- Colonne `search_vector` (tsvector, nullable) — **vide (0/252 chunks peuplés)**
- Index GIN `document_chunks_search_vector_idx` — créé mais inutile (colonne vide)
- Fonction `document_chunks_search_vector_update` — **défectueuse** (référence à un dictionnaire inexistant)
- Trigger `trg_document_chunks_search_vector` — **activé** vers fonction défectueuse

### Second incident — `unaccent` non tracée
- `unaccent` 1.1 présente dans `public` lors de la vérification post-incident
- Absente lors de E1.3 (requête 3)
- **Action antérieure non tracée** ayant installé `unaccent`
- Décision : **conserver `unaccent`** (extension globale, non destructrice, utile pour la suite)

### Erreur PostgreSQL
- `unaccent('french', content)` → ambigu
- `'french'` interprété comme nom de dictionnaire (`pg_ts_dict`) au lieu de configuration (`pg_ts_config`)
- Correction : `unaccent(coalesce(content, ''))` (sans 2e argument)

## Remédiation — Option A (Rollback complet)

### R1 — Vérification visuelle Neon
- Dérogation accordée pour S20 (contexte mono-projet, engagement humain)
- À réactiver en S21 ou dès qu'un second projet est créé

### R2 — Rollback SQL (exécuté par humain)
```sql
DROP TRIGGER IF EXISTS trg_document_chunks_search_vector ON document_chunks;
DROP FUNCTION IF EXISTS document_chunks_search_vector_update();
DROP INDEX IF EXISTS document_chunks_search_vector_idx;
ALTER TABLE document_chunks DROP COLUMN IF EXISTS search_vector;
```
- Extension `unaccent` **conservée** (non destructrice)

### R3 — Vérifications post-rollback
- V1 (colonne) : 0 ligne ✅
- V2 (index) : 0 ligne ✅
- V3 (trigger) : 0 ligne ✅
- V4 (fonction) : 0 ligne ✅

### R4 — `prisma migrate status`
- 16 migrations · Database schema is up to date ✅

## Leçon

1. **`prisma migrate dev --create-only` est non négociable** — aucune écriture SQL directe sur Neon sans migration.
2. **L'extension `unaccent` doit être installée via migration** — pas d'action hors traçabilité.
3. **La syntaxe `unaccent`** doit être `unaccent(text)` (sans regconfig) — pas `unaccent('french', text)`.
4. **Le rollback est préférable à la régularisation** après un incident SQL — discipline S17.

## Fichiers hors protocole — S20

### `snapshot-s20.mjs`

- **Origine :** créé par l'IA interne pendant les vérifications préalables S20 (check 5 — snapshot BDD)
- **Raison :** `psql` indisponible · Prisma nécessitait un driver adapter pour exécuter les COUNT(*)
- **Contenu :** script `.mjs` utilisant `PrismaClient` + `@prisma/adapter-pg` + `pg.Pool` · 5 `$queryRaw` de `COUNT(*)` · aucun secret en dur · utilise `process.env.DATABASE_URL`
- **Usage :** unique et temporaire (snapshot ponctuel)
- **Sort :** **Supprimé** (Option B)
- **Leçon :** tout script d'usage unique doit être créé dans un dossier ignoré par Git (ex : `scripts/tmp/`) ou explicitement mandaté par le superviseur

## Traçabilité

- Session : S20
- Étape : E1.5
- Incident : SQL direct hors migration
- Résolution : Rollback complet (Option A)
- Commit de documentation : à venir (R6)
- Reprise propre : à venir (R7)

## État post-incident

- Base revenue à l'état pré-incident
- 16 migrations Prisma · up to date
- 252 chunks inchangés
- Extension `unaccent` conservée (décision documentée)
- Reprise E1.5 propre à venir (via `--create-only` avec fonction corrigée)
