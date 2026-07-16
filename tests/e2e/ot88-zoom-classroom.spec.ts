import { expect, test, type Page, type Request } from '@playwright/test';

test.describe('OT-88 mocked Zoom classroom launch', () => {
  test('runs the mocked SDK lifecycle on desktop component view without provider network calls', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1200, height: 900 });
    const requests = monitorRequests(page);
    await loginStudent(page);

    await page.getByRole('button', { name: 'Join class' }).click();
    await page.waitForURL('**/classroom/launch/**');
    await expect(page.locator('[data-mocked-zoom-sdk="true"]')).toBeVisible();
    await expect(page.locator('[data-mocked-zoom-sdk="true"]')).toHaveAttribute(
      'data-selected-view',
      'component',
    );
    await expect(page.locator('[data-classroom-status]')).toContainText(
      'Classroom is ready. View mode: desktop.',
    );

    await assertNoRawZoomLeakage(page, requests);
  });

  test('runs the mocked SDK lifecycle on mobile client view without provider network calls', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    const requests = monitorRequests(page);
    await loginStudent(page);

    await page.getByRole('button', { name: 'Join class' }).click();
    await page.waitForURL('**/classroom/launch/**');
    await expect(page.locator('[data-mocked-zoom-sdk="true"]')).toBeVisible();
    await expect(page.locator('[data-mocked-zoom-sdk="true"]')).toHaveAttribute(
      'data-selected-view',
      'client',
    );
    await expect(page.locator('[data-classroom-status]')).toContainText(
      'Classroom is ready. View mode: client.',
    );
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
    );
    expect(overflow).toBe(false);

    await assertNoRawZoomLeakage(page, requests);
  });

  test('surfaces mocked bootstrap fallback, retries, and records leave', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    let failedOnce = false;
    await page.route('**/api/v1/classroom/launch/bootstrap', async (route) => {
      if (!failedOnce) {
        failedOnce = true;
        await route.fulfill({
          status: 503,
          contentType: 'application/json',
          body: JSON.stringify({
            success: false,
            code: 'ADAPTER_UNAVAILABLE',
            message: 'Mock provider temporarily unavailable.',
          }),
        });
        return;
      }
      await route.continue();
    });

    await loginStudent(page);
    await page.getByRole('button', { name: 'Join class' }).click();
    await page.waitForURL('**/classroom/launch/**');
    await expect(page.locator('[data-classroom-status]')).toContainText(
      'Mock provider temporarily unavailable.',
    );
    await expect(page.getByRole('button', { name: 'Retry' })).toBeVisible();

    await page.getByRole('button', { name: 'Retry' }).click();
    await expect(page.locator('[data-mocked-zoom-sdk="true"]')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Leave' })).toBeVisible();

    await page.getByRole('button', { name: 'Leave' }).click();
    await page.waitForURL('**/app/student');
  });
});

async function loginStudent(page: Page) {
  await page.goto('/login?return_to=%2Fapp%2Fstudent');
  await page.getByLabel('Email').fill('ot-student@example.test');
  await page.getByLabel('Password').fill('StudentPassword!234');
  await page.getByRole('button', { name: 'Login' }).click();
  await page.waitForURL('**/app/student');
  await expect(page.getByRole('button', { name: 'Join class' })).toBeVisible();
}

function monitorRequests(page: Page) {
  const requests: Request[] = [];
  page.on('request', (request) => requests.push(request));
  return requests;
}

async function assertNoRawZoomLeakage(page: Page, requests: Request[]) {
  const body = await page.textContent('body');
  const html = await page.content();
  expect(`${body}\n${html}`).not.toMatch(/https?:\/\/|zoom\.us|\/j\//i);
  const externalRequests = requests
    .map((request) => new URL(request.url()))
    .filter((url) => url.origin !== 'http://127.0.0.1:3100');
  expect(externalRequests.map((url) => url.href)).toEqual([]);
  expect(requests.map((request) => request.url()).join('\n')).not.toMatch(
    /zoom\.us|source\.zoom\.us|zoomcdn|bna|operations/i,
  );
}
