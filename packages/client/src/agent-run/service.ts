import http, { httpSse } from "../http";

import {
  agentMessageSchema, agentRunSchema, agentSessionSchema, findAgentMessagesParamsSchema, findAgentRunsParamsSchema,
  findAgentSessionsParamsSchema, paginatedAgentMessageSchema, paginatedAgentRunSchema, paginatedAgentSessionSchema,
  startAgentRunSchema,
} from "@snipet/shared";

import type {
  AgentMessage, AgentRun, AgentRunEvent, AgentSession, FindAgentMessagesParams, FindAgentRunsParams,
  FindAgentSessionsParams, Paginated, StartAgentRun,
} from "@snipet/shared";
import type { ServiceDeleteOptions, ServiceGetOptions, ServicePostOptions } from "../http";

const RUN_URL = "/api/agent-runs";
const SESSION_URL = "/api/agent-sessions";

const start = async (body: StartAgentRun, opts: ServicePostOptions<StartAgentRun, AgentRun> = {}): Promise<AgentRun> =>
  http.post({
    url: RUN_URL,
    body,
    schemas: { body: startAgentRunSchema, response: agentRunSchema },
    ...opts,
  });

const cancel = async (id: string, opts: ServicePostOptions<undefined, void> = {}): Promise<void> =>
  http.post({ url: `${RUN_URL}/{id}/cancel`, params: { id }, ...opts });

const listRuns = async (
  opts: ServiceGetOptions<Paginated<AgentRun>, Partial<FindAgentRunsParams>> = {},
): Promise<Paginated<AgentRun>> =>
  http.get({
    url: RUN_URL,
    schemas: { response: paginatedAgentRunSchema, searchParams: findAgentRunsParamsSchema },
    ...opts,
  });

// events follows a run over SSE: stored messages after lastId, then live
// events until run_finished. Resolves when the stream ends.
const events = async (
  id: string,
  lastId: number,
  onEvent: (event: AgentRunEvent) => void,
  opts: { signal?: AbortSignal } = {},
): Promise<void> =>
  httpSse({
    url: `${RUN_URL}/{id}/events`,
    method: "GET",
    params: { id },
    headers: lastId > 0 ? { "Last-Event-ID": String(lastId) } : undefined,
    signal: opts.signal,
    onEvent: (event, data) => {
      if (event === "message") data = agentMessageSchema.parse(data);
      else if (event === "run_finished") data = agentRunSchema.parse(data);
      onEvent({ event, data } as AgentRunEvent);
    },
  });

const listSessions = async (
  opts: ServiceGetOptions<Paginated<AgentSession>, Partial<FindAgentSessionsParams>> = {},
): Promise<Paginated<AgentSession>> =>
  http.get({
    url: SESSION_URL,
    schemas: { response: paginatedAgentSessionSchema, searchParams: findAgentSessionsParamsSchema },
    ...opts,
  });

const findSession = async (id: string, opts: ServiceGetOptions<AgentSession> = {}): Promise<AgentSession> =>
  http.get({ url: `${SESSION_URL}/{id}`, params: { id }, schemas: { response: agentSessionSchema }, ...opts });

const deleteSession = async (id: string, opts: ServiceDeleteOptions<void> = {}): Promise<void> =>
  http.delete({ url: `${SESSION_URL}/{id}`, params: { id }, ...opts });

// listMessages returns a session's messages newest first.
const listMessages = async (
  id: string,
  opts: ServiceGetOptions<Paginated<AgentMessage>, Partial<FindAgentMessagesParams>> = {},
): Promise<Paginated<AgentMessage>> =>
  http.get({
    url: `${SESSION_URL}/{id}/messages`,
    params: { id },
    schemas: { response: paginatedAgentMessageSchema, searchParams: findAgentMessagesParamsSchema },
    ...opts,
  });

export const agentRunService = { start, cancel, listRuns, events, listSessions, findSession, deleteSession, listMessages };
