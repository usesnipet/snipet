import { Logger } from "@nestjs/common";
import { HttpAdapterHost, NestFactory } from "@nestjs/core";
import { DbErrorFilter } from "@snipet/server-common";
import { existsSync } from "node:fs";
import { join } from "node:path";

import { AppModule } from "./app.module.js";
import { env } from "./env.js";

import type { NestExpressApplication } from "@nestjs/platform-express";
import type { NextFunction, Request, Response } from "express";

async function bootstrap() {
  const webDir = env.WEB_DIR;
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  app.setGlobalPrefix("api");
  if (env.CORS_ORIGINS) app.enableCors({ origin: env.CORS_ORIGINS });
  if (existsSync(join(webDir, "index.html"))) {
    app.useStaticAssets(join(webDir, "assets"), {
      prefix: "/assets",
      immutable: true,
      maxAge: "1y",
      fallthrough: false,
    });
    app.useStaticAssets(webDir, { index: false });
    app.use((req: Request, res: Response, next: NextFunction) => {
      if (req.method !== "GET" || req.path.startsWith("/api/") || req.path === "/api") return next();
      res.setHeader("Cache-Control", "no-cache");
      res.sendFile(join(webDir, "index.html"));
    });
  }
  app.useGlobalFilters(new DbErrorFilter(app.get(HttpAdapterHost).httpAdapter));
  app.enableShutdownHooks();
  const logger = new Logger("Main");
  await app.listen(env.PORT).then(() => {
    logger.log(`App listening on port ${env.PORT}`);
  });
}

void bootstrap();
