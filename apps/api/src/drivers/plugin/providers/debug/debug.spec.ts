import { resolveOptions } from "#src/core/manifest/options.js";
import { validateJson } from "@snipet/server-common";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { createServer, get } from "node:http";
import { tmpdir } from "node:os";
import { join } from "node:path";

import type { BaseDriver } from "#src/core/manifest/driver.js";
import type { JsonObject, ManifestDriver } from "@snipet/shared";
import { AgentRunStatus } from "@snipet/shared";
import { HookName, LLMMessagePartType } from "@snipet/shared/core";

import type { HookEvent } from "@snipet/shared/core";
import type { AddressInfo } from "node:net";
import type { HookContext } from "#src/core/plugin/driver.js";

// env is read on import: allow one loopback address to reach a fake S3 on it.
process.env.OUTBOUND_ALLOWLIST = "127.0.0.2";
const { BlockedAddressError, safeAgents } = await import("#src/infra/http/safe-fetch.js");
const { debugPath } = await import("./event-file.js");
const { DebugFsDriver } = await import("./fs.hooks.js");
const { DebugS3Driver } = await import("./s3.hooks.js");

const run = { id: "r1", sessionId: "s1", turn: 1, status: AgentRunStatus.RUNNING };
const event: HookEvent = {
  id: "0a1b2c3d-0000-0000-0000-000000000000",
  hook: HookName.TOOL_AFTER,
  payload: {
    call: { type: LLMMessagePartType.TOOL_CALL, id: "c1", name: "search", arguments: {} },
    result: { content: "ok", isError: false },
    durationMs: 1,
    error: null,
  },
  occurredAt: "2026-10-16T14:32:05.123Z",
  run,
  agent: { id: "ag1", name: "Suporte Técnico" },
  owner: { userId: "u1", appId: null, externalUserId: null, name: null },
  settings: {},
  state: {},
};
const eventPath = "2026-10-16/suporte-tecnico_ag1/s1/r1/14-32-05.123_tool.after_0a1b2c3d.json";
const context = { signal: new AbortController().signal } as HookContext;

/** The options the manifest gives its driver for a connection config. */
function optionsOf<O>(manifest: string, driver: BaseDriver<O>, config: JsonObject): O {
  const { connection, capabilities } = JSON.parse(
    readFileSync(new URL(`../../manifests/${manifest}.json`, import.meta.url), "utf8"),
  ) as { connection: never; capabilities: { hooks: ManifestDriver } };
  return resolveOptions(driver, capabilities.hooks, validateJson<JsonObject>(connection, config));
}

describe("debugPath", () => {
  it("files events by day, agent, session and run, in the order they happened", () => {
    expect(debugPath(event)).toBe(eventPath);
  });

  it("refuses ids that would leave the folder", () => {
    expect(() => debugPath({ ...event, run: { ...run, id: "../../etc" } })).toThrow("Invalid file key");
  });
});

describe("DebugFsDriver", () => {
  const driver = new DebugFsDriver();

  it("writes the event under the connection's directory", async () => {
    const dir = mkdtempSync(join(tmpdir(), "debug-fs-"));
    try {
      await driver.handle(event, optionsOf("debug-fs", driver, { dir }), context);
      expect(JSON.parse(readFileSync(join(dir, eventPath), "utf8"))).toEqual(event);
    } finally {
      rmSync(dir, { recursive: true });
    }
  });

  it("refuses a relative directory", () => {
    expect(() => optionsOf("debug-fs", driver, { dir: "storage" })).toThrow("invalid driver options");
  });
});

describe("DebugS3Driver", () => {
  const driver = new DebugS3Driver();
  const required = { bucket: "logs", accessKeyId: "id", secretAccessKey: "secret" };

  it("takes the manifest's defaults", () => {
    expect(optionsOf("debug-s3", driver, required)).toEqual({
      ...required,
      region: "us-east-1",
      prefix: "debug/",
      endpoint: "",
      forcePathStyle: false,
      timeout: 10,
    });
  });

  it("requires credentials, or the SDK would use the server's", () => {
    expect(() => optionsOf("debug-s3", driver, { bucket: "logs" })).toThrow();
    const options = { ...optionsOf("debug-s3", driver, required), accessKeyId: "" };
    expect(() => driver.validateOptions(options)).toThrow("invalid driver options");
  });

  it("puts the event in the bucket through an allowed endpoint", async () => {
    const received: { method?: string; url?: string; body: string } = { body: "" };
    const server = createServer((req, res) => {
      req.on("data", (chunk: Buffer) => (received.body += chunk.toString()));
      req.on("end", () => {
        Object.assign(received, { method: req.method, url: req.url });
        res.end();
      });
    });
    await new Promise<void>((done) => server.listen(0, "127.0.0.2", done));
    try {
      const endpoint = `http://127.0.0.2:${(server.address() as AddressInfo).port}`;
      const config = { ...required, endpoint, forcePathStyle: true };
      await driver.handle(event, optionsOf("debug-s3", driver, config), context);
      expect(received.method).toBe("PUT");
      expect(received.url?.split("?")[0]).toBe(`/logs/debug/${eventPath}`);
      expect(JSON.parse(received.body)).toEqual(event);
    } finally {
      server.close();
    }
  });

  it("gives up on the put after the connection's timeout", async () => {
    const server = createServer(() => undefined);
    await new Promise<void>((done) => server.listen(0, "127.0.0.2", done));
    try {
      const endpoint = `http://127.0.0.2:${(server.address() as AddressInfo).port}`;
      const options = optionsOf("debug-s3", driver, { ...required, endpoint, forcePathStyle: true, timeout: 1 });
      await expect(driver.handle(event, options, context)).rejects.toThrow();
    } finally {
      server.closeAllConnections();
      server.close();
    }
  });

  it.each(["http://169.254.169.254", "http://10.0.0.1:9000", "http://localhost:9000"])(
    "refuses the non-public endpoint %s",
    async (endpoint) => {
      const options = optionsOf("debug-s3", driver, { ...required, endpoint });
      await expect(driver.handle(event, options, context)).rejects.toBeInstanceOf(BlockedAddressError);
    },
  );
});

describe("safeAgents", () => {
  it("refuses a name that resolves to a non-public address when the socket connects", async () => {
    const error = await new Promise<Error>((done) => {
      get("http://localhost:1/", { agent: safeAgents.httpAgent }).on("error", done);
    });
    expect(error).toBeInstanceOf(BlockedAddressError);
  });
});
