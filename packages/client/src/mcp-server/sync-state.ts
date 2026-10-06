import type { McpServer } from "@snipet/shared";

export type SyncState =
  | { kind: "pending" }
  | { kind: "error"; message: string; at?: Date }
  | { kind: "synced"; at: Date };

export function syncState(server: McpServer): SyncState {
  const at = server.lastSyncedAt ?? undefined;
  if (server.lastSyncedError) return { kind: "error", message: server.lastSyncedError, at };
  return at ? { kind: "synced", at } : { kind: "pending" };
}
