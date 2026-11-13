import { assembly, CENTER, HUB_RADIUS, NODE_RADIUS, NODES, STROKE } from "@/components/hub-graph/shared";
import { cn } from "@/lib/utils";
import { motion, useReducedMotion } from "motion/react";

/**
 * The Snipet mark above the login form, drawn in the theme's ink so it works
 * in light and dark. It assembles once on load; with reduced motion it's
 * still. Decorative, so hidden from screen readers.
 */
export function LoginHub({ className }: { className?: string }) {
  const isReduced = useReducedMotion() ?? false;

  return (
    <motion.svg
      viewBox="12 12 198 198"
      fill="none"
      aria-hidden
      className={cn("text-foreground shrink-0 overflow-visible", className)}
      initial={isReduced ? false : "hidden"}
      animate="shown"
    >
      {NODES.map((node) => (
        <motion.line
          key={node.index}
          x1={CENTER}
          y1={CENTER}
          x2={node.x}
          y2={node.y}
          stroke="currentColor"
          strokeWidth={STROKE}
          variants={assembly.spoke}
          custom={node.index}
        />
      ))}
      {NODES.map((node) => (
        <motion.circle
          key={node.index}
          cx={node.x}
          cy={node.y}
          r={NODE_RADIUS}
          fill="currentColor"
          variants={assembly.node}
          custom={node.index}
        />
      ))}
      <motion.circle cx={CENTER} cy={CENTER} r={HUB_RADIUS} fill="currentColor" variants={assembly.hub} />
    </motion.svg>
  );
}
