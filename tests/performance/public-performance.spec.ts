import { expect, test } from '@playwright/test';

test('landing meets local performance and overflow gates', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const started = Date.now();
  await page.goto('/', { waitUntil: 'load' });
  await page.getByRole('heading', { name: 'Give your son a love for learning Torah.' }).waitFor();
  const usableMs = Date.now() - started;
  const metrics = await page.evaluate(() => {
    const nav = performance.getEntriesByType('navigation')[0] as
      PerformanceNavigationTiming | undefined;
    return {
      transferSize: nav?.transferSize ?? 0,
      overflow: document.documentElement.scrollWidth > document.documentElement.clientWidth,
    };
  });
  expect(usableMs).toBeLessThanOrEqual(2500);
  expect(metrics.overflow).toBe(false);
});

test('signup meets local performance and layout gates', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const started = Date.now();
  await page.goto('/signup', { waitUntil: 'load' });
  await page.getByRole('heading', { name: 'Sign Up Now' }).waitFor();
  const usableMs = Date.now() - started;
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
  );
  expect(usableMs).toBeLessThanOrEqual(2500);
  expect(overflow).toBe(false);
});

test('authenticated CRM list and detail stay within request and usability budgets', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/signup');
  const email = `perf-${Date.now()}@example.test`;
  const contactName = `Perf Parent ${Date.now()}`;
  await page.getByLabel('Parent or contact name').fill(contactName);
  await page.getByLabel('Family or School').fill('Perf Family');
  await page.getByLabel('Location').fill('Jerusalem');
  await page.getByRole('textbox', { name: 'Email' }).fill(email);
  await page.getByLabel('Email class reminders').check();
  await page.getByRole('button', { name: 'Sign Up Now' }).click();
  await page
    .getByRole('heading', { name: 'Thank you - we received your Family signup.' })
    .waitFor();

  const apiRequests: string[] = [];
  page.on('request', (request) => {
    const url = new URL(request.url());
    if (url.pathname.startsWith('/api/v1/')) apiRequests.push(url.pathname);
  });

  await page.goto('/login');
  await page.getByLabel('Email').fill('ot-admin@example.test');
  await page.getByLabel('Password').fill('TestPassword!234');
  await page.getByRole('button', { name: 'Login' }).click();
  const listStarted = Date.now();
  await page.waitForFunction(() => performance.getEntriesByName('ot-crm-list-usable').length > 0);
  const listMs = Date.now() - listStarted;
  const listApiCount = apiRequests.filter(
    (path) => path.startsWith('/api/v1/auth') || path.startsWith('/api/v1/crm'),
  ).length;
  expect(listMs).toBeLessThanOrEqual(2500);
  expect(listApiCount).toBeLessThanOrEqual(5);

  await expect(page.getByLabel('Search')).toBeEnabled();
  await page.getByRole('button', { name: 'Apply' }).click();
  await expect(page.getByRole('button', { name: new RegExp(contactName) })).toBeVisible();
  await page.evaluate(() => performance.clearMarks('ot-crm-detail-usable'));
  await page.getByRole('button', { name: new RegExp(contactName) }).click();
  const detailStarted = Date.now();
  await page.waitForFunction(() => performance.getEntriesByName('ot-crm-detail-usable').length > 0);
  const detailMs = Date.now() - detailStarted;
  const detailRequests = apiRequests.filter((path) => path.includes('/api/v1/crm/contacts/'));
  expect(detailMs).toBeLessThanOrEqual(3000);
  expect(detailRequests.length).toBeLessThanOrEqual(3);
});
