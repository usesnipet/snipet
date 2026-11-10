import { transitions } from "@/lib/motion";
import { Check, Copy } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";

/** Copy icon that pops into a check once copied, so the click visibly landed. */
export function CopyIcon({ copied }: { copied: boolean }) {
  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.span
        key={copied ? "copied" : "copy"}
        className="inline-flex"
        initial={{ opacity: 0, scale: 0.6 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.6 }}
        transition={transitions.fast}
      >
        {copied ? <Check /> : <Copy />}
      </motion.span>
    </AnimatePresence>
  );
}
