import http, { httpSse } from "@/lib/http";

import {
  agentMessageSchema, agentRunSchema, agentSessionSchema, listMessagesSearchParamsSchema, listRunsSearchParamsSchema,
  listSessionsSearchParamsSchema, paginatedAgentMessageSchema, paginatedAgentRunSchema,
  paginatedAgentSessionSchema, startRunSchema,
} from "./schemas";

import type {
  AgentRun, AgentRunEvent, AgentSession, ListMessagesSearchParams, ListRunsSearchParams, ListSessionsSearchParams,
  PaginatedAgentMessage, PaginatedAgentRun, PaginatedAgentSession, StartRun,
} from "./schemas";
import type { ServiceDeleteOptions, ServiceGetOptions, ServicePostOptions } from "@/lib/services";

const RUN_URL = "/api/agent-run";
const SESSION_URL = "/api/agent-session";

const start = async (body: StartRun, opts: ServicePostOptions<StartRun, AgentRun> = {}): Promise<AgentRun> =>
  http.post({
    url: RUN_URL,
    body,
    schemas: { body: startRunSchema, response: agentRunSchema },
    ...opts,
  });

const cancel = async (id: string, opts: ServicePostOptions<undefined, void> = {}): Promise<void> =>
  http.post({ url: `${RUN_URL}/{id}/cancel`, params: { id }, ...opts });

const listRuns = async (
  opts: ServiceGetOptions<PaginatedAgentRun, ListRunsSearchParams> = {},
): Promise<PaginatedAgentRun> =>
  http.get({
    url: RUN_URL,
    schemas: { response: paginatedAgentRunSchema, searchParams: listRunsSearchParamsSchema },
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
      else if (event === "run_started" || event === "run_finished") data = agentRunSchema.parse(data);
      onEvent({ event, data } as AgentRunEvent);
    },
  });

const listSessions = async (
  opts: ServiceGetOptions<PaginatedAgentSession, ListSessionsSearchParams> = {},
): Promise<PaginatedAgentSession> =>
  http.get({
    url: SESSION_URL,
    schemas: { response: paginatedAgentSessionSchema, searchParams: listSessionsSearchParamsSchema },
    ...opts,
  });

const findSession = async (id: string, opts: ServiceGetOptions<AgentSession> = {}): Promise<AgentSession> =>
  http.get({ url: `${SESSION_URL}/{id}`, params: { id }, schemas: { response: agentSessionSchema }, ...opts });

const deleteSession = async (id: string, opts: ServiceDeleteOptions<void> = {}): Promise<void> =>
  http.delete({ url: `${SESSION_URL}/{id}`, params: { id }, ...opts });

// listMessages returns a session's messages newest first.
const listMessages = async (
  id: string,
  opts: ServiceGetOptions<PaginatedAgentMessage, ListMessagesSearchParams> = {},
): Promise<PaginatedAgentMessage> =>
  http.get({
    url: `${SESSION_URL}/{id}/messages`,
    params: { id },
    schemas: { response: paginatedAgentMessageSchema, searchParams: listMessagesSearchParamsSchema },
    ...opts,
  });

export const agentRunService = { start, cancel, listRuns, events, listSessions, findSession, deleteSession, listMessages };
