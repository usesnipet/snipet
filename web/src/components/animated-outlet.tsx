"use client";

import { AnimatePresence, motion } from "motion/react";
import { useLocation, useOutlet } from "react-router-dom";

const fadeTransition = { duration: 0.2, ease: "easeInOut" } as const;

export function AnimatedOutlet() {
  const location = useLocation();
  const outlet = useOutlet();

  return (
    <AnimatePresence mode="wait" initial={false}>
      {outlet ? (
        <motion.div
          key={location.key}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={fadeTransition}
          className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden"
        >
          {outlet}
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
