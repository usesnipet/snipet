// env is read on import: unset, the default allowlist applies.
delete process.env.OUTBOUND_ALLOWLIST;
const { BlockedAddressError, resolvePublic } = await import("./safe-fetch.js");

describe("resolvePublic with the default OUTBOUND_ALLOWLIST", () => {
  it.each(["localhost", "127.0.0.1", "[::1]"])("lets the local %s through", async (host) => {
    await expect(resolvePublic(host)).resolves.toBeTruthy();
  });

  it.each(["169.254.169.254", "10.1.2.3", "172.17.0.1"])("still refuses %s", async (host) => {
    await expect(resolvePublic(host)).rejects.toBeInstanceOf(BlockedAddressError);
  });
});
