#!/usr/bin/env node
/**
 * Production start: preflight → `prisma migrate deploy` → `node dist/server.js`.
 *
 * Why a script instead of `prisma migrate deploy && node dist/server.js`:
 *
 * Supabase's "Direct connection" host (db.<ref>.supabase.co) is IPv6-only.
 * Render's free tier has no outbound IPv6, so migrations fail there with
 * P1001 while the same URL works from a laptop. The IPv4 alternative is the
 * Session pooler: the same host as DATABASE_URL's transaction pooler, port
 * 5432, no query string. When that situation is detected (RENDER is set by
 * Render, DIRECT_URL is the IPv6 host, DATABASE_URL is on the pooler) the
 * session-pooler URL is derived and used for the migration, and the log says
 * so. Credentials are never printed — only hosts.
 */
require('dotenv').config();
const { spawnSync } = require('node:child_process');
const path = require('node:path');

function hostOf(url) {
  try {
    const u = new URL(url);
    return `${u.hostname}:${u.port || '5432'}`;
  } catch {
    return '(unparseable)';
  }
}

const databaseUrl = process.env.DATABASE_URL ?? '';
let directUrl = process.env.DIRECT_URL ?? '';

console.log(`[deploy] DATABASE_URL host: ${hostOf(databaseUrl)}`);
console.log(`[deploy] DIRECT_URL   host: ${hostOf(directUrl)}`);

const IPV6_ONLY_DIRECT = /^db\.[a-z0-9]+\.supabase\.co$/i;
const onRender = !!process.env.RENDER;

try {
  const direct = new URL(directUrl);
  const pooled = new URL(databaseUrl);
  if (onRender && IPV6_ONLY_DIRECT.test(direct.hostname) && /pooler\.supabase\.com$/i.test(pooled.hostname)) {
    const session = new URL(pooled.toString());
    session.port = '5432';
    session.search = '';
    directUrl = session.toString();
    console.warn(
      `[deploy] DIRECT_URL points at ${direct.hostname}, which is IPv6-only and unreachable from Render.\n` +
        `[deploy] Using the Session pooler derived from DATABASE_URL instead: ${hostOf(directUrl)}\n` +
        `[deploy] Set DIRECT_URL to that session-pooler URL in the Render dashboard to silence this.`,
    );
  }
} catch {
  // Leave validation of malformed URLs to Prisma and env.ts, which report it clearly.
}

const env = { ...process.env, DIRECT_URL: directUrl };
const backendRoot = path.resolve(__dirname, '..');
const npx = process.platform === 'win32' ? 'npx.cmd' : 'npx';

console.log('[deploy] Running prisma migrate deploy…');
const migrate = spawnSync(npx, ['prisma', 'migrate', 'deploy'], { cwd: backendRoot, env, stdio: 'inherit', shell: process.platform === 'win32' });
if (migrate.status !== 0) {
  console.error(`[deploy] Migration failed (exit ${migrate.status}). Not starting the server.`);
  process.exit(migrate.status ?? 1);
}

console.log('[deploy] Starting server…');
require(path.join(backendRoot, 'dist', 'server.js'));
