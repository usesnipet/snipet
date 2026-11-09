import { motion } from "motion/react";

import { appear, ASSEMBLED_AT, beat, CENTER, NODE_RADIUS, NODES, STROKE } from "./shared";

const SWEEP_CYCLE = 4.2;
const SWEEP_TURN = 1.4;
const FIRST_SWEEP = ASSEMBLED_AT + 1.6;
/** Node indexes clockwise from the top, the way the arrow sweeps. */
const SWEEP_ORDER = [6, 7, 0, 1, 2, 3, 4, 5];

/**
 * Updated: a circular arrow draws itself around the hub, then keeps turning,
 * and each node lights up gold as the arrow passes it, like a sync running.
 */
export function RefreshSweep({ isReduced }: { isReduced: boolean }) {
  return (
    <>
      {!isReduced &&
        SWEEP_ORDER.map((nodeIndex, order) => {
          const node = NODES[nodeIndex];
          return (
            <motion.circle
              key={nodeIndex}
              cx={node.x}
              cy={node.y}
              r={NODE_RADIUS}
              className="fill-primary"
              initial={{ opacity: 0 }}
              animate={{ opacity: [0, 1, 0] }}
              transition={beat(FIRST_SWEEP + (order * SWEEP_TURN) / 8, 0.6, SWEEP_CYCLE)}
            />
          );
        })}

      <motion.g
        className="text-primary"
        animate={isReduced ? undefined : { rotate: [0, 360] }}
        transition={beat(FIRST_SWEEP, SWEEP_TURN, SWEEP_CYCLE, [0.65, 0, 0.35, 1])}
      >
        {/* Invisible full circle: makes the group's box square on the hub, so it rotates around it. */}
        <circle cx={CENTER} cy={CENTER} r={96} />
        <motion.path
          d="M 111 15 A 96 96 0 1 1 27.9 63"
          stroke="currentColor"
          strokeWidth={STROKE}
          strokeLinecap="round"
          variants={{
            hidden: { pathLength: 0 },
            shown: { pathLength: 1, transition: { delay: ASSEMBLED_AT, duration: 0.9, ease: "easeInOut" } },
          }}
        />
        <motion.path d="M 18 52 L 27 70 L 41 57 Z" fill="currentColor" variants={appear(ASSEMBLED_AT + 0.85)} />
      </motion.g>
    </>
  );
}
