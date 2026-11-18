import assert from "node:assert/strict";
import { test } from "node:test";

import { createHookHandler, HookAction } from "../dist/index.mjs";

const event = {
  id: "0a1b2c3d-0000-4000-8000-000000000000",
  hook: "tool.before",
  payload: { call: { type: "tool_call", id: "c1", name: "rm", arguments: {} }, tool: { id: "t1", name: "rm" } },
  occurredAt: "2026-10-16T14:32:05.123Z",
  run: {
    id: "0a1b2c3d-0000-4000-8000-000000000001",
    sessionId: "0a1b2c3d-0000-4000-8000-000000000002",
    turn: 1,
    status: "running",
    createdAt: "2026-10-16T14:32:05.123Z",
  },
  agent: { id: "0a1b2c3d-0000-4000-8000-000000000003", name: "Agent" },
  owner: { userId: "u1", appId: null, externalUserId: null, name: null },
  settings: {},
  state: {},
};

const handler = createHookHandler({
  "tool.before": (received) => ({ action: "deny", reason: `no ${received.payload.call.name}` }),
});

/** Posts `body` to the handler; resolves its status and JSON reply. */
async function post(body) {
  const response = await handler(new Request("http://hooks.test", { method: "POST", body }));
  return { status: response.status, reply: await response.json() };
}

test("runs the hook's handler on a valid event", async () => {
  assert.deepEqual(await post(JSON.stringify(event)), { status: 200, reply: { action: "deny", reason: "no rm" } });
});

test("continues on hooks without a handler, and on hooks newer than the SDK", async () => {
  for (const hook of ["run.start", "run.unknown"]) {
    assert.deepEqual(await post(JSON.stringify({ ...event, hook })), { status: 200, reply: { action: "continue" } });
  }
});

test("rejects bodies that are not a hook event", async () => {
  for (const body of ["{", "{}", JSON.stringify({ ...event, payload: {} })]) {
    assert.equal((await post(body)).status, 400, body);
  }
});
