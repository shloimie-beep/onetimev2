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
import { runFullAppProvision } from '../../scripts/full-app-staging-live/provision-preview.ts';

type TestRuntime = {
  baseUrl: string;
  sessionToken: string;
  close(): Promise<void>;
};

let staging: TestRuntime;
let production: TestRuntime;

test.beforeAll(async () => {
  staging = await startRuntime(previewConfig(), true);
  production = await startRuntime(productionConfig(), false);
});

test.afterAll(async () => {
  await Promise.all([staging.close(), production.close()]);
});

test('Admin Experience Preview is isolated, responsive, sibling-scoped, and production-gated', async ({
  browser,
}) => {
  test.setTimeout(90_000);
  const context = await browser.newContext({ viewport: { width: 1366, height: 900 } });
  await useAdminSession(context, staging);
  const page = await context.newPage();
  const previewRequests: Array<{ method: string; url: string }> = [];
  context.on('request', (request) => {
    if (request.url().includes('/app/experience-preview/student/')) {
      previewRequests.push({ method: request.method(), url: request.url() });
    }
  });

  await page.goto(`${staging.baseUrl}/app/dashboard`);
  const appNavigation = page.getByLabel('One Time app');
  await expect(appNavigation.getByRole('link', { name: 'Launch Status' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Launch Status' })).toBeVisible();
  await page.getByRole('button', { name: 'Open Launch Status' }).click();
  await expect(page).toHaveURL(`${staging.baseUrl}/app/launch-status`);
  const launchStatusResponse = await page.request.get(`${staging.baseUrl}/api/v1/launch-status`);
  expect(launchStatusResponse.ok()).toBe(true);
  const launchStatusPayload = (await launchStatusResponse.json()) as {
    launch_status: {
      current_milestone: {
        acceptance_complete: number;
        acceptance_total: number;
      };
    };
  };
  const milestone = launchStatusPayload.launch_status.current_milestone;
  const launchStatus = page.locator('.launch-status');
  await expect(launchStatus.getByRole('heading', { name: 'Launch Status' })).toBeVisible();
  await expect(
    launchStatus.getByRole('progressbar', { name: 'Current launch milestone progress' }),
  ).toHaveAttribute('max', String(milestone.acceptance_total));
  await expect(
    launchStatus.getByText(
      `${milestone.acceptance_complete} of ${milestone.acceptance_total} assigned acceptance checks are complete.`,
    ),
  ).toBeVisible();
  await expect(launchStatus.getByRole('heading', { name: 'Exact blockers' })).toBeVisible();
  await expect(
    launchStatus.getByRole('heading', { name: 'Remaining and in progress' }),
  ).toBeVisible();
  await expect(launchStatus.getByRole('heading', { name: 'Next executable task' })).toBeVisible();
  for (const label of [
    'Launch Status',
    'Preview Parent & Student portals',
    'Rabbi Live Console',
    'Content Factory',
  ]) {
    await expect(launchStatus.getByRole('link', { name: label })).toBeVisible();
  }
  expect(await horizontalOverflow(page)).toBeLessThanOrEqual(1);
  await appNavigation.getByRole('link', { name: 'Dashboard' }).click();
  await expect(page).toHaveURL(`${staging.baseUrl}/app/dashboard`);
  await expect(
    page.getByRole('heading', { name: 'Preview Parent & Student portals' }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Open portal preview' }).click();
  await expect(page).toHaveURL(`${staging.baseUrl}/app/experience-preview`);
  await expect(
    page.getByRole('heading', { name: 'The Cohen Family — One Time launch walkthrough' }),
  ).toBeVisible();
  await expect(appNavigation.getByRole('link', { name: 'Experience Preview' })).toBeVisible();
  await expect(appNavigation.getByRole('link', { name: 'Live Console' })).toBeVisible();

  for (const label of ['Parent', 'Student 1', 'Student 2', 'Student 3', 'Rabbi/Classroom']) {
    const role = page.getByRole('button', {
      name: new RegExp(`^Preview ${escapeRegex(label)}:`),
    });
    await role.click();
    await expect(role).toHaveAttribute('aria-pressed', 'true');
    await expect(page.getByText(`Selected preview: ${label}`, { exact: true })).toBeVisible();
  }

  const studentOne = await openStudentPreview(page, context, 'Student 1');
  await assertDedicatedStudentShell(studentOne, 'Ari Cohen');
  expect(await studentOne.evaluate(() => window.opener === null)).toBe(true);

  const studentTwo = await openStudentPreview(page, context, 'Student 2');
  await assertDedicatedStudentShell(studentTwo, 'Dovid Cohen');
  expect(await studentTwo.evaluate(() => window.opener === null)).toBe(true);
  expect(studentOne.url()).not.toBe(studentTwo.url());

  await studentOne.reload();
  await expect(studentOne.getByRole('heading', { name: 'Student Portal' })).toBeVisible();
  await expect(studentOne.getByText('Ari Cohen', { exact: true }).first()).toBeVisible();
  await expect(studentOne.getByText('Dovid Cohen')).toHaveCount(0);
  await studentTwo.reload();
  await expect(studentTwo.getByRole('heading', { name: 'Student Portal' })).toBeVisible();
  await expect(studentTwo.getByText('Dovid Cohen', { exact: true }).first()).toBeVisible();
  await expect(studentTwo.getByText('Ari Cohen')).toHaveCount(0);

  const adminSession = await page.evaluate(async () => {
    const response = await fetch('/api/v1/auth/session', {
      headers: { accept: 'application/json' },
    });
    return { status: response.status, json: await response.json() };
  });
  expect(adminSession.status).toBe(200);
  expect(adminSession.json.user.role).toBe('owner');
  await expect(appNavigation.getByRole('link', { name: 'Experience Preview' })).toBeVisible();

  await page.setViewportSize({ width: 360, height: 800 });
  await page.goto(`${staging.baseUrl}/app/dashboard`);
  await expect(page.getByRole('heading', { name: 'Launch Status' })).toBeVisible();
  await expect(
    page.getByRole('heading', { name: 'Preview Parent & Student portals' }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Open navigation' }).click();
  const drawer = page.getByRole('dialog', { name: 'One Time navigation' });
  await expect(drawer.getByRole('link', { name: 'Launch Status' })).toBeVisible();
  await expect(drawer.getByRole('link', { name: 'Experience Preview' })).toBeVisible();
  await drawer.getByRole('button', { name: 'Close navigation' }).click();
  await page.getByRole('button', { name: 'Open Launch Status' }).click();
  await expect(page).toHaveURL(`${staging.baseUrl}/app/launch-status`);
  await expect(
    page.getByRole('progressbar', { name: 'Current launch milestone progress' }),
  ).toBeVisible();
  expect(await horizontalOverflow(page)).toBeLessThanOrEqual(1);
  await page.goto(`${staging.baseUrl}/app/dashboard`);
  await page.getByRole('button', { name: 'Open portal preview' }).click();
  await expect(
    page.getByRole('heading', { name: 'The Cohen Family — One Time launch walkthrough' }),
  ).toBeVisible();
  await page.getByRole('button', { name: /^Preview Student 1:/ }).click();
  await expect(page.getByText('Selected preview: Student 1', { exact: true })).toBeVisible();
  expect(await horizontalOverflow(page)).toBeLessThanOrEqual(1);
  await studentOne.setViewportSize({ width: 360, height: 800 });
  expect(await horizontalOverflow(studentOne)).toBeLessThanOrEqual(1);

  expect(previewRequests.length).toBeGreaterThan(0);
  expect(previewRequests.every((request) => request.method === 'GET')).toBe(true);

  await context.close();

  const productionContext = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  await useAdminSession(productionContext, production);
  const productionPage = await productionContext.newPage();
  await productionPage.goto(`${production.baseUrl}/app/dashboard`);
  await expect(productionPage.getByRole('heading', { name: 'Launch Status' })).toBeVisible();
  await expect(
    productionPage.getByLabel('One Time app').getByRole('link', { name: 'Launch Status' }),
  ).toBeVisible();
  await productionPage.getByRole('button', { name: 'Open Launch Status' }).click();
  await expect(productionPage).toHaveURL(`${production.baseUrl}/app/launch-status`);
  await expect(
    productionPage.getByRole('progressbar', { name: 'Current launch milestone progress' }),
  ).toBeVisible();
  await productionPage.goto(`${production.baseUrl}/app/dashboard`);
  await expect(
    productionPage.getByRole('heading', { name: 'Preview Parent & Student portals' }),
  ).toHaveCount(0);
  await expect(productionPage.getByRole('link', { name: 'Experience Preview' })).toHaveCount(0);
  await expect(productionPage.getByRole('link', { name: 'Live Console' })).toHaveCount(0);
  const rejected = await productionPage.goto(`${production.baseUrl}/app/experience-preview`);
  expect(rejected?.status()).toBe(404);
  await productionContext.close();
});

async function openStudentPreview(
  page: Page,
  context: BrowserContext,
  roleLabel: 'Student 1' | 'Student 2',
) {
  await page
    .getByRole('button', { name: new RegExp(`^Preview ${escapeRegex(roleLabel)}:`) })
    .click();
  await page.getByRole('button', { name: 'Prepare fictional Student session' }).click();
  const link = page.getByRole('link', { name: 'Open fictional Student session' });
  await expect(link).toHaveAttribute('target', '_blank');
  await expect(link).toHaveAttribute('rel', 'noopener noreferrer');
  const [studentPage] = await Promise.all([context.waitForEvent('page'), link.click()]);
  await expect(
    studentPage.getByRole('heading', { name: 'Fictional Student portal preview' }),
  ).toBeVisible();
  return studentPage;
}

async function assertDedicatedStudentShell(page: Page, learnerName: string) {
  await expect(page.getByRole('heading', { name: 'Student Portal' })).toBeVisible();
  await expect(page.getByText(learnerName, { exact: true }).first()).toBeVisible();
  await expect(
    page.locator('.ot-portal-focus').getByRole('heading', { name: 'Today' }),
  ).toBeVisible();
  await expect(
    page.locator('.ot-portal-menu').getByRole('button', { name: /^Library/ }),
  ).toBeVisible();
  await expect(page.locator('.fictional-student-portal-preview')).toHaveAttribute('inert', '');
  await expect(page.getByRole('navigation', { name: 'One Time app' })).toHaveCount(0);
  await expect(page.locator('#crm-root')).toHaveCount(0);
  await expect(page.locator('.crm-shell')).toHaveCount(0);
  await expect(page.getByRole('link', { name: /logout/i })).toHaveCount(0);
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

async function startRuntime(config: AppConfig, seedScenario: boolean): Promise<TestRuntime> {
  const pool = createMemoryPool();
  await runMigrations(pool);
  const userKey = await createAccountUser({
    pool,
    config,
    email: seedScenario
      ? 'preview-browser-owner@example.test'
      : 'production-browser-owner@example.test',
    password: 'BrowserPreviewTest!234',
    displayName: 'Browser Preview Owner',
    role: 'owner',
  });
  const user = await getSessionUserByKey({ pool, config, userKey });
  if (!user) throw new Error('Missing browser test owner.');
  const session = await createSession({ pool, config, user });
  if (seedScenario) {
    await runFullAppProvision({
      pool,
      config,
      publicBaseUrl: config.publicBaseUrl,
      writePrivateHandoff: false,
      requirePrivateDestinations: false,
      now: new Date('2026-07-22T12:00:00.000Z'),
    });
  }
  const app = createApp({
    config,
    pool,
    distDir: path.resolve('dist/apps/web/public'),
    clock: () => new Date('2026-07-22T12:00:00.000Z'),
  });
  const server = await new Promise<ReturnType<typeof app.listen>>((resolve, reject) => {
    const instance = app.listen(0, 'localhost', (error?: Error) => {
      if (error) reject(error);
      else resolve(instance);
    });
  });
  const address = server.address();
  if (typeof address !== 'object' || !address) throw new Error('Missing browser test address.');
  return {
    baseUrl: `http://localhost:${address.port}`,
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

function previewConfig() {
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
    DELIVERY_ENVIRONMENT: 'production',
    ONE_TIME_RUNTIME_ENVIRONMENT: 'production',
    ONE_TIME_EXPERIENCE_PREVIEW_ENABLED: 'false',
    LIVE_CLASS_FAKE_ADAPTER_ENABLED: 'false',
  });
}

function baseEnvironment() {
  return {
    NODE_ENV: 'test',
    PUBLIC_BASE_URL: 'https://preview-browser.example.test',
    APP_VERSION: 'experience-preview-browser-test',
    COMMIT_SHA: 'experience-preview-browser-test',
    OUTBOX_TRANSPORT_MODE: 'sink',
    ONE_TIME_ACCOUNT_KEY: 'rabbi_sheller_provider',
    ONE_TIME_PRODUCT_KEY: 'one_time_mishnah_class',
    ZOOM_CLASSROOM_ENABLED: 'true',
  } satisfies NodeJS.ProcessEnv;
}

function escapeRegex(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
