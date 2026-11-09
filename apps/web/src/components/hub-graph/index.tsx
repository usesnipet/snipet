import { cn } from "@/lib/utils";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";

import { MissingNode } from "./missing-node";
import { RefreshSweep } from "./refresh-sweep";
import { assembly, CENTER, HUB_RADIUS, NETWORK_CLASS, NODE_RADIUS, NODES, SNAP_AT, SPOTLIGHT, STROKE } from "./shared";
import { SnappedSpoke } from "./snapped-spoke";

import type { HubGraphVariant } from "./shared";

export type { HubGraphVariant } from "./shared";

/**
 * The Snipet logo (a hub wired to eight nodes) redrawn to show what went
 * wrong in the network, as a short animated story: a signal that finds no one
 * at the end of a spoke, a spoke that snaps, or a refresh sweeping the hub.
 * Decorative, so it's hidden from screen readers. With reduced motion it
 * renders the final frame and nothing loops.
 */
export function HubGraph({ variant, className }: { variant: HubGraphVariant; className?: string }) {
  const isReduced = useReducedMotion() ?? false;
  const spotlight = SPOTLIGHT[variant];
  const others = NODES.filter((node) => node.index !== spotlight);

  return (
    // Its own presence scope: the layout's outlet uses `initial={false}`, which would otherwise skip the whole story.
    <AnimatePresence>
      <motion.svg
        key={variant}
        viewBox="12 12 198 198"
        fill="none"
        aria-hidden
        className={cn("shrink-0 overflow-visible", className)}
        // `initial={false}` starts every child on its "shown" frame: the reduced-motion still.
        initial={isReduced ? false : "hidden"}
        animate="shown"
      >
        <g className={NETWORK_CLASS}>
          {others.map((node, order) => (
            <motion.line
              key={node.index}
              x1={CENTER}
              y1={CENTER}
              x2={node.x}
              y2={node.y}
              stroke="currentColor"
              strokeWidth={STROKE}
              variants={assembly.spoke}
              custom={order}
            />
          ))}
          {others.map((node, order) => (
            <motion.circle
              key={node.index}
              cx={node.x}
              cy={node.y}
              r={NODE_RADIUS}
              fill="currentColor"
              variants={assembly.node}
              custom={order}
            />
          ))}
        </g>

        {variant === "missing" && <MissingNode isReduced={isReduced} />}
        {variant === "broken" && <SnappedSpoke isReduced={isReduced} />}
        {variant === "updated" && <RefreshSweep isReduced={isReduced} />}

        <Hub shakeAt={variant === "broken" && !isReduced ? SNAP_AT : null} />
      </motion.svg>
    </AnimatePresence>
  );
}

/** The center node; on a snap it flinches sideways once. */
function Hub({ shakeAt }: { shakeAt: number | null }) {
  return (
    <motion.circle
      cx={CENTER}
      cy={CENTER}
      r={HUB_RADIUS}
      className="fill-foreground"
      variants={assembly.hub}
      animate={shakeAt === null ? undefined : { x: [0, -4, 4, -2, 1, 0] }}
      transition={shakeAt === null ? undefined : { x: { delay: shakeAt, duration: 0.4, ease: "easeOut" } }}
    />
  );
}
