/**
 * Jest `globalSetup`: runs once per test run, in its own process, before any
 * test file. Resets the `test` schema to match schema.prisma and seeds it, so
 * every run starts from the documented seed state (D-009).
 *
 * Uses `db push` rather than `migrate deploy` because the test schema is
 * disposable; there is no migration history to preserve.
 */
import { execSync } from 'node:child_process';
import path from 'node:path';

// globalSetup does not go through setupFiles, so load the env here as well.
import './loadEnv';

const backendRoot = path.resolve(__dirname, '../..');

function run(command: string): void {
  execSync(command, {
    cwd: backendRoot,
    stdio: 'inherit',
    env: process.env,
  });
}

export default async function globalSetup(): Promise<void> {
  // Guard again here: this process is the one that actually wipes a schema.
  if (!/schema=test/.test(process.env.DATABASE_URL ?? '')) {
    throw new Error('globalSetup: DATABASE_URL must target schema=test');
  }
  if (!/schema=test/.test(process.env.DIRECT_URL ?? '')) {
    throw new Error('globalSetup: DIRECT_URL must target schema=test');
  }

  run('npx prisma db push --force-reset --skip-generate --accept-data-loss');
  run('npx tsx prisma/seed.ts');
}
