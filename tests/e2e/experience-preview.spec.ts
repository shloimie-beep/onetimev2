import path from 'node:path';
import { expect, test, type BrowserContext, type Page } from '@playwright/test';
import { createApp } from '../../apps/web/src/server/app.ts';
import { loadConfig, type AppConfig } from '../../packages/config/src/index.ts';
import { createMemoryPool, runMigrations, type DbPool } from '../../packages/db/src/index.ts';
import {
  createAccountUser,
  createSession,
  getSessionUserByKey,
} from '../../packages/domain/src/index.ts';

type TestRuntime = {
  baseUrl: string;
  productionHost: string | null;
  sessionToken: string;
  close(): Promise<void>;
};

let staging: TestRuntime;
let production: TestRuntime;

test.beforeAll(async () => {
  staging = await startRuntime(stagingConfig());
  production = await startRuntime(productionConfig());
});

test.afterAll(async () => {
  await Promise.all([staging?.close(), production?.close()]);
});

test('ordinary Admin application removes preview and launch-status surfaces in every runtime', async ({
  browser,
}) => {
  test.setTimeout(90_000);
  for (const runtime of [staging, production]) {
    if (runtime.productionHost) {
      const headers = {
        host: runtime.productionHost,
        cookie: `otcrm_session=${runtime.sessionToken}`,
      };
      const productionContext = await browser.newContext();
      try {
        const productionDashboard = await productionContext.request.get(
          `${runtime.baseUrl}/app/dashboard`,
          { headers },
        );
        expect(productionDashboard.status()).toBe(200);
        const productionHtml = await productionDashboard.text();
        expect(productionHtml).not.toMatch(/Experience Preview|Launch Status/iu);
        for (const route of [
          '/app/experience-preview',
          '/app/launch-status',
          '/api/v1/launch-status',
        ]) {
          const response = await productionContext.request.get(`${runtime.baseUrl}${route}`, {
            headers,
          });
          expect(response.status()).toBe(404);
        }
      } finally {
        await productionContext.close();
      }
      continue;
    }

    const context = await browser.newContext({ viewport: { width: 1366, height: 900 } });
    await useAdminSession(context, runtime);
    const page = await context.newPage();

    await page.goto(`${runtime.baseUrl}/app/dashboard`);
    await expect(page.getByRole('heading', { name: 'Today' })).toBeVisible();
    const session = await page.request.get(`${runtime.baseUrl}/api/v1/auth/session`);
    const sessionBody = (await session.json()) as {
      capabilities: { operator_experience: { live_console: boolean } };
    };
    const primaryLabels = [
      'Today',
      'Learning',
      'People',
      'Communications',
      'Operations',
      'Account',
    ];
    await expect(
      page.getByLabel('One Time app').getByRole('link').allTextContents(),
    ).resolves.toEqual(primaryLabels);
    await expect(
      page.getByLabel('One Time utilities').getByRole('link').allTextContents(),
    ).resolves.toEqual(['Search']);
    await assertRemovedControls(page);
    expect(await horizontalOverflow(page)).toBeLessThanOrEqual(1);

    const previewRoute = await page.request.get(`${runtime.baseUrl}/app/experience-preview`);
    expect(previewRoute.status()).toBe(404);
    const launchStatusRoute = await page.request.get(`${runtime.baseUrl}/app/launch-status`);
    expect(launchStatusRoute.status()).toBe(404);
    const launchStatusApi = await page.request.get(`${runtime.baseUrl}/api/v1/launch-status`);
    expect(launchStatusApi.status()).toBe(404);

    await page.setViewportSize({ width: 360, height: 800 });
    await page.goto(`${runtime.baseUrl}/app/dashboard`);
    await page.getByRole('button', { name: 'Open navigation' }).click();
    const drawer = page.getByRole('dialog', { name: 'One Time navigation' });
    await expect(
      drawer.getByLabel('One Time app').getByRole('link').allTextContents(),
    ).resolves.toEqual(primaryLabels);
    await expect(
      drawer.getByLabel('One Time utilities').getByRole('link').allTextContents(),
    ).resolves.toEqual(['Search']);
    await expect(drawer.getByRole('link', { name: 'Experience Preview' })).toHaveCount(0);
    await expect(drawer.getByRole('link', { name: 'Launch Status' })).toHaveCount(0);
    expect(await horizontalOverflow(page)).toBeLessThanOrEqual(1);

    await context.close();
  }
});

