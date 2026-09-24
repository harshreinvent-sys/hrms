/**
 * Pure helpers for the database URLs the deploy script reasons about.
 * No secrets are ever returned in a printable form — `describe()` gives host,
 * port and which query parameters are present, nothing else.
 */

const SUPABASE_POOLER = /pooler\.supabase\.com$/i;
const SUPABASE_DIRECT = /^db\.[a-z0-9]+\.supabase\.co$/i;

function parse(url) {
  try {
    return new URL(url);
  } catch {
    return null;
  }
}

/** "host:port {params}" — safe to log. */
function describe(url) {
  const u = parse(url);
  if (!u) return '(unparseable)';
  const params = [...u.searchParams.keys()].sort().join(',') || 'none';
  return `${u.hostname}:${u.port || '5432'} params=${params}`;
}

/**
 * Supabase's transaction pooler (port 6543) multiplexes connections, so Prisma
 * must run with `pgbouncer=true` (no prepared statements). Without it, any two
 * queries run in parallel land on different backends and fail with "prepared
 * statement already exists" while sequential requests appear to work — which
 * is exactly how it shows up: login succeeds, the dashboard 500s.
 *
 * Returns { url, added } where `added` lists parameters that were filled in.
 */
function normalisePooledUrl(url) {
  const u = parse(url);
  if (!u || !SUPABASE_POOLER.test(u.hostname) || u.port !== '6543') {
    return { url, added: [] };
  }
  const added = [];
  const ensure = (key, value) => {
    if (!u.searchParams.has(key)) {
      u.searchParams.set(key, value);
      added.push(`${key}=${value}`);
    }
  };
  ensure('pgbouncer', 'true');
  ensure('connection_limit', '15');
  ensure('pool_timeout', '30');
  return { url: u.toString(), added };
}

/**
 * For migrations on an IPv4-only host: the direct host is IPv6-only, so derive
 * the Session pooler (same credentials as the pooled URL, port 5432, no params).
 */
function deriveSessionPoolerUrl(directUrl, pooledUrl) {
  const direct = parse(directUrl);
  const pooled = parse(pooledUrl);
  if (!direct || !pooled) return null;
  if (!SUPABASE_DIRECT.test(direct.hostname) || !SUPABASE_POOLER.test(pooled.hostname)) return null;
  const session = new URL(pooled.toString());
  session.port = '5432';
  session.search = '';
  return session.toString();
}

module.exports = { describe, normalisePooledUrl, deriveSessionPoolerUrl };
