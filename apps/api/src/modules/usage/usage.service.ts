import { AppContext } from "#src/common/context/app-context.js";
import { Agent } from "#src/modules/agent/agent.entity.js";
import { LlmConnection } from "#src/modules/llm-connection/llm-connection.entity.js";
import { Injectable } from "@nestjs/common";
import { BaseService } from "@snipet/server-common";
import { UsageGroupBy } from "@snipet/shared";
import moment from "moment";
import { EntityManager } from "typeorm";

import { UsageRecord } from "./usage-record.entity.js";

import type { UsageCall, UsageReportParams, UsageReportRow, UsageRun, UsageRunsParams } from "@snipet/shared";
const DAY_MS = 24 * 60 * 60 * 1000;

/** The most runs one listing returns, newest first. */
const RUNS_LIMIT = 200;

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

  getStartAndEnd(from: Date | undefined, to: Date | undefined): { start: Date; end: Date } {
    const end = moment(to).endOf("day").toDate();
    const start = from ?? moment(end).subtract(30, "days").startOf("day").toDate();
    return { start, end };
  }

  /** Tokens and cost per agent, model or day; groups by tokens, most first, days oldest first. */
  async report(ctx: AppContext, { from, to, groupBy, agentId }: UsageReportParams): Promise<UsageReportRow[]> {
    const { start, end } = this.getStartAndEnd(from, to);
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

  /**
   * The runs whose first call is between from and to, newest first, at most RUNS_LIMIT of
   * them, each with all its calls and their costs: a run started before midnight keeps the calls it made after.
   */
  async runs(ctx: AppContext, { from, to, agentId }: UsageRunsParams): Promise<UsageRun[]> {
    const { start, end } = this.getStartAndEnd(from, to);

    const runsQuery = this.repositoryOf(ctx, UsageRecord)
      .createQueryBuilder("u")
      .select(`u."runId"`, "runId")
      .addSelect(`u."sessionId"`, "sessionId")
      .addSelect(`MIN(u."createdAt")`, "startedAt")
      .groupBy(`u."runId"`)
      .addGroupBy(`u."sessionId"`)
      .having(`MIN(u."createdAt") >= :start AND MIN(u."createdAt") < :end`, { start, end })
      // Narrows the scan, yet reaches a day back so a run started before `start` is seen starting there,
      // not at its first call after it. ponytail: a run over a day long would still show twice; reach further back if runs ever get that long.
      .where(`u."createdAt" >= :lookback AND u."createdAt" < :end`, {
        lookback: new Date(start.getTime() - DAY_MS),
        end,
      })
      .orderBy(`MIN(u."createdAt")`, "DESC")
      .limit(RUNS_LIMIT);
    if (agentId) runsQuery.andWhere(`u."agentId" = :agentId`, { agentId });
    const runs = await runsQuery.getRawMany<Omit<UsageRun, "calls">>();
    if (runs.length === 0) return [];

    const calls = await this.repositoryOf(ctx, UsageRecord)
      .createQueryBuilder("u")
      .leftJoin(Agent, "a", `a.id = u."agentId"`)
      .leftJoin(LlmConnection, "c", `c.id = u."connectionId"`)
      .select("u.id", "id")
      .addSelect(`u."runId"`, "runId")
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
      .where(`u."runId" IN (:...runIds)`, { runIds: runs.map((run) => run.runId) })
      .orderBy(`u."createdAt"`, "ASC")
      .getRawMany<UsageCall>();

    const callsByRun = new Map<string, UsageCall[]>(runs.map((run) => [run.runId, []]));
    for (const call of calls) callsByRun.get(call.runId)?.push(call);
    return runs.map((run) => ({ ...run, calls: callsByRun.get(run.runId) ?? [] }));
  }
}
