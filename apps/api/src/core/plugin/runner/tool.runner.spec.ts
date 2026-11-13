import { LLMMessagePartType } from "@snipet/shared/core";

import { CoreError, CoreErrorCode } from "../../error.js";

import { ToolRunner } from "./tool.runner.js";

import type { LLMToolResult } from "@snipet/shared/core";
import type { PluginTool } from "./tool.runner.js";

/** A tool of connection `connectionId` that answers with `execute`. */
function pluginTool(
  name: string,
  connectionId: string,
  execute: PluginTool["execute"] = () => Promise.resolve({ content: name, isError: false }),
): PluginTool {
  return {
    tool: { name, description: `does ${name}`, inputSchema: { type: "object" } },
    source: { id: connectionId, name: `Plugin ${connectionId}` },
    execute,
  };
}

const callOf = (name: string, args: unknown = {}) => ({
  type: LLMMessagePartType.TOOL_CALL as const,
  id: "c1",
  name,
  arguments: args,
});

describe("ToolRunner", () => {
  it("offers the tools sorted, renamed unique and provider-safe, described with their plugin", () => {
    const tools = new ToolRunner([pluginTool("search", "p2"), pluginTool("a.b", "p1"), pluginTool("search", "p1")]);
    expect(tools.tools.map((t) => [t.name, t.description])).toEqual([
      ["a_b", "[Plugin p1] does a.b"],
      ["search", "[Plugin p1] does search"],
      ["search_2", "[Plugin p2] does search"],
    ]);
    expect(tools.sourceOf("search_2")).toEqual({ id: "p2", name: "Plugin p2" });
    expect(tools.sourceOf("nope")).toBeNull();
    expect(tools.has("a_b")).toBe(true);
  });

  it("runs a call on the tool its name stands for, with its arguments", async () => {
    const seen: unknown[] = [];
    const tools = new ToolRunner([
      pluginTool("search", "p1", (args) => {
        seen.push(args);
        return Promise.resolve({ content: "found", isError: false });
      }),
    ]);
    await expect(tools.call(callOf("search", { q: "x" }))).resolves.toEqual({ content: "found", isError: false });
    expect(seen).toEqual([{ q: "x" }]);
  });

  it("turns an unknown tool and a failure into error results", async () => {
    const invalid = new CoreError(CoreErrorCode.INVALID_JSON_SCHEMA, "Invalid JSON schema", { details: ["q"] });
    const tools = new ToolRunner([
      pluginTool("bad", "p1", () => Promise.reject(invalid)),
      pluginTool("down", "p1", () => Promise.reject(new Error("unreachable"))),
    ]);
    const results: LLMToolResult[] = await Promise.all([
      tools.call(callOf("nope")),
      tools.call(callOf("bad")),
      tools.call(callOf("down")),
    ]);
    expect(results).toEqual([
      { content: 'unknown tool "nope"', isError: true },
      { content: '{"message":"Invalid JSON schema","details":["q"]}', isError: true },
      { content: "unreachable", isError: true },
    ]);
  });
});
