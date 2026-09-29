import { join } from "node:path";
import { DataSourceOptions } from "typeorm";

// Paths resolve from src/ and dist/ alike.
const root = join(import.meta.dirname, "../..");
// Only .js in dist, or the .d.ts files would be loaded too.
const ext = import.meta.filename.endsWith(".ts") ? "ts" : "js";

// Shared by the app and the TypeORM CLI, so both see the same entities/migrations.
export function dataSourceOptions(url: string): DataSourceOptions {
  return {
    type: "postgres",
    url,
    entities: [join(root, `**/*.entity.${ext}`)],
    migrations: [join(root, "migrations", `*.${ext}`)],
  };
}
