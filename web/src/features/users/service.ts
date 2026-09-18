import http from "@/lib/http";

import {
  createUserSchema,
  listUsersSearchParamsSchema,
  paginatedUserSchema,
  updateUserSchema,
  userSchema,
} from "./schemas";

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

const USERS_URL = "/api/users";

const list = async (
  opts: ServiceGetOptions<PaginatedUser, ListUsersSearchParams> = {},
): Promise<PaginatedUser> =>
  http.get({
    url: USERS_URL,
    schemas: {
      response: paginatedUserSchema,
      searchParams: listUsersSearchParamsSchema,
    },
    ...opts,
  });

const findById = async (
  id: string,
  opts: ServiceGetOptions<User> = {},
): Promise<User> =>
  http.get({
    url: `${USERS_URL}/{id}`,
    params: { id },
    schemas: { response: userSchema },
    ...opts,
  });

const create = async (
  body: CreateUser,
  opts: ServicePostOptions<CreateUser, User> = {},
): Promise<User> =>
  http.post({
    url: USERS_URL,
    body,
    schemas: { body: createUserSchema, response: userSchema },
    ...opts,
  });

const update = async (
  id: string,
  body: UpdateUser,
  opts: ServicePutOptions<UpdateUser, void> = {},
): Promise<void> =>
  http.put({
    url: `${USERS_URL}/{id}`,
    params: { id },
    body,
    schemas: { body: updateUserSchema },
    ...opts,
  });

const remove = async (id: string, opts: ServiceDeleteOptions<void> = {}): Promise<void> =>
  http.delete({
    url: `${USERS_URL}/{id}`,
    params: { id },
    ...opts,
  });

export const usersService = { list, findById, create, update, delete: remove };
