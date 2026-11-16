import { AgentRunStatus } from "@snipet/shared";
import { HookAction, HookName } from "@snipet/shared/core";
import { createServer } from "node:http";

import type { HookContext } from "#src/core/plugin/driver.js";
import type { HookEvent } from "@snipet/shared/core";
import type { AddressInfo } from "node:net";

// env is read on import: allow one loopback address to reach the fake service on it.
process.env.OUTBOUND_ALLOWLIST = "127.0.0.2";
const { HttpHooksDriver } = await import("./http.hooks.js");

const event: HookEvent = {
  id: "0a1b2c3d-0000-0000-0000-000000000000",
  hook: HookName.RUN_START,
  payload: { input: "hi" },
  occurredAt: "2026-10-16T14:32:05.123Z",
  run: { id: "r1", sessionId: "s1", turn: 0, status: AgentRunStatus.RUNNING, createdAt: "2026-10-16T14:32:05.123Z" },
  agent: { id: "ag1", name: "Agent" },
  owner: { userId: "u1", appId: null, externalUserId: null, name: null },
  settings: {},
  state: {},
};
const context = { signal: new AbortController().signal } as HookContext;

/** A fake service answering every request with status and body; resolves its url and the requests it got. */
async function serve(status: number, body: unknown) {
  const received: { headers: Record<string, unknown>; body: unknown }[] = [];
  const server = createServer((request, response) => {
    let raw = "";
    request.on("data", (chunk: Buffer) => (raw += chunk.toString()));
    request.on("end", () => {
      received.push({ headers: request.headers, body: JSON.parse(raw) });
      response.writeHead(status, { "content-type": "application/json" }).end(JSON.stringify(body));
    });
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.2", resolve));
  const { port } = server.address() as AddressInfo;
  return { url: `http://127.0.0.2:${port}/hooks`, received, close: () => server.close() };
}

describe("HttpHooksDriver", () => {
  const driver = new HttpHooksDriver();

  it("posts the event with the manifest's headers and returns the reply", async () => {
    const reply = { action: HookAction.STOP, reason: "no" };
    const service = await serve(200, reply);
    try {
      const options = driver.validateOptions({ url: service.url, headers: { authorization: "Bearer k" } });
      await expect(driver.handle(event, options, context)).resolves.toEqual(reply);
      expect(service.received).toEqual([
        { headers: expect.objectContaining({ authorization: "Bearer k" }) as unknown, body: event },
      ]);
    } finally {
      service.close();
    }
  });

  it("throws on a non-2xx status", async () => {
    const service = await serve(500, { error: "boom" });
    try {
      await expect(driver.handle(event, driver.validateOptions({ url: service.url }), context)).rejects.toThrow(
        "HTTP 500",
      );
    } finally {
      service.close();
    }
  });
});
