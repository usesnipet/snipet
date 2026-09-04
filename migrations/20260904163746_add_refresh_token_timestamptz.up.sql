-- modify "refresh_tokens" table
ALTER TABLE "refresh_tokens" ALTER COLUMN "expires_at" TYPE timestamptz, ALTER COLUMN "created_at" TYPE timestamptz, ALTER COLUMN "revoked_at" TYPE timestamptz;
