// Data source for the TypeORM CLI (see the migration:* scripts).
import { DataSource } from "typeorm";

import { env } from "../../env.js";
import { dataSourceOptions } from "./data-source.js";
import { ensureDatabase } from "./ensure-database.js";

await ensureDatabase(env.DATABASE_URL);

export default new DataSource(dataSourceOptions(env.DATABASE_URL));
