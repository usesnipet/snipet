import { useCallback, useEffect, useRef, useState } from "react";

/**
 * useState whose value also settles into a debounced copy once it stops changing for `delay` ms.
 * `onDebouncedChange` fires with each settled value set through the returned setter.
 */
export function useDebouncedState<T>(
  initialValue: T,
  delay = 300,
  onDebouncedChange?: (value: T) => void,
) {
  const [value, setValue] = useState(initialValue);
  const [debouncedValue, setDebouncedValue] = useState(initialValue);
  const timeout = useRef<ReturnType<typeof setTimeout>>(undefined);
  const callback = useRef(onDebouncedChange);

  useEffect(() => {
    callback.current = onDebouncedChange;
  }, [onDebouncedChange]);

  useEffect(() => () => clearTimeout(timeout.current), []);

  const set = useCallback((next: T) => {
    setValue(next);
    clearTimeout(timeout.current);
    timeout.current = setTimeout(() => {
      setDebouncedValue(next);
      callback.current?.(next);
    }, delay);
  }, [delay]);

  return [value, set, debouncedValue] as const;
}
