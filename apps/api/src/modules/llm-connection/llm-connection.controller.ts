import { Body, Controller, Get, HttpCode, Logger, Param, Post, Query, Res, UseFilters } from "@nestjs/common";
import { executeLlmSchema, listProviderModelsParamsSchema } from "@snipet/shared";

import { CrudController } from "../../common/crud/crud.controller.js";
import { AllowApiKey, Public } from "../../common/decorators/auth.decorators.js";
import { ZodPipe } from "../../common/pipes/zod.pipe.js";

import {
  createLlmConnectionSchema, findLlmConnectionsSchema, updateLlmConnectionSchema
} from "./llm-connection.dto.js";
import { LlmConnection } from "./llm-connection.entity.js";
import { LlmConnectionService } from "./llm-connection.service.js";
import { FailoverError, LlmError } from "./llm/errors.js";
import { LlmErrorFilter, toHttpException } from "./llm/llm-error.filter.js";

import type { ExecuteLlm, ListProviderModelsParams, LlmStreamEvent } from "@snipet/shared";
import type { Response } from "express";

@AllowApiKey()
@UseFilters(LlmErrorFilter)
@Controller("llm-connections")
export class LlmConnectionController extends CrudController<LlmConnection>({
  create: createLlmConnectionSchema,
  update: updateLlmConnectionSchema,
  filter: findLlmConnectionsSchema,
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

  @Get("providers/:key/models")
  listProviderModels(
    @Param("key") key: string,
    @Query(new ZodPipe(listProviderModelsParamsSchema)) query: ListProviderModelsParams,
  ) {
    return this.service.listProviderModels(key, query.connectionId);
  }

  @Post("execute")
  @HttpCode(200)
  execute(@Body(new ZodPipe(executeLlmSchema)) dto: ExecuteLlm) {
    return this.service.generate(dto);
  }

  // Server-Sent Events. Errors before the first event (bad input, unknown
  // model...) are plain HTTP errors; after that they arrive as an "error" event.
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
