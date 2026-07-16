import { expect, test, type Page, type Request } from '@playwright/test';

test('OT-88 classroom launch stays within sink-mode usability and network budgets', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await loginStudent(page);

  const requests: Request[] = [];
  page.on('request', (request) => requests.push(request));
  const started = Date.now();
  await page.getByRole('button', { name: 'Join class' }).click();
  await page.waitForURL('**/classroom/launch/**');
  await expect(page.locator('[data-mocked-zoom-sdk="true"]')).toBeVisible();
  const usableMs = Date.now() - started;

  const metrics = await page.evaluate(() => ({
    overflow: document.documentElement.scrollWidth > document.documentElement.clientWidth,
    resources: performance.getEntriesByType('resource').map((entry) => entry.name),
  }));
  const externalRequests = requests
    .map((request) => new URL(request.url()))
    .filter((url) => url.origin !== 'http://127.0.0.1:3100');
  const apiRequests = requests.filter((request) =>
    new URL(request.url()).pathname.startsWith('/api/'),
  );

  expect(usableMs).toBeLessThanOrEqual(3000);
  expect(metrics.overflow).toBe(false);
  expect(apiRequests.length).toBeLessThanOrEqual(8);
  expect(externalRequests.map((url) => url.href)).toEqual([]);
  expect(
    [...requests.map((request) => request.url()), ...metrics.resources].join('\n'),
  ).not.toMatch(/https?:\/\/(?!127\.0\.0\.1:3100)|zoom\.us|source\.zoom\.us|zoomcdn|\/j\//i);
});

async function loginStudent(page: Page) {
  await page.goto('/login?return_to=%2Fapp%2Fstudent');
  await page.getByLabel('Email').fill('ot-student@example.test');
  await page.getByLabel('Password').fill('StudentPassword!234');
  await page.getByRole('button', { name: 'Login' }).click();
  await page.waitForURL('**/app/student');
  await expect(page.getByRole('button', { name: 'Join class' })).toBeVisible();
}
