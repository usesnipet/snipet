import type { McpServer } from "@snipet/shared";

export type SyncState =
  | { kind: "pending" }
  | { kind: "error"; message: string; at?: Date }
  | { kind: "synced"; at: Date };

// Works for anything synced in the background (MCP servers, plugin connections).
export function syncState(server: Pick<McpServer, "lastSyncedAt" | "lastSyncedError">): SyncState {
  const at = server.lastSyncedAt ?? undefined;
  if (server.lastSyncedError) return { kind: "error", message: server.lastSyncedError, at };
  return at ? { kind: "synced", at } : { kind: "pending" };
}
