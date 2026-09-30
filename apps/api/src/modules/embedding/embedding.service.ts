import { Injectable } from "@nestjs/common";
import OpenAI from "openai";

import { env } from "../../env.js";

// Text embeddings through an OpenAI-compatible API (EMBEDDING_*), apart from
// the chat models of llm-connection.
@Injectable()
export class EmbeddingService {
  private readonly client = new OpenAI({
    baseURL: env.EMBEDDING_BASE_URL,
    apiKey: env.EMBEDDING_API_KEY || "none",
  });

  // One vector per text, in order, EMBEDDING_BATCH_SIZE texts per request.
  async embed(texts: string[]): Promise<number[][]> {
    const vectors: number[][] = [];
    for (let start = 0; start < texts.length; start += env.EMBEDDING_BATCH_SIZE) {
      const batch = texts.slice(start, start + env.EMBEDDING_BATCH_SIZE);
      const res = await this.client.embeddings.create({
        model: env.EMBEDDING_MODEL,
        input: batch,
        dimensions: env.EMBEDDING_DIMENSIONS,
      });
      if (res.data.length !== batch.length) {
        throw new Error(`embed: got ${res.data.length} embeddings for ${batch.length} texts`);
      }
      vectors.push(...res.data.toSorted((a, b) => a.index - b.index).map((d) => d.embedding));
    }
    return vectors;
  }
}
