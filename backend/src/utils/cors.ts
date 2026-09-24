/**
 * Origin matching for CORS_ORIGIN. Pure, so it is unit-tested without Express.
 *
 * CORS_ORIGIN is a comma-separated list. Each entry is either an exact origin
 * (`https://hrms-two-drab.vercel.app`) or a pattern with `*` standing for one
 * host label (`https://*.vercel.app` matches every Vercel preview deployment of
 * the project, but not `https://vercel.app` and not paths, which an Origin
 * header never carries anyway).
 */
export function compileOriginMatcher(entries: readonly string[]): (origin: string) => boolean {
  const exact = new Set<string>();
  const patterns: RegExp[] = [];

  for (const raw of entries) {
    const entry = raw.trim().replace(/\/+$/, '');
    if (!entry) continue;
    if (entry.includes('*')) {
      const source = entry
        .split('*')
        .map((part) => part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
        .join('[A-Za-z0-9-]+');
      patterns.push(new RegExp(`^${source}$`, 'i'));
    } else {
      exact.add(entry.toLowerCase());
    }
  }

  return (origin) => {
    const normalised = origin.replace(/\/+$/, '').toLowerCase();
    return exact.has(normalised) || patterns.some((pattern) => pattern.test(origin));
  };
}
