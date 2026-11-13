import type { Transition } from "motion/react";

/** Shared timings, so motion feels the same across the app. Exits should use `fast`. */
export const transitions = {
  /** Icon swaps and other microinteractions. */
  fast: { duration: 0.15, ease: "easeOut" },
  /** Content entering the screen. */
  base: { duration: 0.25, ease: [0.22, 1, 0.36, 1] },
} as const satisfies Record<string, Transition>;

/** Fade in while rising a few pixels; for content that just arrived. */
export const enterUp = {
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0 },
  transition: transitions.base,
} as const;
