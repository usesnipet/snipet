import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { agentService } from "./service";

import type { Agent, CreateAgent, FindAgentsParams, Paginated, UpdateAgent } from "@snipet/shared";
import type { ServiceGetOptions } from "../http";
import type { UseMutationResult, UseQueryResult } from "@tanstack/react-query";

const BASE_QUERY_KEY = "agent";

export const listAgentsQueryKey = () => [BASE_QUERY_KEY] as const;
export const useListAgents = (
  opts?: ServiceGetOptions<Paginated<Agent>, Partial<FindAgentsParams>>,
): UseQueryResult<Paginated<Agent>, Error> =>
  useQuery({
    queryKey: [...listAgentsQueryKey(), opts?.searchParams],
    queryFn: () => agentService.list(opts),
  });

// useAgentMutation wraps an agent write with outcome messages and a list refresh.
const useAgentMutation = <TVariables, TData>(
  fn: (vars: TVariables) => Promise<TData>,
  successMessage: string,
  errorMessage: string,
): UseMutationResult<TData, Error, TVariables> => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: fn,
    meta: { successMessage, errorMessage },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: listAgentsQueryKey() }),
  });
};

export const useCreateAgent = (): UseMutationResult<Agent, Error, CreateAgent> =>
  useAgentMutation((data: CreateAgent) => agentService.create(data), "Agent created", "Failed to create agent");

export const useUpdateAgent = (id: string): UseMutationResult<void, Error, UpdateAgent> =>
  useAgentMutation((data: UpdateAgent) => agentService.update(id, data), "Agent updated", "Failed to update agent");

export const useDeleteAgent = (): UseMutationResult<void, Error, string> =>
  useAgentMutation((id: string) => agentService.delete(id), "Agent deleted", "Failed to delete agent");
