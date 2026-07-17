import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/integration/**/*.test.ts'],
    hookTimeout: 15_000,
    testTimeout: 20_000,
  },
});
