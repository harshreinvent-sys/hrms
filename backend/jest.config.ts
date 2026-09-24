import type { Config } from 'jest';

/**
 * Tests run against the `test` schema of the same Supabase database (D-006,
 * D-009). `tests/setup/globalSetup.ts` resets and seeds that schema once per run.
 */
const config: Config = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/tests'],
  testMatch: ['**/*.test.ts'],
  setupFiles: ['<rootDir>/tests/setup/loadEnv.ts'],
  globalSetup: '<rootDir>/tests/setup/globalSetup.ts',
  testTimeout: 30_000,
  verbose: true,
};

export default config;
