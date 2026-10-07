import { Body, Controller, Get, HttpCode, Logger, Param, Post, Query, Res, UseFilters } from "@nestjs/common";
import { executeLlmSchema, listProviderModelsParamsSchema, Role } from "@snipet/shared";

import { CrudController, maskSecrets, ZodPipe } from "@snipet/server-common";

import {
  createLlmConnectionSchema,
  findLlmConnectionsSchema,
  updateLlmConnectionSchema,
} from "./llm-connection.dto.js";
import { LlmConnection } from "./llm-connection.entity.js";
import { LlmConnectionService } from "./llm-connection.service.js";
import { FailoverError, LlmError } from "../../infra/llm/errors.js";
import { LlmErrorFilter, toHttpException } from "../../common/filter/llm-error.filter.js";

import type { ExecuteLlm, ListProviderModelsParams, LlmConnectionOptions, LlmStreamEvent } from "@snipet/shared";
import type { Response } from "express";
import { ApiKeyAuth, Private, Public, UserAuth } from "../../common/decorators/auth.decorator.js";

// CRUD is admin only and never returns credentials: `auth` values come back
// as placeholders. Running models is open to any user and API keys.
@Private(UserAuth(Role.Admin))
@UseFilters(LlmErrorFilter)
@Controller("llm-connections")
export class LlmConnectionController extends CrudController<LlmConnection>({
  create: createLlmConnectionSchema,
  update: updateLlmConnectionSchema,
  filter: findLlmConnectionsSchema,
  serialize: (conn: LlmConnection) => {
    const { auth } = conn.config as LlmConnectionOptions;
    return auth ? { ...conn, config: { ...conn.config, auth: maskSecrets(auth) } } : conn;
  },
}) {
  private readonly logger = new Logger(LlmConnectionController.name);

  constructor(override readonly service: LlmConnectionService) {
    super(service);
  }

  @Public()
  @Get("providers")
  listProviders() {
    return this.service.listProviders();
  }

  @Private(UserAuth(), ApiKeyAuth())
  @Get("providers/:key/models")
  listProviderModels(
    @Param("key") key: string,
    @Query(new ZodPipe(listProviderModelsParamsSchema)) query: ListProviderModelsParams,
  ) {
    return this.service.listProviderModels(key, query.connectionId);
  }

  @Private(UserAuth(), ApiKeyAuth())
  @Post("execute")
  @HttpCode(200)
  execute(@Body(new ZodPipe(executeLlmSchema)) dto: ExecuteLlm) {
    return this.service.generate(dto);
  }

  // Server-Sent Events. Errors before the first event (bad input, unknown
  // model...) are plain HTTP errors; after that they arrive as an "error" event.
  @Private(UserAuth(), ApiKeyAuth())
  @Post("execute/stream")
  async executeStream(@Body(new ZodPipe(executeLlmSchema)) dto: ExecuteLlm, @Res() res: Response) {
    const abort = new AbortController();
    res.on("close", () => abort.abort());

    const events = this.service.stream(dto, abort.signal);
    const first = await events.next();

    res.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    });
    const send = ({ event, data }: LlmStreamEvent) => res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);

    try {
      for (let result = first; !result.done; result = await events.next()) send(result.value);
      send({ event: "done", data: {} });
    } catch (err) {
      if (!abort.signal.aborted) {
        if (!(err instanceof LlmError || err instanceof FailoverError)) this.logger.error(err);
        const message =
          err instanceof LlmError || err instanceof FailoverError ? toHttpException(err).message : "internal error";
        send({ event: "error", data: { message } });
      }
    } finally {
      res.end();
    }
  }
}
