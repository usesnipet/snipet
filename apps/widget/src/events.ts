import type { WidgetApi, WidgetEvent, WidgetEvents } from "./types";

const handlers = new Map<WidgetEvent, Set<(payload: never) => void>>();

export const on: WidgetApi["on"] = (event, handler) => {
  const set = handlers.get(event) ?? new Set();
  handlers.set(event, set);
  set.add(handler);
  return () => void set.delete(handler);
};

/** Calls the event's handlers; one that throws doesn't stop the others or the widget. */
export function emit<E extends WidgetEvent>(event: E, ...[payload]: WidgetEvents[E] extends void ? [] : [WidgetEvents[E]]) {
  handlers.get(event)?.forEach((handler) => {
    try {
      (handler as (payload: WidgetEvents[E] | undefined) => void)(payload);
    } catch (error) {
      console.error(error);
    }
  });
}
