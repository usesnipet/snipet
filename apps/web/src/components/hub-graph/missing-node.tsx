import { motion } from "motion/react";

import { appear, ASSEMBLED_AT, beat, HUB_RADIUS, NODE_RADIUS, NODES, SPOKE_RADIUS, STROKE } from "./shared";

/** One cycle of the 404 story: signal travels out, arrives, finds nothing, rests. */
const MISSING_CYCLE = 3.2;
const MISSING_TRAVEL = 1.1;
const MISSING_FIRST_SIGNAL = ASSEMBLED_AT + 0.6;

/**
 * 404: the top-right spoke is a dotted trail to an empty, slowly turning
 * outline. The hub keeps sending a signal down the trail; it reaches the
 * outline, pings, and there's nobody there.
 */
export function MissingNode({ isReduced }: { isReduced: boolean }) {
  const node = NODES[7];
  const start = node.at(HUB_RADIUS + 6);
  const end = node.at(SPOKE_RADIUS - NODE_RADIUS - 5);
  const arrival = MISSING_FIRST_SIGNAL + MISSING_TRAVEL * 0.85;

  return (
    <g className="text-primary">
      <motion.line
        x1={start.x}
        y1={start.y}
        x2={end.x}
        y2={end.y}
        stroke="currentColor"
        strokeWidth={STROKE}
        strokeLinecap="round"
        strokeDasharray="0.5 8"
        variants={{ hidden: { opacity: 0 }, shown: { opacity: 1, transition: { delay: ASSEMBLED_AT, duration: 0.4 } } }}
      />

      <motion.g variants={appear(ASSEMBLED_AT + 0.15)}>
        <motion.circle
          cx={node.x}
          cy={node.y}
          r={NODE_RADIUS}
          stroke="currentColor"
          strokeWidth={3}
          strokeDasharray="4.5 4.5"
          className="fill-primary/15"
          // Marching dashes read as "still looking".
          animate={isReduced ? undefined : { rotate: 360 }}
          transition={{ duration: 14, ease: "linear", repeat: Infinity }}
        />
      </motion.g>

      {!isReduced && (
        <>
          <motion.circle
            r={4.5}
            fill="currentColor"
            initial={{ cx: start.x, cy: start.y, opacity: 0 }}
            animate={{ cx: [start.x, node.x], cy: [start.y, node.y], opacity: [0, 1, 1, 0] }}
            transition={{
              ...beat(MISSING_FIRST_SIGNAL, MISSING_TRAVEL, MISSING_CYCLE, "easeIn"),
              opacity: { ...beat(MISSING_FIRST_SIGNAL, MISSING_TRAVEL, MISSING_CYCLE), times: [0, 0.15, 0.8, 1] },
            }}
          />
          <motion.circle
            cx={node.x}
            cy={node.y}
            r={NODE_RADIUS}
            stroke="currentColor"
            strokeWidth={2}
            initial={{ scale: 1, opacity: 0 }}
            animate={{ scale: [1, 2.1], opacity: [0.7, 0] }}
            transition={beat(arrival, 0.8, MISSING_CYCLE, "easeOut")}
          />
        </>
      )}
    </g>
  );
}
