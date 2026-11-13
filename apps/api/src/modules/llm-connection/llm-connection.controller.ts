import { ApiKeyAuth, Private, Public, UserAuth } from "#src/common/decorators/auth.decorator.js";
import { clientMessage } from "#src/core/error.js";
import { Body, Controller, Get, HttpCode, Logger, Param, ParseUUIDPipe, Post, Query, Res } from "@nestjs/common";
import { CrudController, Ctx, ZodPipe } from "@snipet/server-common";
import { executeLLMSchema, listLLMModelsParamsSchema, Role } from "@snipet/shared";
import { LLMStreamEventType } from "@snipet/shared/core";

import {
  createLlmConnectionSchema,
  findLlmConnectionsSchema,
  updateLlmConnectionSchema,
} from "./llm-connection.dto.js";
import { LlmConnection } from "./llm-connection.entity.js";
import { LlmConnectionService } from "./llm-connection.service.js";

import type { LLMStreamEvent } from "@snipet/shared/core";
import type { ExecuteLLM, ListLLMModelsParams } from "@snipet/shared";
import type { AppContext } from "#src/common/context/app-context.js";
import type { Response } from "express";

/**
 * CRUD is admin only and never returns credentials: secret config fields
 * come back as placeholders. Running models is open to any user and API keys.
 */
@Private(UserAuth(Role.Admin))
@Controller("llm-connections")
export class LlmConnectionController extends CrudController<LlmConnection, AppContext>({
  create: createLlmConnectionSchema,
  update: updateLlmConnectionSchema,
  filter: findLlmConnectionsSchema,
}) {
  private readonly logger = new Logger(LlmConnectionController.name);

  constructor(override readonly service: LlmConnectionService) {
    super(service);
  }

  override serialize(ctx: AppContext, conn: LlmConnection) {
    return this.service.mask(ctx, conn);
  }

  @Get(":id/models")
  findModels(@Ctx() ctx: AppContext, @Param("id", ParseUUIDPipe) id: string) {
    return this.service.findModels(ctx, id);
  }

  @Post(":id/sync")
  @HttpCode(204)
  sync(@Ctx() ctx: AppContext, @Param("id", ParseUUIDPipe) id: string) {
    return this.service.sync(ctx, id);
  }

  @Public()
  @Get("llms")
  listLLMs(@Ctx() ctx: AppContext) {
    return this.service.listManifests(ctx);
  }

  @Private(UserAuth(Role.Admin), ApiKeyAuth())
  @Get("llms/:key/models")
  listLLMModels(
    @Ctx() ctx: AppContext,
    @Param("key") key: string,
    @Query(new ZodPipe(listLLMModelsParamsSchema)) query: ListLLMModelsParams,
  ) {
    return this.service.listLLMModels(ctx, key, query.connectionId);
  }

  @Private(UserAuth(Role.Admin), ApiKeyAuth())
  @Post("execute")
  @HttpCode(200)
  execute(@Ctx() ctx: AppContext, @Body(new ZodPipe(executeLLMSchema)) dto: ExecuteLLM) {
    return this.service.generate(ctx, dto);
  }

  /**
   * Server-Sent Events. Errors before the first event (bad input, unknown
   * model...) are plain HTTP errors; after that they arrive as an "error" event.
   */
  @Private(UserAuth(Role.Admin), ApiKeyAuth())
  @Post("execute/stream")
  async executeStream(
    @Ctx() ctx: AppContext,
    @Body(new ZodPipe(executeLLMSchema)) dto: ExecuteLLM,
    @Res() res: Response,
  ) {
    const abort = new AbortController();
    res.on("close", () => abort.abort());

    const events = this.service.stream(ctx, dto, abort.signal);
    const first = await events.next();

    res.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    });
    const send = ({ event, data }: LLMStreamEvent) => res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);

    try {
      for (let result = first; !result.done; result = await events.next()) send(result.value);
      send({ event: LLMStreamEventType.DONE, data: {} });
    } catch (err) {
      if (!abort.signal.aborted) {
        const message = clientMessage(err);
        if (message === undefined) this.logger.error(err);
        send({ event: LLMStreamEventType.ERROR, data: { message: message ?? "internal error" } });
      }
    } finally {
      res.end();
    }
  }
}
