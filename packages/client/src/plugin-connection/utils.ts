import type { PluginConnection } from "@snipet/shared";

export type SyncState =
  | { kind: "pending" }
  | { kind: "error"; message: string; at?: Date }
  | { kind: "synced"; at: Date };

export function syncState(plugin: Pick<PluginConnection, "lastSyncedAt" | "lastSyncedError">): SyncState {
  const at = plugin.lastSyncedAt ?? undefined;
  if (plugin.lastSyncedError) return { kind: "error", message: plugin.lastSyncedError, at };
  return at ? { kind: "synced", at } : { kind: "pending" };
}
