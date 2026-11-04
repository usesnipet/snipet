import { createServer } from "node:http";

import type { AddressInfo } from "node:net";

// env is read on import: allow one loopback address to test redirects from it.
process.env.OUTBOUND_ALLOWLIST = "127.0.0.2";
const { BlockedAddressError, resolvePublic, safeFetch } = await import("./safe-fetch.js");

describe("resolvePublic", () => {
  it.each(["127.0.0.1", "localhost", "169.254.169.254", "10.1.2.3", "[::1]", "[::ffff:7f00:1]", "0.0.0.0"])(
    "refuses %s",
    async (host) => {
      await expect(resolvePublic(host)).rejects.toBeInstanceOf(BlockedAddressError);
    },
  );

  it("lets public and allowlisted addresses through", async () => {
    await expect(resolvePublic("1.1.1.1")).resolves.toBe("1.1.1.1");
    await expect(resolvePublic("127.0.0.2")).resolves.toBe("127.0.0.2");
  });
});

describe("safeFetch", () => {
  it("says why a request failed", async () => {
    // A port that was just freed: nothing listens there.
    const server = createServer();
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.2", resolve));
    const { port } = server.address() as AddressInfo;
    await new Promise((resolve) => server.close(resolve));
    await expect(safeFetch(`http://127.0.0.2:${port}/`)).rejects.toThrow("fetch failed: ECONNREFUSED");
  });

  it("refuses a redirect from an allowed host to a blocked one", async () => {
    const server = createServer((req, res) => {
      res.writeHead(302, { Location: `http://127.0.0.1:${(server.address() as AddressInfo).port}/` }).end();
    });
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.2", resolve));
    const { port } = server.address() as AddressInfo;
    try {
      // The allowed host itself is reached: its redirect is what gets refused.
      await expect(safeFetch(`http://127.0.0.2:${port}/`)).rejects.toBeInstanceOf(BlockedAddressError);
    } finally {
      server.close();
    }
  });
});
