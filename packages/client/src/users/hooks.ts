import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { usersService } from "./service";

import type { CreateUser, FindUsersParams, Paginated, UpdateUser, User } from "@snipet/shared";
import type {
  ServiceDeleteOptions,
  ServiceGetOptions,
  ServicePostOptions,
  ServicePutOptions,
} from "../http";
import type { UseMutationResult, UseQueryResult } from "@tanstack/react-query";

const BASE_QUERY_KEY = "users";

export const listUsersQueryKey = () => [BASE_QUERY_KEY] as const;
export const useListUsers = (
  opts?: ServiceGetOptions<Paginated<User>, FindUsersParams>,
): UseQueryResult<Paginated<User>, Error> =>
  useQuery({
    queryKey: [...listUsersQueryKey(), opts?.searchParams],
    queryFn: () => usersService.list(opts),
  });

export const userQueryKey = (id: string) => [BASE_QUERY_KEY, id] as const;
export const useUser = (
  id: string,
  opts?: ServiceGetOptions<User>,
): UseQueryResult<User, Error> =>
  useQuery({
    queryKey: userQueryKey(id),
    queryFn: () => usersService.findById(id, opts),
    enabled: !!id,
  });

export const useCreateUser = (
  opts?: ServicePostOptions<CreateUser, User>,
): UseMutationResult<User, Error, { data: CreateUser }> => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ data }) => usersService.create(data, opts),
    meta: { successMessage: "User created", errorMessage: "Failed to create user" },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: listUsersQueryKey() }),
  });
};

export const useUpdateUser = (
  opts?: ServicePutOptions<UpdateUser, void>,
): UseMutationResult<void, Error, { id: string, data: UpdateUser }> => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ data, id }) => usersService.update(id, data, opts),
    meta: { successMessage: "User updated", errorMessage: "Failed to update user" },
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: listUsersQueryKey() });
      queryClient.invalidateQueries({ queryKey: userQueryKey(id) });
    },
  });
};

export const useDeleteUser = (
  opts?: ServiceDeleteOptions<void>,
): UseMutationResult<void, Error, string> => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => usersService.delete(id, opts),
    meta: { successMessage: "User deleted", errorMessage: "Failed to delete user" },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: listUsersQueryKey() }),
  });
};
