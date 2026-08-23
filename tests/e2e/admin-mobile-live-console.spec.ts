import { expect, test } from '@playwright/test';
import { W12_E2E_ADMIN_COOKIES } from '../support/w12-portal-test-lab-session.ts';

test('Admin can open Live Console directly from the mobile drawer', async ({ context, page }) => {
  await context.addCookies([...W12_E2E_ADMIN_COOKIES]);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/app/dashboard');

  await page.getByRole('button', { name: 'Open navigation' }).click();
  const drawer = page.getByRole('dialog', { name: 'One Time navigation' });
  const liveConsoleLink = drawer.getByRole('link', { name: 'Live Console' });
  await expect(liveConsoleLink).toBeVisible();
  await expect(liveConsoleLink).toHaveAttribute('href', '/app/live-console?section=zoom');

  await liveConsoleLink.click();
  await expect(page).toHaveURL(/\/app\/live-console\?section=zoom$/u);
  await expect(page.getByRole('heading', { name: 'Live Console' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Zoom', level: 3 })).toBeVisible();
});
