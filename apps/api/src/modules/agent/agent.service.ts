import { storageKeyOf } from "#src/infra/storage/utils.js";
import { secretFields } from "#src/core/manifest/manifest.registry.js";
import { BadRequestException, Injectable, Logger, NotFoundException } from "@nestjs/common";
import { CrudService, maskSecrets, restoreSecrets, validateJson } from "@snipet/server-common";
import { hookHandlersOf } from "@snipet/shared";
import { EntityManager, QueryDeepPartialEntity } from "typeorm";

import { FilesStorage } from "../files/files.storage.js";
import { PluginConnectionService } from "../plugin-connection/plugin-connection.service.js";

import { Agent, AgentLlm, AgentPluginConnection } from "./agent.entity.js";

import type { AppContext } from "#src/common/context/app-context.js";
import type { FilterQuery } from "@snipet/server-common";
import type {
  AgentSummary,
  AvailableAgent,
  CreateAgent,
  HookHandler,
  HookName,
  JsonObject,
  Paginated,
  UpdateAgent,
} from "@snipet/shared";

type PluginGrant = NonNullable<CreateAgent["pluginConnections"]>[number];

@Injectable()
export class AgentService extends CrudService<Agent, AppContext> {
  private readonly logger = new Logger(AgentService.name);

  constructor(
    manager: EntityManager,
    private readonly filesStorage: FilesStorage,
    private readonly pluginConnectionService: PluginConnectionService,
  ) {
    super(manager, Agent);
  }

  /** Enabled agents, with only the fields safe to show users who can't manage them. */
  findAvailable(ctx: AppContext): Promise<AvailableAgent[]> {
    return this.repository(ctx).find({
      select: { id: true, name: true, description: true, avatar: true },
      where: { enabled: true },
      order: { name: "ASC" },
      loadEagerRelations: false,
    });
  }

  /**
   * A page of agents for listing. Selects only what a summary shows, so no
   * settings or configs get unsealed; order and position let the entity sort.
   */
  async findSummaries(
    ctx: AppContext,
    { where, order, take, skip }: FilterQuery<Agent>,
  ): Promise<Paginated<AgentSummary>> {
    const total = await this.repository(ctx).count({ where });
    const agents = await this.repository(ctx).find({
      select: {
        id: true,
        name: true,
        description: true,
        avatar: true,
        enabled: true,
        createdAt: true,
        updatedAt: true,
        llms: { id: true, model: true, order: true },
        pluginConnections: {
          id: true,
          pluginConnectionId: true,
          position: true,
          pluginConnection: { id: true, name: true },
        },
      },
      relations: { llms: true, pluginConnections: { pluginConnection: true } },
      loadEagerRelations: false,
      where,
      order,
      take,
      skip,
    });
    const data = agents.map(({ llms, pluginConnections, ...agent }) => ({
      ...agent,
      llms: llms.map(({ model }) => ({ model })),
      pluginConnections: pluginConnections.map((grant) => ({
        pluginConnectionId: grant.pluginConnectionId,
        name: grant.pluginConnection!.name,
      })),
    }));
    return { data, total, skip, take };
  }

  /** The agent as the API returns it: secret settings come back as placeholders. */
  async mask(ctx: AppContext, agent: Agent): Promise<Agent> {
    const manifests = await this.pluginConnectionService.manifestsOf(
      ctx,
      agent.pluginConnections.map((g) => g.pluginConnectionId),
    );
    const pluginConnections = agent.pluginConnections.map((grant) => {
      const manifest = manifests.get(grant.pluginConnectionId);
      // A plugin gone from the catalog: which fields are secret is unknown.
      const secrets = manifest ? secretFields(manifest.settings) : Object.keys(grant.settings);
      const masked = Object.fromEntries(secrets.filter((k) => k in grant.settings).map((k) => [k, grant.settings[k]]));
      return { ...grant, settings: { ...grant.settings, ...maskSecrets(masked) } };
    });
    return { ...agent, pluginConnections } as Agent;
  }

  override async create(ctx: AppContext, dto: CreateAgent): Promise<Agent> {
    const pluginConnections = dto.pluginConnections && (await this.preparePlugins(ctx, dto.pluginConnections));
    const avatar = await this.storeAvatar(dto.avatar);
    // The position in llms is the order they run in.
    const llms = dto.llms.map((llm, order) => ({ ...llm, order }));
    try {
      const repo = this.repository(ctx);
      const { id } = await repo.save(repo.create({ ...dto, avatar, llms, pluginConnections }));
      return this.findById(ctx, id);
    } catch (error) {
      if (avatar) await this.removeFile(avatar);
      throw error;
    }
  }

