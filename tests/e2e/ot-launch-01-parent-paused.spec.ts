import { expect, test } from '@playwright/test';

test('paused Parent gets only identity, recovery, and Support', async ({ page }) => {
  await page.goto(`/login?return_to=${encodeURIComponent('/app/parent')}`);
  await page.getByLabel('Email').fill('ot-paused-parent@example.test');
  await page.getByLabel('Password').fill('PausedParentPassword!234');
  await page.getByRole('button', { name: 'Login' }).click();
  await page.waitForURL('**/app/parent');

  await expect(page.getByRole('heading', { name: 'Learning access is paused' })).toBeVisible();
  await expect(page.getByText('Test Paused Parent', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Send reset link' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Open Support' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Add learner' })).toHaveCount(0);
  await expect(page.getByText(/E2E .* Learner/)).toHaveCount(0);

  const dashboard = await page.request.get('/api/v1/portals/parent/dashboard');
  expect(dashboard.status()).toBe(403);

  await page.getByRole('button', { name: 'Send reset link' }).click();
  await expect(
    page.getByText('If this Parent account is eligible, a secure reset link was queued.'),
  ).toBeVisible();

  await page.getByRole('link', { name: 'Open Support' }).click();
  await page.waitForURL('**/app/parent/support');
  await expect(page.getByRole('heading', { name: 'Member Support' })).toBeVisible();
});
