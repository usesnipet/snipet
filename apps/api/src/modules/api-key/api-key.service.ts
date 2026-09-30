import { ForbiddenException, Injectable, UnauthorizedException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { createHash, randomBytes } from "node:crypto";
import { DeepPartial, Repository } from "typeorm";

import { CrudService } from "../../common/crud/crud.service.js";

import { ApiKey } from "./api-key.entity.js";

import type { ApiKeyWithSecret } from "@snipet/shared";

const hashKey = (key: string) => createHash("sha256").update(key).digest("hex");

// "sn_" + 32 random bytes. The key has full entropy, so a fast hash is enough.
function generateKey() {
  const key = `sn_${randomBytes(32).toString("base64url")}`;
  return { key, keyId: key.slice(0, 10), hash: hashKey(key) };
}

@Injectable()
export class ApiKeyService extends CrudService<ApiKey> {
  constructor(@InjectRepository(ApiKey) repo: Repository<ApiKey>) {
    super(repo);
  }

  // Hash stays out of the response, like every other query.
  override async create(dto: DeepPartial<ApiKey>): Promise<ApiKeyWithSecret> {
    const { key, ...generated } = generateKey();
    const { hash, ...apiKey } = await super.create({ ...dto, ...generated });
    return { ...apiKey, key };
  }

  // Swaps in a new key; the previous one stops working immediately.
  async roll(id: string): Promise<ApiKeyWithSecret> {
    const { key, ...generated } = generateKey();
    await super.updateById(id, generated);
    return { ...(await this.findById(id)), key };
  }

  async verify(key: string): Promise<ApiKey> {
    const apiKey = await this.repo.findOneBy({ hash: hashKey(key) });
    if (!apiKey) throw new UnauthorizedException("invalid api key");
    if (!apiKey.active) throw new ForbiddenException("api key is disabled");
    if (apiKey.expiresAt && apiKey.expiresAt < new Date()) throw new ForbiddenException("api key is expired");
    return apiKey;
  }
}
