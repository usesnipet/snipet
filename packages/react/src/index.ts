"use client";

import { snipet } from "@snipet/widget";
import { useEffect, useRef } from "react";

import type { Snipet, WidgetEvent, WidgetEvents, WidgetInit } from "@snipet/widget";

export type * from "@snipet/widget";

/** Event to the prop that handles it. */
const EVENT_PROPS = { open: "onOpen", close: "onClose", message: "onMessage", error: "onError" } as const;

type EventProps = {
  [E in WidgetEvent as (typeof EVENT_PROPS)[E]]?: (payload: WidgetEvents[E]) => void;
};

export type SnipetWidgetProps = WidgetInit &
  EventProps & {
    /** Where to load the widget script from; defaults to the CDN build of the installed version. */
    src?: string;
  };

/**
 * Mounts the chat widget while rendered; prop changes reach it like configure().
 * Render it once, anywhere: the widget draws itself in the page corner, so this renders nothing.
 */
export function SnipetWidget({ src, onOpen, onClose, onMessage, onError, ...config }: SnipetWidgetProps): null {
  const handlers = useRef<EventProps>({});
  useEffect(() => {
    handlers.current = { onOpen, onClose, onMessage, onError };
  });

  // The first run mounts; later ones (after any render) re-apply the config.
  useEffect(() => snipet.init(config, src));
  useEffect(() => {
    const offs = (Object.keys(EVENT_PROPS) as WidgetEvent[]).map((event) =>
      snipet.on(event, (payload) => (handlers.current[EVENT_PROPS[event]] as ((p: unknown) => void) | undefined)?.(payload)),
    );
    return () => {
      offs.forEach((off) => off());
      snipet.destroy();
    };
  }, []);

  return null;
}

/** The widget's API: open, close, setToken, on... Safe to call before the widget loads. */
export const useSnipet = (): Snipet => snipet;
