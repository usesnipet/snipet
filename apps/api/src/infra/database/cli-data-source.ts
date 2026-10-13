// Data source for the TypeORM CLI (see the migration:* scripts).
import { DataSource } from "typeorm";

import { env } from "#src/env.js";
import { dataSourceOptions } from "./data-source.js";
import { ensureDatabase } from "@snipet/server-common";

await ensureDatabase(env.DATABASE_URL);

export default new DataSource(dataSourceOptions(env.DATABASE_URL));
