import type { WakingState } from './useServerWaking';

/** "Waking the server — attempt 2 of 3". Warm-toned, no alarm. */
export function WakingNotice({ waking }: { waking: WakingState | null }) {
  if (!waking) return null;
  return (
    <div className="flex items-center gap-2 border-l-2 border-warn bg-warn-tint px-3 py-2 text-[14px] text-ink" role="status" aria-live="polite">
      <span className="h-3 w-3 shrink-0 animate-spin rounded-full border-2 border-warn border-t-transparent" aria-hidden />
      <span>
        Waking the server — attempt {waking.attempt} of {waking.max}.{' '}
        <span className="text-ink-muted">Free hosting sleeps after inactivity; the first request can take up to a minute.</span>
      </span>
    </div>
  );
}
