import { AppContext } from "#src/common/context/app-context.js";
import { Agent } from "#src/modules/agent/agent.entity.js";
import { LlmConnection } from "#src/modules/llm-connection/llm-connection.entity.js";
import { Injectable } from "@nestjs/common";
import { BaseService } from "@snipet/server-common";
import { UsageGroupBy } from "@snipet/shared";
import moment from "moment";
import { EntityManager } from "typeorm";

import { UsageRecord } from "./usage-record.entity.js";

import type { UsageCall, UsageCallsParams, UsageReportParams, UsageReportRow } from "@snipet/shared";
const DAY_MS = 24 * 60 * 60 * 1000;

/** The most calls one listing returns, newest first. */
const CALLS_LIMIT = 500;

/** The SQL each groupBy groups on. */
const groupKeys: Record<UsageGroupBy, string> = {
  [UsageGroupBy.AGENT]: `u."agentId"::text`,
  [UsageGroupBy.DAY]: `to_char(u."createdAt" AT TIME ZONE 'UTC', 'YYYY-MM-DD')`,
};

/** One call's input cost: cached tokens are part of inputTokens, charged at their own price when there is one. Prices are per 1M tokens. */
const CALL_INPUT_COST = `((u."inputTokens" - u."cachedInputTokens") * u."inputPrice"
  + u."cachedInputTokens" * COALESCE(u."cachedInputPrice", u."inputPrice")) / 1e6`;
const CALL_OUTPUT_COST = `(u."outputTokens" * u."outputPrice") / 1e6`;
const INPUT_COST = `SUM(${CALL_INPUT_COST})`;
const OUTPUT_COST = `SUM(${CALL_OUTPUT_COST})`;

/** Reads the usage_records ledger the agent runs write. */
@Injectable()
export class UsageService extends BaseService<AppContext> {
  constructor(manager: EntityManager) {
    super(manager);
  }

  /** Tokens and cost per agent, model or day; groups by tokens, most first, days oldest first. */
  async report(ctx: AppContext, { from, to, groupBy, agentId }: UsageReportParams): Promise<UsageReportRow[]> {
    const end = to ?? new Date();
    const start = from ?? moment(end).subtract(30, "days").startOf("day").toDate();
    const key = groupKeys[groupBy];
    const isByAgent = groupBy === UsageGroupBy.AGENT;

    // float8: sums of int and numeric come back from pg as strings.
    const query = this.repositoryOf(ctx, UsageRecord)
      .createQueryBuilder("u")
      .select(key, "key")
      .addSelect(isByAgent ? "a.name" : "NULL", "label")
      .addSelect("COUNT(*)::int", "calls")
      .addSelect(`SUM(u."inputTokens")::float8`, "inputTokens")
      .addSelect(`SUM(u."outputTokens")::float8`, "outputTokens")
      .addSelect(`SUM(u."cachedInputTokens")::float8`, "cachedInputTokens")
      .addSelect(`(${INPUT_COST})::float8`, "inputCost")
      .addSelect(`(${OUTPUT_COST})::float8`, "outputCost")
      .where(`u."createdAt" >= :start AND u."createdAt" < :end`, { start, end })
      .groupBy(key);
    if (agentId) query.andWhere(`u."agentId" = :agentId`, { agentId });
    if (isByAgent) query.leftJoin(Agent, "a", `a.id = u."agentId"`).addGroupBy("a.name");
    if (groupBy === UsageGroupBy.DAY) query.orderBy("key", "ASC");
    else query.orderBy(`SUM(u."inputTokens" + u."outputTokens")`, "DESC");

    const rows = await query.getRawMany<Omit<UsageReportRow, "cost">>();
    return rows.map((row) => ({
      ...row,
      cost: row.inputCost === null && row.outputCost === null ? null : (row.inputCost ?? 0) + (row.outputCost ?? 0),
    }));
  }

  /** The calls between from and to, newest first, each with its cost; at most CALLS_LIMIT of them. */
  async calls(ctx: AppContext, { from, to, agentId }: UsageCallsParams): Promise<UsageCall[]> {
    const end = to ?? new Date();
    const start = from ?? new Date(end.getTime() - DAY_MS);

    const query = this.repositoryOf(ctx, UsageRecord)
      .createQueryBuilder("u")
      .leftJoin(Agent, "a", `a.id = u."agentId"`)
      .leftJoin(LlmConnection, "c", `c.id = u."connectionId"`)
      .select("u.id", "id")
      .addSelect(`u."createdAt"`, "createdAt")
      .addSelect(`u."agentId"`, "agentId")
      .addSelect("a.name", "agentName")
      .addSelect("u.model", "model")
      .addSelect(`u."connectionId"`, "connectionId")
      .addSelect("c.name", "connectionName")
      .addSelect(`u."inputTokens"`, "inputTokens")
      .addSelect(`u."outputTokens"`, "outputTokens")
      .addSelect(`u."cachedInputTokens"`, "cachedInputTokens")
      // Null when the model had no price, as both prices then are.
      .addSelect(`(${CALL_INPUT_COST} + ${CALL_OUTPUT_COST})::float8`, "cost")
      .where(`u."createdAt" >= :start AND u."createdAt" < :end`, { start, end })
      .orderBy(`u."createdAt"`, "DESC")
      .limit(CALLS_LIMIT);
    if (agentId) query.andWhere(`u."agentId" = :agentId`, { agentId });
    return query.getRawMany<UsageCall>();
  }
}
