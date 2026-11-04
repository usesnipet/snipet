import { env } from "#src/env.js";
import { lookup } from "node:dns/promises";
import { BlockList, isIP } from "node:net";
import { Agent, buildConnector, fetch as undiciFetch } from "undici";

/** Loopback, private, link-local, CGNAT, documentation, multicast and other non-public ranges. */
const RESERVED_RANGES: [string, number, "ipv4" | "ipv6"][] = [
  ["0.0.0.0", 8, "ipv4"],
  ["10.0.0.0", 8, "ipv4"],
  ["100.64.0.0", 10, "ipv4"],
  ["127.0.0.0", 8, "ipv4"],
  ["169.254.0.0", 16, "ipv4"], // cloud metadata
  ["172.16.0.0", 12, "ipv4"],
  ["192.0.0.0", 24, "ipv4"],
  ["192.0.2.0", 24, "ipv4"],
  ["192.168.0.0", 16, "ipv4"],
  ["198.18.0.0", 15, "ipv4"],
  ["198.51.100.0", 24, "ipv4"],
  ["203.0.113.0", 24, "ipv4"],
  ["224.0.0.0", 4, "ipv4"],
  ["240.0.0.0", 4, "ipv4"],
  ["::", 128, "ipv6"],
  ["::1", 128, "ipv6"],
  // IPv4-mapped addresses (::ffff:a.b.c.d) are matched by the IPv4 ranges;
  // NAT64, 6to4 and Teredo can carry a private IPv4 too.
  ["64:ff9b::", 96, "ipv6"],
  ["2001::", 32, "ipv6"],
  ["2002::", 16, "ipv6"],
  ["100::", 64, "ipv6"],
  ["2001:db8::", 32, "ipv6"],
  ["fc00::", 7, "ipv6"],
  ["fe80::", 10, "ipv6"],
  ["ff00::", 8, "ipv6"],
];

const reserved = new BlockList();
for (const [network, prefix, type] of RESERVED_RANGES) reserved.addSubnet(network, prefix, type);

const allowedHosts = new Set<string>();
const allowedRanges = new BlockList();
for (const entry of env.OUTBOUND_ALLOWLIST) {
  const [address, prefix] = entry.split("/");
  const version = isIP(address);
  if (!version) allowedHosts.add(entry.toLowerCase());
  else if (version === 4) allowedRanges.addSubnet(address, prefix ? Number(prefix) : 32, "ipv4");
  else allowedRanges.addSubnet(address, prefix ? Number(prefix) : 128, "ipv6");
}

/** An outbound request would reach a non-public address that OUTBOUND_ALLOWLIST doesn't list. */
export class BlockedAddressError extends Error {
  name = "BlockedAddressError";

  constructor(hostname: string) {
    super(`${hostname} is a private or reserved address`);
  }
}

/** The address to connect to for hostname; throws BlockedAddressError when it isn't public. */
export async function resolvePublic(hostname: string): Promise<string> {
  const host = hostname.replace(/^\[(.*)\]$/, "$1").toLowerCase();
  const addresses = await lookup(host, { all: true });
  if (!allowedHosts.has(host)) {
    // Every address is checked: a name can resolve to both a public and a private one.
    for (const { address, family } of addresses) {
      const type = family === 4 ? "ipv4" : "ipv6";
      if (reserved.check(address, type) && !allowedRanges.check(address, type)) throw new BlockedAddressError(host);
    }
  }
  return addresses[0].address;
}

const connect = buildConnector({});

/**
 * Checks the address at connect time, on the IP it connects to: that covers
 * redirects, DNS rebinding and IP literals in any notation. TLS keeps the
 * original name, which undici takes from the Host.
 */
const dispatcher = new Agent({
  connect: (options, callback) => {
    resolvePublic(options.hostname).then(
      (address) => connect({ ...options, hostname: address }, callback),
      (err: Error) => callback(err, null),
    );
  },
});

/**
 * fetch for URLs that come from connection config: refuses non-public
 * addresses unless OUTBOUND_ALLOWLIST lists them. Takes a URL or string, not
 * a global Request, which undici's fetch doesn't recognize.
 */
export const safeFetch = (async (input: string | URL, init?: RequestInit) => {
  try {
    return await undiciFetch(input, { ...init, dispatcher } as never);
  } catch (err) {
    // fetch only says "fetch failed"; why (a refusal, ECONNREFUSED, ...) is in its cause.
    const cause = (err as Error).cause as (Error & { code?: string }) | undefined;
    if (cause instanceof BlockedAddressError) throw cause;
    if (err instanceof TypeError && cause)
      throw new TypeError(`fetch failed: ${cause.code ?? cause.message}`, { cause: err });
    throw err;
  }
}) as unknown as typeof fetch;
