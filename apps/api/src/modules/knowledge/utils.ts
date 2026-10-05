import { env } from "../../env.js";

export const knowledgeEnabled = (): boolean => {
  return Boolean(env.KNOWLEDGE_S3_BUCKET && env.PGVECTOR_URL);
};
