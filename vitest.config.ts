import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['lib/**/*.test.ts'],
    // Each DB test file boots its own embedded PGlite; unbounded parallelism
    // starves them into 20s timeouts once the suite is ~20+ files. Cap the
    // workers and give slow cold-starts headroom.
    maxWorkers: 4,
    minWorkers: 1,
    testTimeout: 30000,
  },
});