  // llms and pluginConnections, when sent, replace the agent's whole list.
  override async updateById(ctx: AppContext, id: string, dto: QueryDeepPartialEntity<Agent>): Promise<void> {
    const { llms, pluginConnections, avatar: avatarInput, ...rest } = dto as UpdateAgent;
    const avatar = await this.storeAvatar(avatarInput);
    const fields = avatar === undefined ? rest : { ...rest, avatar };
    let previousAvatar: string | null = null;
    try {
      await this.transaction(ctx, async (ctx) => {
        const agentRepo = this.repository(ctx);
        const llmRepo = this.repositoryOf(ctx, AgentLlm);
        const pluginConnectionRepo = this.repositoryOf(ctx, AgentPluginConnection);
        const current = await agentRepo.findOne({
          where: { id },
          select: { id: true, avatar: true },
          loadEagerRelations: false,
        });
        if (!current) throw new NotFoundException("Agent not found");
        previousAvatar = current.avatar;
        if (Object.keys(fields).length) await agentRepo.update(id, fields);
        if (llms) {
          await llmRepo.delete({ agentId: id });
          await llmRepo.save(llms.map((llm, order) => ({ ...llm, order, agentId: id })));
        }
        if (pluginConnections) {
          const stored = await pluginConnectionRepo.find({ where: { agentId: id } });
          const grants = await this.preparePlugins(ctx, pluginConnections, stored);
          await pluginConnectionRepo.delete({ agentId: id });
          const rows = grants.map((grant) => ({ ...grant, agentId: id }));
          await pluginConnectionRepo.insert(rows as QueryDeepPartialEntity<AgentPluginConnection>[]);
        }
      });
    } catch (error) {
      if (avatar) await this.removeFile(avatar);
      throw error;
    }
    if (avatar !== undefined && previousAvatar) await this.removeFile(previousAvatar);
  }

  override async deleteById(ctx: AppContext, id: string): Promise<void> {
    const agent = await this.repository(ctx).findOne({
      where: { id },
      select: { id: true, avatar: true },
      loadEagerRelations: false,
    });
    await super.deleteById(ctx, id);
    if (agent?.avatar) await this.removeFile(agent.avatar);
  }

  /**
   * The grants as stored: position from the list order, settings validated
   * against the plugin's manifest (secret placeholders keep the stored
   * values), and only hooks with an optional handler kept as disabled.
   */
  private async preparePlugins(ctx: AppContext, grants: PluginGrant[], stored: AgentPluginConnection[] = []) {
    const manifests = await this.pluginConnectionService.manifestsOf(
      ctx,
      grants.map((g) => g.pluginConnectionId),
    );
    return grants.map((grant, position) => {
      if (!manifests.has(grant.pluginConnectionId)) {
        throw new BadRequestException(`plugin connection ${grant.pluginConnectionId} not found`);
      }
      const manifest = manifests.get(grant.pluginConnectionId);
      const previous = stored.find((s) => s.pluginConnectionId === grant.pluginConnectionId);
      const incoming = restoreSecrets(grant.settings ?? {}, previous?.settings);
      // A plugin gone from the catalog can't be checked: its grant is kept as sent.
      if (!manifest) return { ...grant, position, settings: incoming };
      const settings = manifest.settings ? validateJson<JsonObject>(manifest.settings, incoming) : {};
      const hooks = manifest.capabilities.hooks;
      const handlers = hooks ? hookHandlersOf(hooks) : new Map<HookName, HookHandler>();
      const disabledHooks = (grant.disabledHooks ?? []).filter((hook) => handlers.get(hook)?.optional);
      return { ...grant, position, settings, disabledHooks };
    });
  }

  /**
   * A data URL is uploaded and becomes its stored path, null clears the
   * avatar, and anything else (the current avatar's URL) leaves it as is.
   */
  private async storeAvatar(avatar: string | null | undefined): Promise<string | null | undefined> {
    if (avatar?.startsWith("data:")) return this.filesStorage.putDataUrl("agents", avatar);
    return avatar === null ? null : undefined;
  }

  /** An orphaned file is harmless; a failed cleanup must not fail the request. */
  private async removeFile(pathOrUrl: string) {
    await this.filesStorage.delete(storageKeyOf(pathOrUrl)).catch((error: unknown) => {
      this.logger.warn(`Could not delete ${pathOrUrl}: ${String(error)}`);
    });
  }
}
