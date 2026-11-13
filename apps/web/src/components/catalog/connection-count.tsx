import { syncState } from "@snipet/client";

type ConnectionCountProps = {
  connections: Parameters<typeof syncState>[0][];
};

/** "2 connections", turning into "2 connections, 1 failed to sync" in the error color when a sync failed. */
export function ConnectionCount({ connections }: ConnectionCountProps) {
  const count = connections.length;
  const failedCount = connections.filter((connection) => syncState(connection).kind === "error").length;
  const label = count === 0 ? "No connections yet" : `${count} connection${count === 1 ? "" : "s"}`;

  if (!failedCount) return label;
  return (
    <span className="text-destructive">
      {label}, {failedCount} failed to sync
    </span>
  );
}
