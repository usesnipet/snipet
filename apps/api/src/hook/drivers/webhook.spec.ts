import { jest } from "@jest/globals";
import { createHmac } from "node:crypto";

import { WebhookDriver } from "./webhook.js";

import type { HookEvent } from "@snipet/shared";

const event = { id: "e1", hook: "tool.before" } as HookEvent;
const signal = new AbortController().signal;

describe("WebhookDriver", () => {
  const driver = new WebhookDriver();
  const fetchMock = jest.fn<typeof fetch>();
  beforeEach(() => {
    fetchMock.mockReset();
    global.fetch = fetchMock;
  });

  it("signs the body and drops empty headers", async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 204 }));
    const options = driver.validateOptions({
      url: "https://x.test/hook",
      headers: { Authorization: "" },
      signingSecret: "s",
    });

    await expect(driver.handle(event, options, signal)).resolves.toEqual({ action: "continue" });

    const init = fetchMock.mock.calls[0][1]!;
    const headers = init.headers as Record<string, string>;
    expect(headers.Authorization).toBeUndefined();
    expect(headers["X-Snipet-Event-Id"]).toBe("e1");
    const [, t, v1] = /^t=(\d+),v1=(\w+)$/.exec(headers["X-Snipet-Signature"])!;
    expect(v1).toBe(
      createHmac("sha256", "s")
        .update(`${t}.${init.body as string}`)
        .digest("hex"),
    );
  });

  it("returns a valid reply and rejects bad ones", async () => {
    const options = driver.validateOptions({ url: "https://x.test/hook" });
    const reply = (body: string, status = 200) => fetchMock.mockResolvedValueOnce(new Response(body, { status }));

    reply(JSON.stringify({ action: "block", reason: "no" }));
    await expect(driver.handle(event, options, signal)).resolves.toEqual({ action: "block", reason: "no" });

    reply("{}", 500);
    await expect(driver.handle(event, options, signal)).rejects.toThrow("HTTP 500");
    reply("nope");
    await expect(driver.handle(event, options, signal)).rejects.toThrow("not JSON");
    reply(JSON.stringify({ action: "explode" }));
    await expect(driver.handle(event, options, signal)).rejects.toThrow("invalid reply");
  });
});
