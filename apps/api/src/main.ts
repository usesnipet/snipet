import { HttpAdapterHost, NestFactory } from "@nestjs/core";

import { AppModule } from "./app.module.js";
import { DbErrorFilter } from "./common/filter/db-error.filter.js";

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.useGlobalFilters(new DbErrorFilter(app.get(HttpAdapterHost).httpAdapter));
  await app.listen(process.env.PORT ?? 3000);
}
void bootstrap();
