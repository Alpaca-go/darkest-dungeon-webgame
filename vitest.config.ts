import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    globals: false,
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx', 'tests/**/*.test.ts', 'tests/e2e/**/*.test.ts'],
    reporters: ['default'],
    testTimeout: 30000,
  },
});
