import { animate, useReducedMotion } from "motion/react";
import { useEffect, useRef } from "react";

type AnimatedNumberProps = {
  value: number;
  format: (value: number) => string;
  className?: string;
};

/** Counts from the last value to the new one, so a change of period or agent reads as a change. */
export function AnimatedNumber({ value, format, className }: AnimatedNumberProps) {
  const ref = useRef<HTMLSpanElement>(null);
  const shownRef = useRef(0);
  const prefersReducedMotion = useReducedMotion();

  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    if (prefersReducedMotion) {
      shownRef.current = value;
      element.textContent = format(value);
      return;
    }
    const controls = animate(shownRef.current, value, {
      duration: 0.6,
      ease: [0.22, 1, 0.36, 1],
      onUpdate: (latest) => {
        shownRef.current = latest;
        element.textContent = format(latest);
      },
    });
    return () => controls.stop();
  }, [value, format, prefersReducedMotion]);

  // The final value up front, for screen readers and the first paint before the effect runs.
  return (
    <span ref={ref} className={className}>
      {format(value)}
    </span>
  );
}
