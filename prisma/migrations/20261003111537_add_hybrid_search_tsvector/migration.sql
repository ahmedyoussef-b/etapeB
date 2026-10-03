-- Migration: add_hybrid_search_tsvector
-- Session 20 — RAG Phase 2 · E1 (Fondations)
-- Ajout d'une colonne tsvector + index GIN + trigger pour Hybrid Search.
-- Fonction corrigée : unaccent(content) sans regconfig (leçon incident E1.5).
-- Migration rédigée manuellement (ADR 006 — dette Prisma/pgvector/HNSW).

-- 1. Extension unaccent (déjà installée, IF NOT EXISTS par sécurité)
CREATE EXTENSION IF NOT EXISTS unaccent;

-- 2. Fonction wrapper pour trigger
CREATE OR REPLACE FUNCTION document_chunks_search_vector_update()
RETURNS trigger AS $$
BEGIN
  NEW.search_vector :=
    to_tsvector('french', unaccent(coalesce(NEW.content, '')));
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 3. Colonne search_vector
ALTER TABLE "document_chunks"
  ADD COLUMN IF NOT EXISTS "search_vector" tsvector;

-- 4. Trigger
DROP TRIGGER IF EXISTS trg_document_chunks_search_vector ON "document_chunks";
CREATE TRIGGER trg_document_chunks_search_vector
  BEFORE INSERT OR UPDATE OF content
  ON "document_chunks"
  FOR EACH ROW
  EXECUTE FUNCTION document_chunks_search_vector_update();

-- 5. Peuplement initial des chunks existants
UPDATE "document_chunks"
SET search_vector =
  to_tsvector('french', unaccent(coalesce(content, '')))
WHERE search_vector IS NULL;

-- 6. Index GIN (en dernier — plus rapide après peuplement)
CREATE INDEX IF NOT EXISTS "document_chunks_search_vector_idx"
  ON "document_chunks"
  USING GIN (search_vector);
