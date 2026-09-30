import http from "@/lib/http";

import {
  agentSchema, createAgentSchema, findAgentsParamsSchema, paginatedAgentSchema, updateAgentSchema,
} from "@snipet/shared";

import type { Agent, CreateAgent, FindAgentsParams, Paginated, UpdateAgent } from "@snipet/shared";
import type {
  ServiceDeleteOptions, ServiceGetOptions, ServicePostOptions, ServicePutOptions,
} from "@/lib/services";

const AGENT_URL = "/api/agents";

const list = async (
  opts: ServiceGetOptions<Paginated<Agent>, Partial<FindAgentsParams>> = {},
): Promise<Paginated<Agent>> =>
  http.get({
    url: AGENT_URL,
    schemas: { response: paginatedAgentSchema, searchParams: findAgentsParamsSchema },
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
