import { cn } from "@/lib/utils";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";

import { beat, CENTER, HUB_RADIUS, NETWORK_CLASS, NODE_RADIUS, NODES, STROKE } from "./hub-graph/shared";

/** Seconds the signal spends on one node: out, back, and on to the next. */
const STEP = 0.45;
/** Node indexes clockwise from the top, the order the hub calls them in. */
const CALL_ORDER = [6, 7, 0, 1, 2, 3, 4, 5];
const CYCLE = STEP * CALL_ORDER.length;
/**
 * Drawing size per loader size. The signal is drawn larger than the hub-graph's
 * so it still reads once the logo is scaled down; more so at the small size.
 */
const SIZES = {
  md: { className: "size-16", signalRadius: 10 },
  lg: { className: "size-24", signalRadius: 7 },
};

type SnipetLoaderProps = {
  /** `lg` (96 px) for a full screen, `md` (64 px) inside a panel such as a dialog. */
  size?: keyof typeof SIZES;
  className?: string;
};

/**
 * Loader for while the app itself loads (layout, sign-in, settings), and
 * inside a dialog whose code is still downloading. The Snipet hub calls its nodes one by one, clockwise: a gold
 * signal runs out to a node, lights it, and comes back, like an agent calling
 * each of its tools. Fades in after 200 ms so quick loads don't flash it;
 * pass `delay-0` in `className` where the parent already delays.
 * With reduced motion the logo stays still and only fades in and out.
 */
export function SnipetLoader({ size = "lg", className }: SnipetLoaderProps) {
  const isReduced = useReducedMotion() ?? false;
  const { className: sizeClassName, signalRadius } = SIZES[size];

  return (
    <div
      role="status"
      className={cn(
        "flex flex-1 items-center justify-center",
        "animate-in fade-in fill-mode-backwards delay-200 duration-500",
        className,
      )}
    >
      <span className="sr-only">Loading Snipet</span>
      {/* Its own presence scope, so a parent with `initial={false}` can't freeze the loops. */}
      <AnimatePresence>
        <motion.svg
          key="loader"
          viewBox="12 12 198 198"
          fill="none"
          aria-hidden
          className={sizeClassName}
          // Reduced motion: the whole logo breathes; fading the hub alone would show the spokes under it.
          initial={{ opacity: 1 }}
          animate={isReduced ? { opacity: [1, 0.4, 1] } : undefined}
          transition={{ duration: 1.8, ease: "easeInOut", repeat: Infinity }}
        >
          <g className={NETWORK_CLASS}>
            {NODES.map((node) => (
              <line
                key={node.index}
                x1={CENTER}
                y1={CENTER}
                x2={node.x}
                y2={node.y}
                stroke="currentColor"
                strokeWidth={STROKE}
              />
            ))}
            {NODES.map((node) => (
              <circle key={node.index} cx={node.x} cy={node.y} r={NODE_RADIUS} fill="currentColor" />
            ))}
          </g>

          {!isReduced &&
            CALL_ORDER.map((nodeIndex, order) => {
              const node = NODES[nodeIndex];
              const sentAt = order * STEP;
              return (
                <g key={nodeIndex} className="text-primary" fill="currentColor">
                  {/* Grows to fill the node as the signal lands, then shrinks away. Scale, not opacity:
                      gold fading over the dark node would turn it a muddy brown. */}
                  <motion.circle
                    cx={node.x}
                    cy={node.y}
                    r={NODE_RADIUS}
                    initial={{ scale: 0 }}
                    animate={{ scale: [0, 1, 1, 0] }}
                    transition={{ ...beat(sentAt + STEP * 0.4, STEP * 1.4, CYCLE), times: [0, 0.2, 0.6, 1] }}
                  />
                  <motion.circle
                    r={signalRadius}
                    initial={{ cx: CENTER, cy: CENTER, opacity: 0 }}
                    animate={{
                      cx: [CENTER, node.x, CENTER],
                      cy: [CENTER, node.y, CENTER],
                      opacity: [0, 1, 1, 0],
                    }}
                    transition={{
                      ...beat(sentAt, STEP, CYCLE),
                      opacity: { ...beat(sentAt, STEP, CYCLE), times: [0, 0.15, 0.85, 1] },
                    }}
                  />
                </g>
              );
            })}

          {/* The hub flinches on each call. */}
          <motion.circle
            cx={CENTER}
            cy={CENTER}
            r={HUB_RADIUS}
            className="fill-foreground"
            initial={{ scale: 1 }}
            animate={isReduced ? undefined : { scale: [1, 0.85, 1] }}
            transition={beat(0, 0.25, STEP)}
          />
        </motion.svg>
      </AnimatePresence>
    </div>
  );
}
