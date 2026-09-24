#!/usr/bin/env node
/**
 * Production start: preflight → `prisma migrate deploy` → `node dist/server.js`.
 *
 * The preflight prints host/port/params of both database URLs (never
 * credentials) so a deploy log shows what the platform actually has, and
 * repairs the two Supabase-on-Render misconfigurations that otherwise surface
 * as confusing runtime failures:
 *
 *   1. DATABASE_URL on the transaction pooler (6543) without `pgbouncer=true`
 *      → parallel queries fail with "prepared statement already exists".
 *      Fixed by adding the flag (and the pool sizing) before the server starts.
 *   2. DIRECT_URL on the IPv6-only direct host, unreachable from Render
 *      → migrations fail with P1001. Fixed by deriving the Session pooler.
 *
 * Every repair is logged with the parameters or hosts involved. Setting the
 * variables correctly in the dashboard silences the warnings.
 */
require('dotenv').config();
const { spawnSync } = require('node:child_process');
const path = require('node:path');
const { describe, normalisePooledUrl, deriveSessionPoolerUrl } = require('./dbUrl.cjs');

const onRender = !!process.env.RENDER;
let databaseUrl = process.env.DATABASE_URL ?? '';
let directUrl = process.env.DIRECT_URL ?? '';

console.log(`[deploy] DATABASE_URL: ${describe(databaseUrl)}`);
console.log(`[deploy] DIRECT_URL:   ${describe(directUrl)}`);

// 1. Pooled URL must disable prepared statements on the transaction pooler.
const pooled = normalisePooledUrl(databaseUrl);
if (pooled.added.length > 0) {
  console.warn(
    `[deploy] DATABASE_URL is Supabase's transaction pooler but was missing ${pooled.added.join(', ')}.\n` +
      `[deploy] Added for this process. Set them in the dashboard to silence this.`,
  );
  databaseUrl = pooled.url;
}

// 2. Migrations cannot reach the IPv6-only direct host from Render.
if (onRender) {
  const session = deriveSessionPoolerUrl(directUrl, databaseUrl);
  if (session) {
    console.warn(
      `[deploy] DIRECT_URL points at the IPv6-only direct host, unreachable from Render.\n` +
        `[deploy] Using the Session pooler derived from DATABASE_URL: ${describe(session)}\n` +
        `[deploy] Set DIRECT_URL to that session-pooler URL in the dashboard to silence this.`,
    );
    directUrl = session;
  }
}

// The server is required into this same process below, so it reads these.
process.env.DATABASE_URL = databaseUrl;
process.env.DIRECT_URL = directUrl;

const backendRoot = path.resolve(__dirname, '..');
const npx = process.platform === 'win32' ? 'npx.cmd' : 'npx';

console.log('[deploy] Running prisma migrate deploy…');
const migrate = spawnSync(npx, ['prisma', 'migrate', 'deploy'], {
  cwd: backendRoot,
  env: process.env,
  stdio: 'inherit',
  shell: process.platform === 'win32',
});
if (migrate.status !== 0) {
  console.error(`[deploy] Migration failed (exit ${migrate.status}). Not starting the server.`);
  process.exit(migrate.status ?? 1);
}

console.log('[deploy] Starting server…');
require(path.join(backendRoot, 'dist', 'server.js'));
