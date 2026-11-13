import type { RunEvent } from "@snipet/shared";

type Listener = (event: RunEvent) => void;

/** Live runs of this process: their abort switch and who follows their events. */
export class RunEvents {
  private readonly live = new Map<string, { abort: AbortController; listeners: Set<Listener> }>();

  /** Makes the run live; its signal fires on abort(), not on close(). */
  open(runId: string): AbortSignal {
    const abort = new AbortController();
    this.live.set(runId, { abort, listeners: new Set() });
    return abort.signal;
  }

  close(runId: string) {
    this.live.delete(runId);
  }

  emit(runId: string, event: RunEvent) {
    for (const listener of this.live.get(runId)?.listeners ?? []) listener(event);
  }

  /** Returns the unsubscribe function, or undefined when the run isn't live. */
  subscribe(runId: string, listener: Listener): (() => void) | undefined {
    const listeners = this.live.get(runId)?.listeners;
    if (!listeners) return undefined;
    listeners.add(listener);
    return () => listeners.delete(listener);
  }

  /** False when the run isn't live here. */
  abort(runId: string): boolean {
    const run = this.live.get(runId);
    run?.abort.abort();
    return !!run;
  }
}
