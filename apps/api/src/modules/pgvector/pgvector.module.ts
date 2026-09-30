import { Module } from "@nestjs/common";

import { PgvectorService } from "./pgvector.service.js";

@Module({
  providers: [PgvectorService],
  exports: [PgvectorService],
})
export class PgvectorModule {}
