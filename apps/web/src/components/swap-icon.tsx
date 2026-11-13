import { transitions } from "@/lib/motion";
import { Check, Copy } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";

/** Pops the new icon in when `swapKey` changes (send to stop, copy to check), so the change is noticed. */
export function SwapIcon({ swapKey, children }: { swapKey: string; children: React.ReactNode }) {
  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.span
        key={swapKey}
        className="inline-flex"
        initial={{ opacity: 0, scale: 0.6 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.6 }}
        transition={transitions.fast}
      >
        {children}
      </motion.span>
    </AnimatePresence>
  );
}

/** Copy icon that pops into a check once copied, so the click visibly landed. */
export function CopyIcon({ copied }: { copied: boolean }) {
  return <SwapIcon swapKey={copied ? "copied" : "copy"}>{copied ? <Check /> : <Copy />}</SwapIcon>;
}
