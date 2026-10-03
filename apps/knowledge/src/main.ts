import { Logger } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";

import { AppModule } from "./app.module.js";
import { env } from "./env.js";

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.setGlobalPrefix("api");
  app.enableShutdownHooks();
  await app.listen(env.KNOWLEDGE_PORT);
  new Logger("Main").log(`Knowledge listening on port ${env.KNOWLEDGE_PORT}`);
}

void bootstrap();
