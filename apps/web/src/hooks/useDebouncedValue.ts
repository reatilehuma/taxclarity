import { useEffect, useState } from "react";

/**
 * Follows `value`, but only settles on a new one after it has stopped changing for `delayMs`.
 * The first value is used straight away, so a panel that opens with answers already in place
 * never shows an out-of-date frame.
 */
export function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [settled, setSettled] = useState(value);
  useEffect(() => {
    if (Object.is(settled, value)) return;
    const id = setTimeout(() => setSettled(value), delayMs);
    return () => clearTimeout(id);
  }, [value, settled, delayMs]);
  return settled;
}
