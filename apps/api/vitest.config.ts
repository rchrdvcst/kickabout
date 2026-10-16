import { defineConfig } from 'vitest/config';

const TEST_DATABASE_URL =
  process.env.TEST_DATABASE_URL ?? 'postgresql://kickabout:kickabout@localhost:5433/kickabout_test';
process.env.DATABASE_URL = TEST_DATABASE_URL;

export default defineConfig({
  test: {
    globalSetup: ['./test/global-setup.ts'],
    env: { DATABASE_URL: TEST_DATABASE_URL },
    fileParallelism: false,
    hookTimeout: 60_000,
    testTimeout: 20_000,
  },
});
