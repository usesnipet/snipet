import { BaseEntity, CrudService, maskSecrets, restoreSecrets, validateJson } from "@snipet/server-common";

import { secretFields } from "./manifest.registry.js";

import type { BaseManifest, JsonObject } from "@snipet/shared";
import type { DeepPartial, QueryDeepPartialEntity, Repository } from "typeorm";
import type { DriverRegistry, DriverTypes } from "./driver.registry.js";
import type { ManifestRegistry } from "./manifest.registry.js";

export type ConnectionEntity = BaseEntity & { config: JsonObject };

// CRUD for connections to a manifest (plugin, llm): the config is checked
// against the manifest's `connection` schema and every driver's options
// before it is saved, and secret fields never leave through `mask`.
// `keyField` is the entity column naming the manifest, e.g. "pluginKey".
export abstract class ConnectionService<
  E extends ConnectionEntity,
  M extends BaseManifest,
  D extends DriverTypes,
> extends CrudService<E> {
  protected abstract readonly keyField: keyof E & string;

  constructor(
    repo: Repository<E>,
    protected readonly manifests: ManifestRegistry<M, D>,
    protected readonly drivers: DriverRegistry<D>,
  ) {
    super(repo);
  }

  override create(dto: DeepPartial<E>): Promise<E> {
    return super.create(this.checkCreate(dto));
  }

  override async updateById(id: string, dto: QueryDeepPartialEntity<E>): Promise<void> {
    await super.updateById(id, await this.checkUpdate(id, dto));
  }

  listManifests(): M[] {
    return this.manifests.getAll();
  }

  getManifest(key: string): M {
    return this.manifests.get(key);
  }

  // Secret fields come back as placeholders.
  mask(conn: E): E {
    const config = conn.config;
    const secrets = Object.fromEntries(
      secretFields(this.manifests.get(this.keyOf(conn)))
        .filter((k) => k in config)
        .map((k) => [k, config[k]]),
    );
    return { ...conn, config: { ...config, ...maskSecrets(secrets) } };
  }

  // Checks the config against the manifest's `connection` schema, then each
  // driver's options. Returns the config with schema defaults applied.
  validateConfig(key: string, config: JsonObject = {}): JsonObject {
    const manifest = this.manifests.get(key);
    const connection = validateJson<JsonObject>(manifest.connection, config);
    for (const type of this.drivers.types()) this.drivers.resolve(manifest, type, connection);
    return connection;
  }

  // The create dto with its config validated.
  protected checkCreate(dto: DeepPartial<E>): DeepPartial<E> {
    const { [this.keyField]: key, config } = dto as Record<string, unknown>;
    return { ...dto, config: this.validateConfig(key as string, config as JsonObject | undefined) };
  }

  // The update dto with its config validated, when the key or config change.
  // Secret placeholders keep the stored values, but only for the same
  // manifest: another one must not receive this one's credentials.
  protected async checkUpdate(id: string, dto: QueryDeepPartialEntity<E>): Promise<QueryDeepPartialEntity<E>> {
    const { [this.keyField]: newKey, config: newConfig } = dto as Record<string, unknown>;
    if (newKey === undefined && newConfig === undefined) return dto;
    const existing = await this.findById(id);
    const key = (newKey as string | undefined) ?? this.keyOf(existing);
    const sameKey = key === this.keyOf(existing);
    // Reusing the stored config under another key: its secrets go out as
    // placeholders, which restoreSecrets then drops.
    const incoming = (newConfig as JsonObject | undefined) ?? (sameKey ? existing.config : this.mask(existing).config);
    const config = restoreSecrets(incoming, sameKey ? existing.config : undefined);
    return { ...dto, config: this.validateConfig(key, config) };
  }

  protected keyOf(conn: E): string {
    return conn[this.keyField] as string;
  }
}
