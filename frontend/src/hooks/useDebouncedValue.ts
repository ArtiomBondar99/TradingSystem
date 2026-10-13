import { useEffect, useState } from 'react';

// Returns `value` only after it stopped changing for `delayMs`. Typing "apple"
// sends one search request instead of five.
export function useDebouncedValue<T>(value: T, delayMs = 250): T {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delayMs);
    // A new keystroke cancels the pending update
    return () => clearTimeout(timer);
  }, [value, delayMs]);

  return debounced;
}
