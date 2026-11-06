import http from "../http";

import {
  agentSchema,
  availableAgentSchema,
  createAgentSchema,
  findAgentsParamsSchema,
  paginatedAgentSchema,
  updateAgentSchema,
} from "@snipet/shared";

import type { Agent, AvailableAgent, CreateAgent, FindAgentsParams, Paginated, UpdateAgent } from "@snipet/shared";
import type { ServiceDeleteOptions, ServiceGetOptions, ServicePostOptions, ServicePutOptions } from "../http";

const AGENT_URL = "/api/agents";

const list = async (
  opts: ServiceGetOptions<Paginated<Agent>, Partial<FindAgentsParams>> = {},
): Promise<Paginated<Agent>> =>
  http.get({
    url: AGENT_URL,
    schemas: { response: paginatedAgentSchema, searchParams: findAgentsParamsSchema },
    ...opts,
  });

const listAvailable = async (): Promise<AvailableAgent[]> =>
  http.get({ url: `${AGENT_URL}/available`, schemas: { response: availableAgentSchema.array() } });

const find = async (id: string): Promise<Agent> =>
  http.get({ url: `${AGENT_URL}/{id}`, params: { id }, schemas: { response: agentSchema } });

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

export const agentService = { list, listAvailable, find, create, update, delete: remove };
