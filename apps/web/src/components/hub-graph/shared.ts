import type { Transition, Variants } from "motion/react";

/** Which part of the hub tells the story: a spoke to nowhere, a snapped spoke, or a refresh around it. */
export type HubGraphVariant = "missing" | "broken" | "updated";

export const CENTER = 111;
export const SPOKE_RADIUS = 64;
export const NODE_RADIUS = 13;
export const HUB_RADIUS = 20;
export const STROKE = 5;

/** The eight nodes of the Snipet logo, clockwise from the right. */
export const NODES = Array.from({ length: 8 }, (_, index) => {
  const angle = (index * Math.PI) / 4;
  const at = (radius: number) => ({ x: CENTER + radius * Math.cos(angle), y: CENTER + radius * Math.sin(angle) });
  return { index, ...at(SPOKE_RADIUS), at };
});

/** Node the variant redraws: top right for a missing page, right for a broken one. */
export const SPOTLIGHT: Record<HubGraphVariant, number | null> = { missing: 7, broken: 0, updated: null };

/** Spokes and nodes share the hub's ink, like the logo; only the variant's story gets color. */
export const NETWORK_CLASS = "text-foreground";

/** When the network has finished drawing itself and the variant's story starts. */
export const ASSEMBLED_AT = 0.7;

/** Hub pops in, then each spoke draws out and its node lands, one after the other. */
export const assembly = {
  hub: {
    hidden: { scale: 0.4, opacity: 0 },
    shown: { scale: 1, opacity: 1, transition: { type: "spring", stiffness: 420, damping: 18 } },
  },
  spoke: {
    hidden: { pathLength: 0 },
    shown: (order: number) => ({ pathLength: 1, transition: { delay: 0.1 + order * 0.04, duration: 0.3 } }),
  },
  node: {
    hidden: { scale: 0, opacity: 0 },
    shown: (order: number) => ({
      scale: 1,
      opacity: 1,
      transition: { delay: 0.25 + order * 0.04, type: "spring", stiffness: 500, damping: 20 },
    }),
  },
} satisfies Record<string, Variants>;

/** A one-shot fade and scale-in for the variant's own pieces, after the network is up. */
export const appear = (delay: number): Variants => ({
  hidden: { opacity: 0, scale: 0.4 },
  shown: { opacity: 1, scale: 1, transition: { delay, type: "spring", stiffness: 380, damping: 14 } },
});

/** A looping beat: `duration` of motion, then rest, so every loop of a variant shares one cycle. */
export const beat = (delay: number, duration: number, cycle: number, ease: Transition["ease"] = "easeInOut") => ({
  delay,
  duration,
  ease,
  repeat: Infinity,
  repeatDelay: cycle - duration,
});

/** When the right spoke breaks, after a first signal has started down it. */
export const SNAP_AT = ASSEMBLED_AT + 0.55;
