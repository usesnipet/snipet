import http from "@/lib/http";

import {
  agentSchema, createAgentSchema, listAgentsSearchParamsSchema, paginatedAgentSchema, updateAgentSchema,
} from "./schemas";

import type { Agent, CreateAgent, ListAgentsSearchParams, PaginatedAgent, UpdateAgent } from "./schemas";
import type {
  ServiceDeleteOptions, ServiceGetOptions, ServicePostOptions, ServicePutOptions,
} from "@/lib/services";

const AGENT_URL = "/api/agent";

const list = async (
  opts: ServiceGetOptions<PaginatedAgent, ListAgentsSearchParams> = {},
): Promise<PaginatedAgent> =>
  http.get({
    url: AGENT_URL,
    schemas: { response: paginatedAgentSchema, searchParams: listAgentsSearchParamsSchema },
    ...opts,
  });

const create = async (body: CreateAgent, opts: ServicePostOptions<CreateAgent, Agent> = {}): Promise<Agent> =>
  http.post({
    url: AGENT_URL,
    body,
    schemas: { body: createAgentSchema, response: agentSchema },
    ...opts,
  });

const update = async (id: string, body: UpdateAgent, opts: ServicePutOptions<UpdateAgent, void> = {}): Promise<void> =>
  http.put({
    url: `${AGENT_URL}/{id}`,
    params: { id },
    body,
    schemas: { body: updateAgentSchema },
    ...opts,
  });

const remove = async (id: string, opts: ServiceDeleteOptions<void> = {}): Promise<void> =>
  http.delete({ url: `${AGENT_URL}/{id}`, params: { id }, ...opts });

export const agentService = { list, create, update, delete: remove };
