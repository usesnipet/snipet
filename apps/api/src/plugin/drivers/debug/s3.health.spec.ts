import { resolveOptions } from "#src/manifest/options.js";
import { validateJson } from "@snipet/server-common";
import { readFileSync } from "node:fs";
import { createServer } from "node:http";

import type { JsonObject, ManifestDriver } from "@snipet/shared";
import type { RequestListener, Server } from "node:http";
import type { AddressInfo } from "node:net";

// env is read on import: allow one loopback address to reach a fake S3 on it.
process.env.OUTBOUND_ALLOWLIST = "127.0.0.2";
const { DebugS3HealthCheckDriver } = await import("./s3.health.js");

const driver = new DebugS3HealthCheckDriver();
const required = { bucket: "logs", accessKeyId: "id", secretAccessKey: "secret" };

/** The health check options the manifest gives the driver for a connection config. */
function optionsOf(config: JsonObject) {
  const { connection, capabilities } = JSON.parse(
    readFileSync(new URL("../../manifests/debug-s3.json", import.meta.url), "utf8"),
  ) as { connection: never; capabilities: { healthCheck: ManifestDriver } };
  return resolveOptions(driver, capabilities.healthCheck, validateJson<JsonObject>(connection, config));
}

describe("DebugS3HealthCheckDriver", () => {
  let server: Server | undefined;

  /** Checks a bucket on a fake S3 answering with listener. */
  async function checkAgainst(listener: RequestListener, config: JsonObject = {}) {
    server = createServer(listener);
    await new Promise<void>((done) => server!.listen(0, "127.0.0.2", done));
    const endpoint = `http://127.0.0.2:${(server.address() as AddressInfo).port}`;
    return driver.checkHealth("c1", optionsOf({ ...required, endpoint, forcePathStyle: true, ...config }));
  }

  const answering =
    (status: number): RequestListener =>
    (_req, res) => {
      res.statusCode = status;
      res.end();
    };

  afterEach(() => {
    server?.closeAllConnections();
    server?.close();
    server = undefined;
  });

  it("defaults the timeout to 10 seconds", () => {
    expect(optionsOf(required).timeout).toBe(10);
  });

  it.each([0, 61])("refuses a timeout of %i seconds", (timeout) => {
    expect(() => driver.validateOptions({ ...optionsOf(required), timeout })).toThrow("invalid options");
  });

  it("is healthy when HeadBucket succeeds", async () => {
    const seen: { method?: string; url?: string } = {};
    const result = await checkAgainst((req, res) => {
      Object.assign(seen, { method: req.method, url: req.url });
      res.end();
    });
    expect(result).toEqual({ isHealthy: true });
    expect(seen.method).toBe("HEAD");
    expect(seen.url?.split("?")[0]).toBe("/logs/");
  });

  it.each([
    [404, 'bucket "logs" not found'],
    [403, 'access denied to bucket "logs": check the credentials and the s3:ListBucket permission'],
    [301, 'bucket "logs" is not in region "us-east-1"'],
  ])("explains a %i", async (status, error) => {
    expect(await checkAgainst(answering(status))).toEqual({ isHealthy: false, error });
  });

  it("gives up after the connection's timeout", async () => {
    const result = await checkAgainst(() => undefined, { timeout: 1 });
    expect(result).toEqual({ isHealthy: false, error: "no answer within 1s" });
  });

  it.each([
    ["an IP literal", "http://169.254.169.254", "169.254.169.254"],
    // Without path style the SDK puts the bucket in the name it looks up.
    ["a name", "http://localhost:9000", "logs.localhost"],
  ])("refuses a non-public endpoint given as %s", async (_kind, endpoint, host) => {
    const result = await driver.checkHealth("c1", optionsOf({ ...required, endpoint }));
    expect(result).toEqual({
      isHealthy: false,
      error: `endpoint not allowed: ${host} is a private or reserved address`,
    });
  });
});
