import { ForbiddenException, Injectable, UnauthorizedException } from "@nestjs/common";
import { createHash, randomBytes } from "node:crypto";
import { DeepPartial, EntityManager } from "typeorm";

import { CrudService } from "@snipet/server-common";

import type { AppContext } from "#src/common/context/app-context.js";

import { ApiKey } from "./api-key.entity.js";

import type { ApiKeyWithSecret } from "@snipet/shared";

const hashKey = (key: string) => createHash("sha256").update(key).digest("hex");

/** "sn_" + 32 random bytes. The key has full entropy, so a fast hash is enough. */
function generateKey() {
  const key = `sn_${randomBytes(32).toString("base64url")}`;
  return { key, keyId: key.slice(0, 10), hash: hashKey(key) };
}

@Injectable()
export class ApiKeyService extends CrudService<ApiKey, AppContext> {
  constructor(manager: EntityManager) {
    super(manager, ApiKey);
  }

  /** Returns the plain key once; the hash stays out of the response, like every other query. */
  override async create(ctx: AppContext, dto: DeepPartial<ApiKey>): Promise<ApiKeyWithSecret> {
    const { key, ...generated } = generateKey();
    const { hash, ...apiKey } = await super.create(ctx, { ...dto, ...generated });
    return { ...apiKey, key };
  }

  /** Swaps in a new key; the previous one stops working immediately. */
  async roll(ctx: AppContext, id: string): Promise<ApiKeyWithSecret> {
    const { key, ...generated } = generateKey();
    await super.updateById(ctx, id, generated);
    return { ...(await this.findById(ctx, id)), key };
  }

  /** The active, unexpired key matching `key`; throws 401/403 otherwise. */
  async verify(ctx: AppContext, key: string): Promise<ApiKey> {
    const apiKey = await this.repository(ctx).findOneBy({ hash: hashKey(key) });
    if (!apiKey) throw new UnauthorizedException("invalid api key");
    if (!apiKey.active) throw new ForbiddenException("api key is disabled");
    if (apiKey.expiresAt && apiKey.expiresAt < new Date()) throw new ForbiddenException("api key is expired");
    return apiKey;
  }
}
