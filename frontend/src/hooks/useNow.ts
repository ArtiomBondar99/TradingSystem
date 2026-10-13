import { useEffect, useState } from 'react';

// The current time, refreshed every `intervalMs`: for UI that depends on
// "how long ago" (e.g. a price that stopped updating)
export function useNow(intervalMs: number): number {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(timer);
  }, [intervalMs]);

  return now;
}
