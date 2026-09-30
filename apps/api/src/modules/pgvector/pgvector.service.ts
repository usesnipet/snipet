import { readFileSync } from "node:fs";
import { join } from "node:path";

import { Injectable, Logger, OnModuleDestroy, OnModuleInit, ServiceUnavailableException } from "@nestjs/common";
import pg from "pg";

import { env } from "../../env.js";

import type { KnowledgeSearchResult } from "@snipet/shared";

// Dampens rank differences in Reciprocal Rank Fusion; 60 is the usual constant.
const RRF_K = 60;
// Keeps each insert well under Postgres' 65535 bind parameter limit.
const INSERT_BATCH = 500;

const tsvector = `to_tsvector('${env.FTS_LANGUAGE}'::regconfig, content)`;
const tsquery = `websearch_to_tsquery('${env.FTS_LANGUAGE}'::regconfig, $2)`;

export interface ChunkInput {
  content: string;
  metadata: Record<string, unknown>;
  embedding: number[];
}

// pgvector reads a vector from its text form, which is a JSON array.
const toVector = (v: number[]) => JSON.stringify(v);

// Knowledge chunks and their embeddings, in a Postgres apart from the main
// database (PGVECTOR_URL). Searches by vector similarity and full-text rank.
@Injectable()
export class PgvectorService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PgvectorService.name);
  private readonly pool = env.PGVECTOR_URL ? new pg.Pool({ connectionString: env.PGVECTOR_URL }) : undefined;

  async onModuleInit() {
    if (!this.pool) return;
    const schema = readFileSync(join(import.meta.dirname, "schema.sql"), "utf8")
      .replaceAll("{{DIMENSIONS}}", String(env.EMBEDDING_DIMENSIONS))
      .replaceAll("{{FTS_LANGUAGE}}", env.FTS_LANGUAGE);
    await this.pool.query(schema);
    // CREATE TABLE IF NOT EXISTS keeps an existing table as is.
    const { rows } = await this.pool.query<{ dims: number }>(
      `SELECT atttypmod AS dims FROM pg_attribute WHERE attrelid = 'knowledge_chunks'::regclass AND attname = 'embedding'`,
    );
    if (rows[0]?.dims !== env.EMBEDDING_DIMENSIONS) {
      throw new Error(
        `knowledge_chunks.embedding has ${rows[0]?.dims} dimensions but EMBEDDING_DIMENSIONS=${env.EMBEDDING_DIMENSIONS}; drop knowledge_chunks and reindex to change it`,
      );
    }
    this.logger.log("pgvector schema applied");
  }

  async onModuleDestroy() {
    await this.pool?.end();
  }

  // Swaps every chunk of the item for the given ones, atomically.
  async replaceChunks(knowledgeItemId: string, chunks: ChunkInput[]): Promise<void> {
    const client = await this.db().connect();
    try {
      await client.query("BEGIN");
      await client.query("DELETE FROM knowledge_chunks WHERE knowledge_item_id = $1", [knowledgeItemId]);
      for (let start = 0; start < chunks.length; start += INSERT_BATCH) {
        const rows: string[] = [];
        const args: unknown[] = [];
        chunks.slice(start, start + INSERT_BATCH).forEach((c, i) => {
          const p = args.length;
          rows.push(`($${p + 1}, $${p + 2}, $${p + 3}, $${p + 4}, $${p + 5})`);
          args.push(knowledgeItemId, start + i, c.content, c.metadata, toVector(c.embedding));
        });
        await client.query(
          `INSERT INTO knowledge_chunks (knowledge_item_id, chunk_index, content, metadata, embedding) VALUES ${rows.join(", ")}`,
          args,
        );
      }
      await client.query("COMMIT");
    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    } finally {
      client.release();
    }
  }

  async deleteByItemIds(ids: string[]): Promise<void> {
    if (ids.length === 0) return;
    await this.db().query("DELETE FROM knowledge_chunks WHERE knowledge_item_id = ANY($1)", [ids]);
  }

  // Ranks chunks by cosine similarity to the query embedding and by full-text
  // rank, then merges both lists with Reciprocal Rank Fusion.
  async search(query: string, embedding: number[], limit: number): Promise<KnowledgeSearchResult[]> {
    const { rows } = await this.db().query<KnowledgeSearchResult>(
      `WITH vec AS (
        SELECT id, row_number() OVER (ORDER BY embedding <=> $1) AS rank
        FROM knowledge_chunks
        ORDER BY embedding <=> $1
        LIMIT $3
      ),
      fts AS (
        SELECT id, row_number() OVER (ORDER BY ts_rank_cd(${tsvector}, q) DESC) AS rank
        FROM knowledge_chunks, ${tsquery} q
        WHERE ${tsvector} @@ q
        ORDER BY ts_rank_cd(${tsvector}, q) DESC
        LIMIT $3
      )
      SELECT c.id, c.knowledge_item_id AS "knowledgeItemId", c.chunk_index AS "chunkIndex", c.content, c.metadata,
        (COALESCE(1.0 / (${RRF_K} + vec.rank), 0) + COALESCE(1.0 / (${RRF_K} + fts.rank), 0))::float8 AS score
      FROM vec
      FULL OUTER JOIN fts USING (id)
      JOIN knowledge_chunks c USING (id)
      ORDER BY score DESC
      LIMIT $4`,
      [toVector(embedding), query, limit * 4, limit],
    );
    return rows;
  }

  private db(): pg.Pool {
    if (!this.pool) throw new ServiceUnavailableException("knowledge is not configured (PGVECTOR_URL)");
    return this.pool;
  }
}
