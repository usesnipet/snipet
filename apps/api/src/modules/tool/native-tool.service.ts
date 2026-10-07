import { Injectable, Logger, OnApplicationBootstrap } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { ToolSource } from "@snipet/shared";
import { In, Not, Repository } from "typeorm";

import { KnowledgeItemService } from "../knowledge/knowledge-item.service.js";
import { knowledgeEnabled } from "../knowledge/utils.js";

import { Tool } from "./tool.entity.js";

interface NativeTool {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
  // Arguments arrive already validated against inputSchema.
  run(args: Record<string, unknown>): Promise<string>;
}

// Tools implemented by the API itself. Their rows in `tools` are synced on
// boot, so they list and execute like MCP tools; every agent gets them.
@Injectable()
export class NativeToolService implements OnApplicationBootstrap {
  private readonly logger = new Logger(NativeToolService.name);
  private readonly tools = new Map<string, NativeTool>();

  constructor(
    @InjectRepository(Tool) private readonly repo: Repository<Tool>,
    knowledge: KnowledgeItemService,
  ) {
    if (knowledgeEnabled()) this.add(searchKnowledge(knowledge));
  }

  private add(tool: NativeTool) {
    this.tools.set(tool.name, tool);
  }

  // Upserts the available tools and drops the rows of the rest (e.g. knowledge
  // got unconfigured). ponytail: no lock, replicas booting together may
  // insert a duplicate row; add a unique (source, name) index if that bites.
  async onApplicationBootstrap() {
    for (const { name, description, inputSchema } of this.tools.values()) {
      const existing = await this.repo.findOneBy({ source: ToolSource.NATIVE, name });
      await this.repo.save({
        ...existing,
        name,
        description,
        inputSchema,
        source: ToolSource.NATIVE,
        mcpServerId: null,
      });
    }
    const names = [...this.tools.keys()];
    const { affected } = await this.repo.delete({
      source: ToolSource.NATIVE,
      ...(names.length ? { name: Not(In(names)) } : {}),
    });
    if (affected) this.logger.log(`removed ${affected} unavailable native tools`);
  }

  async run(name: string, args: Record<string, unknown>): Promise<string> {
    const tool = this.tools.get(name);
    if (!tool) throw new Error(`native tool "${name}" is not available`);
    return tool.run(args);
  }
}

const searchKnowledge = (knowledge: KnowledgeItemService): NativeTool => ({
  name: "search_knowledge",
  description:
    "Searches the knowledge base and returns the most relevant excerpts, each with its source document. " +
    "Use it to answer questions about the organization's documents.",
  inputSchema: {
    type: "object",
    required: ["query"],
    properties: {
      query: { type: "string", minLength: 1, maxLength: 1000, description: "What to look for, in natural language." },
      limit: { type: "integer", minimum: 1, maximum: 20, description: "Maximum excerpts to return. Default 5." },
    },
  },
  run: async ({ query, limit }) => {
    const results = await knowledge.search(query as string, (limit as number | undefined) ?? 5);
    if (results.length === 0) return "No results found.";
    return JSON.stringify(results.map(({ content, metadata }) => ({ ...metadata, content })));
  },
});
