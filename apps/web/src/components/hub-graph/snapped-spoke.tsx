import { motion } from "motion/react";

import { assembly, beat, CENTER, HUB_RADIUS, NETWORK_CLASS, NODE_RADIUS, NODES, SNAP_AT, STROKE } from "./shared";

import type { Variants } from "motion/react";

/** Where the spoke breaks, between the hub and the right node. */
const BREAK_X = 146;
const RETRY_CYCLE = 3.4;
const RETRY_TRAVEL = 0.5;
const FIRST_RETRY = SNAP_AT + 1.8;

/** Short strokes flying out of the break, as unit directions. */
const SPARKS = [
  { dx: 0.6, dy: -1 },
  { dx: 1, dy: -0.25 },
  { dx: 0.9, dy: 0.6 },
  { dx: -0.2, dy: -1 },
  { dx: 0.1, dy: 1 },
];

/**
 * Error: a signal heads for the right node, the spoke snaps under it, and the
 * outer half drops and dangles from a spring while sparks fly from the break.
 * Every few seconds the hub retries: a signal runs to the break and fizzles.
 */
export function SnappedSpoke({ isReduced }: { isReduced: boolean }) {
  const node = NODES[0];
  const fall: Variants = {
    hidden: { rotate: 0, x: 0, y: 0 },
    shown: {
      rotate: 24,
      x: 7,
      y: 11,
      transition: { delay: SNAP_AT, type: "spring", stiffness: 240, damping: 7, mass: 0.8 },
    },
  };

  return (
    <>
      {/* The hub's half of the spoke stays put. */}
      <motion.line
        x1={CENTER}
        y1={CENTER}
        x2={BREAK_X}
        y2={CENTER}
        stroke="currentColor"
        strokeWidth={STROKE}
        className={NETWORK_CLASS}
        variants={assembly.spoke}
        custom={0}
      />

      {/* Pivots on the break: the bounding box starts at BREAK_X and is centered on the spoke's line. */}
      <motion.g variants={fall} style={{ originX: 0, originY: 0.5 }}>
        <g className={NETWORK_CLASS} fill="currentColor" stroke="currentColor">
          <line x1={BREAK_X} y1={CENTER} x2={node.x} y2={CENTER} strokeWidth={STROKE} />
          <circle cx={node.x} cy={CENTER} r={NODE_RADIUS} stroke="none" />
        </g>
        {/* Turns red the moment it breaks. */}
        <motion.g
          className="text-destructive"
          fill="currentColor"
          stroke="currentColor"
          variants={{ hidden: { opacity: 0 }, shown: { opacity: 1, transition: { delay: SNAP_AT, duration: 0.15 } } }}
        >
          <line x1={BREAK_X + 4} y1={CENTER} x2={node.x} y2={CENTER} strokeWidth={STROKE} />
          <circle cx={node.x} cy={CENTER} r={NODE_RADIUS} stroke="none" />
        </motion.g>
      </motion.g>

      {!isReduced && (
        <>
          {/* The first signal, cut off by the snap. */}
          <motion.circle
            r={4.5}
            className="fill-primary"
            initial={{ cx: CENTER + HUB_RADIUS, cy: CENTER, opacity: 0 }}
            animate={{ cx: [CENTER + HUB_RADIUS, BREAK_X], opacity: [0, 1, 0] }}
            transition={{ delay: SNAP_AT - 0.4, duration: 0.45, ease: "easeIn" }}
          />
          <Sparks at={SNAP_AT} reach={14} />

          {/* The hub retrying, forever. */}
          <motion.circle
            r={4}
            className="fill-primary"
            initial={{ cx: CENTER + HUB_RADIUS, cy: CENTER, opacity: 0 }}
            animate={{ cx: [CENTER + HUB_RADIUS, BREAK_X - 2], opacity: [0, 1, 1, 0] }}
            transition={beat(FIRST_RETRY, RETRY_TRAVEL, RETRY_CYCLE, "easeIn")}
          />
          <Sparks at={FIRST_RETRY + RETRY_TRAVEL * 0.9} reach={9} cycle={RETRY_CYCLE} />
        </>
      )}
    </>
  );
}

/** A burst of short red strokes from the break; repeats every `cycle` seconds when given one. */
function Sparks({ at, reach, cycle }: { at: number; reach: number; cycle?: number }) {
  const duration = 0.45;
  const transition = cycle ? beat(at, duration, cycle, "easeOut") : { delay: at, duration, ease: "easeOut" as const };

  return (
    <g className="text-destructive" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round">
      {SPARKS.map((spark) => (
        <motion.line
          key={`${spark.dx}-${spark.dy}`}
          x1={BREAK_X + 4}
          y1={CENTER}
          x2={BREAK_X + 4 + spark.dx * 5}
          y2={CENTER + spark.dy * 5}
          initial={{ x: 0, y: 0, opacity: 0 }}
          animate={{ x: [0, spark.dx * reach], y: [0, spark.dy * reach], opacity: [0, 1, 0] }}
          transition={transition}
        />
      ))}
    </g>
  );
}
