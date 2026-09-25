import { useEffect, useState } from 'react';
import { SERVER_AWAKE_EVENT, SERVER_WAKING_EVENT } from '../api/client';

export interface WakingState {
  attempt: number;
  max: number;
  delayMs: number;
}

/**
 * Tracks the API client's cold-start retries so a page can show progress
 * instead of a silent spinner. Clears itself when the retried request settles
 * (`hrms:awake`); `reset()` remains for callers that want to clear it early.
 */
export function useServerWaking(): { waking: WakingState | null; reset: () => void } {
  const [waking, setWaking] = useState<WakingState | null>(null);

  useEffect(() => {
    const onWaking = (event: Event) => setWaking((event as CustomEvent<WakingState>).detail);
    const onAwake = () => setWaking(null);
    window.addEventListener(SERVER_WAKING_EVENT, onWaking);
    window.addEventListener(SERVER_AWAKE_EVENT, onAwake);
    return () => {
      window.removeEventListener(SERVER_WAKING_EVENT, onWaking);
      window.removeEventListener(SERVER_AWAKE_EVENT, onAwake);
    };
  }, []);

  return { waking, reset: () => setWaking(null) };
}
