import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

import type { UseQueryResult } from "@tanstack/react-query";
import type { ReactNode } from "react";

type ConnectionListBodyProps = {
  query: Pick<UseQueryResult<unknown, Error>, "isLoading" | "isError" | "isFetching" | "refetch">;
  isEmpty: boolean;
  /** Name of what the connections point at, e.g. "GitHub". */
  name: string;
  onAdd: () => void;
  /** The connection rows, shown once loaded and not empty. */
  children: ReactNode;
};

/** Loading, error and empty states of a connection list dialog, around its rows. */
export function ConnectionListBody({ query, isEmpty, name, onAdd, children }: ConnectionListBodyProps) {
  if (query.isLoading) {
    return [0, 1].map((index) => <Skeleton key={index} className="h-16.5 w-full rounded-lg" />);
  }
  if (query.isError) {
    return (
      <div className="flex items-center gap-3 py-2">
        <p className="text-destructive text-sm">Failed to load connections.</p>
        <Button variant="outline" size="sm" disabled={query.isFetching} onClick={() => void query.refetch()}>
          Try again
        </Button>
      </div>
    );
  }
  if (isEmpty) {
    return (
      <div className="flex flex-col items-center gap-3 py-8 text-center">
        <div>
          <p className="font-medium">No {name} connections</p>
          <p className="text-muted-foreground text-sm">Add one so your agents can use {name}.</p>
        </div>
        <Button type="button" onClick={onAdd}>
          New connection
        </Button>
      </div>
    );
  }
  return children;
}
