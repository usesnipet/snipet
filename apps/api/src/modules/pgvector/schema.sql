-- Applied on every boot, so every statement must be idempotent.
-- {{DIMENSIONS}} and {{FTS_LANGUAGE}} come from EMBEDDING_DIMENSIONS and
-- FTS_LANGUAGE; changing either needs knowledge_chunks dropped and reindexed.
-- HNSW indexes vectors of at most 2000 dimensions.

CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE IF NOT EXISTS knowledge_chunks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  -- knowledge_items lives in the main database: no foreign key.
  knowledge_item_id uuid NOT NULL,
  chunk_index integer NOT NULL,
  content text NOT NULL,
  metadata jsonb NOT NULL DEFAULT '{}',
  embedding vector({{DIMENSIONS}}) NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_knowledge_chunks_item ON knowledge_chunks (knowledge_item_id);

CREATE INDEX IF NOT EXISTS idx_knowledge_chunks_embedding
  ON knowledge_chunks USING hnsw (embedding vector_cosine_ops);

-- Queries must use this exact expression to hit the index.
CREATE INDEX IF NOT EXISTS idx_knowledge_chunks_fts_{{FTS_LANGUAGE}}
  ON knowledge_chunks USING gin (to_tsvector('{{FTS_LANGUAGE}}'::regconfig, content));
