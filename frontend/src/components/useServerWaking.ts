import { useEffect, useState } from 'react';
import { SERVER_WAKING_EVENT } from '../api/client';

export interface WakingState {
  attempt: number;
  max: number;
  delayMs: number;
}

/**
 * Tracks the API client's cold-start retries so a page can show progress
 * instead of a silent spinner. Cleared by calling `reset()` once the request
 * that triggered it has settled.
 */
export function useServerWaking(): { waking: WakingState | null; reset: () => void } {
  const [waking, setWaking] = useState<WakingState | null>(null);

  useEffect(() => {
    const onWaking = (event: Event) => setWaking((event as CustomEvent<WakingState>).detail);
    window.addEventListener(SERVER_WAKING_EVENT, onWaking);
    return () => window.removeEventListener(SERVER_WAKING_EVENT, onWaking);
  }, []);

  return { waking, reset: () => setWaking(null) };
}
