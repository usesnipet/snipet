import { useMutation, useQuery } from "@tanstack/react-query";

import { toast } from "@/hooks/use-toast";
import { queryClient } from "@/lib/query-client";

import { usersService } from "./service";

import type {
  CreateUser,
  ListUsersSearchParams,
  PaginatedUser,
  UpdateUser,
  User,
} from "./schemas";
import type {
  ServiceDeleteOptions,
  ServiceGetOptions,
  ServicePostOptions,
  ServicePutOptions,
} from "@/lib/services";
import type { UseMutationResult, UseQueryResult } from "@tanstack/react-query";

const BASE_QUERY_KEY = "users";

export const listUsersQueryKey = () => [BASE_QUERY_KEY] as const;
export const useListUsers = (
  opts?: ServiceGetOptions<PaginatedUser, ListUsersSearchParams>,
): UseQueryResult<PaginatedUser, Error> =>
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
): UseMutationResult<User, Error, { data: CreateUser }> =>
  useMutation({
    mutationFn: ({ data }) => usersService.create(data, opts),
    onSuccess: () => {
      toast({ title: "User created" });
      queryClient.invalidateQueries({ queryKey: listUsersQueryKey() });
    },
    onError: () => {
      toast({ title: "Failed to create user", variant: "destructive" });
    },
  });

export const useUpdateUser = (
  opts?: ServicePutOptions<UpdateUser, void>,
): UseMutationResult<void, Error, { id: string, data: UpdateUser }> =>
  useMutation({
    mutationFn: ({ data, id }) => usersService.update(id, data, opts),
    onSuccess: (_, { id }) => {
      toast({ title: "User updated" });
      queryClient.invalidateQueries({ queryKey: listUsersQueryKey() });
      queryClient.invalidateQueries({ queryKey: userQueryKey(id) });
    },
    onError: () => {
      toast({ title: "Failed to update user", variant: "destructive" });
    },
  });

export const useDeleteUser = (
  opts?: ServiceDeleteOptions<void>,
): UseMutationResult<void, Error, string> =>
  useMutation({
    mutationFn: (id: string) => usersService.delete(id, opts),
    onSuccess: () => {
      toast({ title: "User deleted" });
      queryClient.invalidateQueries({ queryKey: listUsersQueryKey() });
    },
    onError: () => {
      toast({ title: "Failed to delete user", variant: "destructive" });
    },
  });
