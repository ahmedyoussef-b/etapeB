-- HNSW index for cosine similarity search on document_chunks
-- This index accelerates the `embedding <=> query::vector` operations used in /api/ai/rag
CREATE INDEX IF NOT EXISTS "document_chunks_embedding_hnsw_idx"
  ON "document_chunks"
  USING hnsw (embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);

-- Optional: GIN index on metadata for JSONB filtering if needed later
-- CREATE INDEX IF NOT EXISTS "document_chunks_metadata_idx" ON "document_chunks" USING GIN (metadata);
