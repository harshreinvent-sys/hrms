/* eslint-disable @typescript-eslint/no-require-imports -- the deploy helpers are CommonJS on purpose (run before any build) */
const { describe: describeUrl, normalisePooledUrl, deriveSessionPoolerUrl } = require('../../scripts/dbUrl.cjs') as {
  describe: (url: string) => string;
  normalisePooledUrl: (url: string) => { url: string; added: string[] };
  deriveSessionPoolerUrl: (direct: string, pooled: string) => string | null;
};

const POOLED_BARE = 'postgresql://postgres.example-ref-0001:pw1@aws-0-ap-southeast-1.pooler.supabase.com:6543/postgres';
const DIRECT = 'postgresql://postgres:pw1@db.exampleref0001.supabase.co:5432/postgres';

describe('describe()', () => {
  it('prints host, port and parameter names — never credentials', () => {
    const out = describeUrl(`${POOLED_BARE}?pgbouncer=true`);
    expect(out).toBe('aws-0-ap-southeast-1.pooler.supabase.com:6543 params=pgbouncer');
    expect(out).not.toContain('pw1');
    expect(out).not.toContain('example-ref-0001');
  });
  it('tolerates garbage', () => expect(describeUrl('not a url')).toBe('(unparseable)'));
});

describe('normalisePooledUrl()', () => {
  it('adds pgbouncer=true and pool sizing to a bare transaction-pooler URL', () => {
    const { url, added } = normalisePooledUrl(POOLED_BARE);
    expect(added).toEqual(['pgbouncer=true', 'connection_limit=15', 'pool_timeout=30']);
    const u = new URL(url);
    expect(u.searchParams.get('pgbouncer')).toBe('true');
    expect(u.password).toBe('pw1'); // credentials untouched
  });

  it('leaves a fully configured URL alone', () => {
    const full = `${POOLED_BARE}?pgbouncer=true&connection_limit=15&pool_timeout=30`;
    expect(normalisePooledUrl(full)).toEqual({ url: full, added: [] });
  });

  it('only fills what is missing', () => {
    const { added } = normalisePooledUrl(`${POOLED_BARE}?pgbouncer=true`);
    expect(added).toEqual(['connection_limit=15', 'pool_timeout=30']);
  });

  it('does not touch the session pooler (5432) or non-Supabase hosts', () => {
    const session = POOLED_BARE.replace(':6543', ':5432');
    expect(normalisePooledUrl(session).added).toEqual([]);
    expect(normalisePooledUrl('postgresql://u:p@localhost:6543/db').added).toEqual([]);
  });
});

describe('deriveSessionPoolerUrl()', () => {
  it('derives port 5432 on the pooler host with the pooled credentials and no params', () => {
    const out = deriveSessionPoolerUrl(DIRECT, `${POOLED_BARE}?pgbouncer=true`);
    expect(out).toBe('postgresql://postgres.example-ref-0001:pw1@aws-0-ap-southeast-1.pooler.supabase.com:5432/postgres');
  });

  it('returns null when DIRECT_URL is already not the direct host', () => {
    expect(deriveSessionPoolerUrl(POOLED_BARE.replace(':6543', ':5432'), POOLED_BARE)).toBeNull();
  });

  it('returns null when DATABASE_URL is not on the pooler', () => {
    expect(deriveSessionPoolerUrl(DIRECT, 'postgresql://u:p@localhost:5432/db')).toBeNull();
  });
});
