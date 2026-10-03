import { Logger } from "@nestjs/common";
import { DataSource } from "typeorm";

const logger = new Logger("Database");

// Creates the database named in `url` if it doesn't exist, connecting to the
// `postgres` maintenance database to do it. The DB user needs CREATEDB.
export async function ensureDatabase(url: string): Promise<void> {
  const name = decodeURIComponent(new URL(url).pathname.slice(1));
  const adminUrl = new URL(url);
  adminUrl.pathname = "/postgres";

  let admin: DataSource;
  try {
    admin = await new DataSource({ type: "postgres", url: adminUrl.toString() }).initialize();
  } catch (error) {
    // Managed DBs often deny access to `postgres`; let the real connection
    // report a missing database instead of failing here.
    logger.warn(`skipping database check: ${(error as Error).message}`);
    return;
  }
  try {
    const rows: unknown[] = await admin.query("SELECT 1 FROM pg_database WHERE datname = $1", [name]);
    if (rows.length > 0) return;
    await admin.query(`CREATE DATABASE "${name.replaceAll('"', '""')}"`);
    logger.log(`created database "${name}"`);
  } catch (error) {
    // 42P04 = duplicate_database: another instance created it first.
    if ((error as { code?: string }).code !== "42P04") throw error;
  } finally {
    await admin.destroy();
  }
}
