import http from "@/lib/http";

import {
  createUserSchema,
  findUsersParamsSchema,
  paginatedUserSchema,
  updateUserSchema,
  userSchema,
} from "@snipet/shared";

import type { CreateUser, FindUsersParams, Paginated, UpdateUser, User } from "@snipet/shared";
import type {
  ServiceDeleteOptions,
  ServiceGetOptions,
  ServicePostOptions,
  ServicePutOptions,
} from "@/lib/services";

const USERS_URL = "/api/users";

const list = async (
  opts: ServiceGetOptions<Paginated<User>, FindUsersParams> = {},
): Promise<Paginated<User>> =>
  http.get({
    url: USERS_URL,
    schemas: {
      response: paginatedUserSchema,
      searchParams: findUsersParamsSchema,
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
