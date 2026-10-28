import { debugPath } from "./debug.js";

import type { HookEvent } from "@snipet/shared";

describe("debugPath", () => {
  it("files events by day, agent, session and run, in the order they happened", () => {
    const event = {
      id: "0a1b2c3d-0000-0000-0000-000000000000",
      hook: "tool.after",
      occurredAt: "2026-10-16T14:32:05.123Z",
      run: { id: "r1", sessionId: "s1" },
      agent: { id: "ag1", name: "Suporte Técnico" },
    } as HookEvent;
    expect(debugPath(event)).toBe("2026-10-16/suporte-tecnico_ag1/s1/r1/14-32-05.123_tool.after_0a1b2c3d.json");
  });
});
