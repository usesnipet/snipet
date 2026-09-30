import { HttpException, Injectable, Logger } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { AgentRunStatus } from "@snipet/shared";
import { In, Repository } from "typeorm";

import { Agent } from "../agent/agent.entity.js";
import { LlmConnectionService } from "../llm-connection/llm-connection.service.js";
import { FailoverError, LlmError } from "../llm-connection/llm/errors.js";
import { toHttpException } from "../llm-connection/llm/llm-error.filter.js";
import { Tool } from "../tool/tool.entity.js";
import { ToolService } from "../tool/tool.service.js";

import { AgentMessage, AgentRun } from "./agent-run.entity.js";
import { AgentRunEvents } from "./agent-run.events.js";

import type { LlmMessage, LlmToolCallPart, LlmTool, ToolResult } from "@snipet/shared";

// The agent loop: call the models, run the tools they ask for, feed the
// results back, until a reply without tool calls or maxTurns LLM calls.
@Injectable()
export class AgentRunner {
  private readonly logger = new Logger(AgentRunner.name);

  constructor(
    @InjectRepository(AgentRun) private readonly runs: Repository<AgentRun>,
    @InjectRepository(AgentMessage) private readonly messages: Repository<AgentMessage>,
    @InjectRepository(Tool) private readonly tools: Repository<Tool>,
    private readonly llm: LlmConnectionService,
    private readonly toolService: ToolService,
    private readonly events: AgentRunEvents,
  ) {}

  // Answers the session's history, which ends with the run's user message.
  // Never throws: the outcome is written to the run.
  async run(agent: Agent, run: AgentRun): Promise<void> {
    // Opened before the first await, so a cancel right after start lands.
    const signal = this.events.open(run.id);
    let status = AgentRunStatus.MAX_TURNS;
    let error: string | null = null;
    let turns = 0;

    try {
      const stored = await this.messages.find({ where: { sessionId: run.sessionId }, order: { id: "ASC" } });
      const history: LlmMessage[] = stored.map(({ role, parts }) => ({ role, parts }));
      const system: LlmMessage[] = agent.systemPrompt
        ? [
            { role: "system", parts: [{ type: "text", text: agent.systemPrompt }] },
            { role: "system", parts: [{ type: "text", text: `Your name is ${agent.name}` }] },
          ]
        : [];
      const { tools, toolIds } = await this.resolveTools(agent);
      const targets = agent.llms.map((llm) => ({
        model: llm.model,
        connectionId: llm.connectionId ?? undefined,
        extraOptions: llm.extraOptions ?? undefined,
      }));

      while (turns < agent.maxTurns) {
        turns++;
        let reply: LlmMessage | undefined;
        let model: string | null = null;
        const stream = this.llm.stream({ targets, messages: [...system, ...history], tools }, signal);
        for await (const event of stream) {
          if (event.event === "llm_started") model = event.data.llm;
          else if (event.event === "text_delta") this.events.emit(run.id, event);
          else if (event.event === "message") reply = event.data.message;
        }
        if (!reply) throw new Error("llm stream ended without a message");
        history.push(await this.save(run, reply, model));

        const calls = reply.parts.filter((p): p is LlmToolCallPart => p.type === "tool_call");
        if (calls.length === 0) {
          status = AgentRunStatus.COMPLETED;
          break;
        }
        // Every call gets a result, even after a cancel, or the next run's
        // history would have calls the providers reject as unanswered.
        for (const call of calls) {
          const result: ToolResult = signal.aborted
            ? { content: "cancelled", isError: true }
            : await this.callTool(toolIds.get(call.name), call);
          const parts = [{ type: "tool_result" as const, toolCallId: call.id, ...result }];
          history.push(await this.save(run, { role: "tool", parts }, null));
        }
        signal.throwIfAborted();
      }
    } catch (err) {
      if (signal.aborted) {
        status = AgentRunStatus.CANCELLED;
      } else {
        status = AgentRunStatus.FAILED;
        error = describe(err);
        if (error === INTERNAL_ERROR) this.logger.error(err);
      }
    }

    try {
      await this.runs.update(run.id, { status, error, turns, finishedAt: new Date() });
      this.events.emit(run.id, { event: "run_finished", data: await this.runs.findOneByOrFail({ id: run.id }) });
    } catch (err) {
      // The session was deleted mid-run.
      this.logger.warn(`finish agent run ${run.id}: ${String(err)}`);
    } finally {
      this.events.close(run.id);
    }
  }

  private async save(run: AgentRun, { role, parts }: LlmMessage, model: string | null): Promise<LlmMessage> {
    const message = await this.messages.save(
      this.messages.create({ sessionId: run.sessionId, runId: run.id, role, parts, model }),
    );
    this.events.emit(run.id, { event: "message", data: message });
    return { role, parts };
  }

  private async callTool(toolId: string | undefined, call: LlmToolCallPart): Promise<ToolResult> {
    if (!toolId) return { content: `unknown tool "${call.name}"`, isError: true };
    try {
      return await this.toolService.execute(toolId, (call.arguments ?? {}) as Record<string, unknown>);
    } catch (err) {
      return { content: err instanceof Error ? err.message : String(err), isError: true };
    }
  }

  // The tools of the agent's MCP servers that pass the grant's allow/deny.
  // Names are made unique and provider-safe; toolIds maps them back.
  private async resolveTools(agent: Agent): Promise<{ tools?: LlmTool[]; toolIds: Map<string, string> }> {
    const toolIds = new Map<string, string>();
    if (agent.mcpServers.length === 0) return { toolIds };

    const grants = new Map(agent.mcpServers.map((g) => [g.mcpServerId, g]));
    const available = await this.tools.find({
      where: { mcpServerId: In([...grants.keys()]) },
      order: { name: "ASC" },
    });
    const tools: LlmTool[] = [];
    for (const tool of available) {
      if (!isGranted(tool.name, grants.get(tool.mcpServerId!)!)) continue;
      const base = tool.name.replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 60);
      let name = base;
      for (let n = 2; toolIds.has(name); n++) name = `${base}_${n}`;
      toolIds.set(name, tool.id);
      tools.push({ name, description: tool.description, parameters: tool.inputSchema });
    }
    return { tools: tools.length ? tools : undefined, toolIds };
  }
}

// Empty allow means every tool; deny wins.
export function isGranted(name: string, { allow, deny }: { allow: string[]; deny: string[] }): boolean {
  const matches = (glob: string) => globToRegExp(glob).test(name);
  return (allow.length === 0 || allow.some(matches)) && !deny.some(matches);
}

// Only "*" is special: any run of characters.
const globToRegExp = (glob: string) =>
  new RegExp(
    `^${glob
      .split("*")
      .map((s) => s.replace(/[.+?^${}()|[\]\\]/g, "\\$&"))
      .join(".*")}$`,
  );

const INTERNAL_ERROR = "internal error";

// Client-safe message for a failed run: LLM errors never carry the raw
// provider message, which may hold hosts or credentials.
function describe(err: unknown): string {
  if (err instanceof LlmError || err instanceof FailoverError) err = toHttpException(err);
  return err instanceof HttpException ? err.message : INTERNAL_ERROR;
}