async function assertRemovedControls(page: Page) {
  await expect(
    page.getByRole('heading', { name: /Preview Parent & Student portals/i }),
  ).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Open portal preview' })).toHaveCount(0);
  await expect(page.getByRole('link', { name: 'Experience Preview' })).toHaveCount(0);
  await expect(page.getByRole('link', { name: 'Launch Status' })).toHaveCount(0);
}

async function horizontalOverflow(page: Page) {
  return page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
}

async function useAdminSession(context: BrowserContext, runtime: TestRuntime) {
  const hostname = new URL(runtime.baseUrl).hostname;
  await context.addCookies([
    {
      name: 'otcrm_session',
      value: runtime.sessionToken,
      domain: hostname,
      path: '/',
      httpOnly: true,
      sameSite: 'Lax',
    },
  ]);
}

async function startRuntime(config: AppConfig): Promise<TestRuntime> {
  const pool = createMemoryPool();
  await runMigrations(pool);
  const userKey = await createAccountUser({
    pool,
    config,
    email: `${config.deliveryEnvironment}-browser-owner@example.test`,
    password: 'OrdinaryAppBrowserTest!234',
    displayName: 'Browser Owner',
    role: 'owner',
  });
  const user = await getSessionUserByKey({ pool, config, userKey });
  if (!user) throw new Error('Missing browser test owner.');
  const session = await createSession({ pool, config, user });
  const app = createApp({
    config,
    pool,
    distDir: path.resolve('dist/apps/web/public'),
    clock: () => new Date('2026-07-22T12:00:00.000Z'),
  });
  const server = await new Promise<ReturnType<typeof app.listen>>((resolve, reject) => {
    const instance = app.listen(0, '127.0.0.1', (error?: Error) => {
      if (error) reject(error);
      else resolve(instance);
    });
  });
  const address = server.address();
  if (typeof address !== 'object' || !address) throw new Error('Missing browser test address.');
  return {
    baseUrl: `http://127.0.0.1:${address.port}`,
    productionHost: config.nodeEnv === 'production' ? 'app.onetimeonetime.com' : null,
    sessionToken: session.session_token,
    close: () => closeRuntime(server, pool),
  };
}

async function closeRuntime(
  server: ReturnType<ReturnType<typeof createApp>['listen']>,
  pool: DbPool,
) {
  await new Promise<void>((resolve) => server.close(() => resolve()));
  await pool.end();
}

function stagingConfig() {
  return loadConfig({
    ...baseEnvironment(),
    DELIVERY_ENVIRONMENT: 'isolated_staging',
    ONE_TIME_RUNTIME_ENVIRONMENT: 'isolated_staging',
    ONE_TIME_EXPERIENCE_PREVIEW_ENABLED: 'true',
    LIVE_CLASS_FAKE_ADAPTER_ENABLED: 'true',
  });
}

function productionConfig() {
  return loadConfig({
    ...baseEnvironment(),
    NODE_ENV: 'production',
    AUTH_CSRF_SECRET: 'e2e-fixture'.padEnd(32, '-'),
    MFA_SECRET_ENCRYPTION_KEY: 'e2e-fixture'.padEnd(32, '-'),
    DELIVERY_ENVIRONMENT: 'production',
    ONE_TIME_RUNTIME_ENVIRONMENT: 'production',
    ONE_TIME_EXPERIENCE_PREVIEW_ENABLED: 'false',
    LIVE_CLASS_FAKE_ADAPTER_ENABLED: 'false',
  });
}

function baseEnvironment() {
  return {
    NODE_ENV: 'test',
    PUBLIC_BASE_URL: 'https://ordinary-browser.example.test',
    APP_VERSION: 'ordinary-app-browser-test',
    COMMIT_SHA: 'ordinary-app-browser-test',
    PROTECTED_PAYLOAD_ENCRYPTION_KEY: 'test-only-protected-payload-key-32-bytes',
    OUTBOX_TRANSPORT_MODE: 'sink',
    ONE_TIME_ACCOUNT_KEY: 'rabbi_sheller_provider',
    ONE_TIME_PRODUCT_KEY: 'one_time_mishnayos',
    ZOOM_CLASSROOM_ENABLED: 'true',
  } satisfies NodeJS.ProcessEnv;
}
