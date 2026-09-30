import { Logger } from "@nestjs/common";
import { HttpAdapterHost, NestFactory } from "@nestjs/core";

import { AppModule } from "./app.module.js";
import { DbErrorFilter } from "./common/filter/db-error.filter.js";
import { env } from "./env.js";

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.setGlobalPrefix("api");
  app.useGlobalFilters(new DbErrorFilter(app.get(HttpAdapterHost).httpAdapter));
  app.enableShutdownHooks();
  const logger = new Logger("Main");
  await app.listen(env.PORT).then(() => {
    logger.log(`App listening on port ${env.PORT}`);
  });
}

void bootstrap();
