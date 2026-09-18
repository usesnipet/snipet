-- reverse: modify "refresh_tokens" table
ALTER TABLE "refresh_tokens" ALTER COLUMN "revoked_at" TYPE timestamp, ALTER COLUMN "created_at" TYPE timestamp, ALTER COLUMN "expires_at" TYPE timestamp;
