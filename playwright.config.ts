import { defineConfig, devices } from '@playwright/test';

const port = process.env.PORT ?? '3100';
const externalBaseURL = process.env.PLAYWRIGHT_BASE_URL;
const baseURL = externalBaseURL ?? `http://127.0.0.1:${port}`;

export default defineConfig({
  testDir: '.',
  timeout: 30_000,
  fullyParallel: false,
  use: {
    baseURL,
    trace: 'retain-on-failure',
  },
  ...(externalBaseURL
    ? {}
    : {
        webServer: {
          command: 'node --import tsx tests/support/test-server.ts',
          url: `${baseURL}/health`,
          reuseExistingServer: false,
          gracefulShutdown: { signal: 'SIGTERM', timeout: 5_000 },
          timeout: 30_000,
          env: {
            NODE_ENV: 'test',
            OT_TEST_DATABASE: 'memory',
            RUN_MIGRATIONS_ON_STARTUP: 'true',
            PORT: port,
            LOGIN_IDENTIFIER_RATE_LIMIT_MAX: '50',
            LOGIN_IP_RATE_LIMIT_MAX: '100',
            ZOOM_CLASSROOM_ENABLED: 'true',
            ZOOM_CLASSROOM_PROVIDER_MODE: 'sink',
            OT_TEST_CLOCK: '2026-07-16T16:05:00.000Z',
          },
        },
      }),
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
});
