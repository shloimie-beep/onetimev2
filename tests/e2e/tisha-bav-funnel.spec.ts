import { expect, test } from '@playwright/test';

test('Tisha BAv funnel renders and registers on mobile', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/tisha-bav', { waitUntil: 'load' });

  await expect(
    page.getByRole('heading', { name: "A Live Tisha B'Av Program with Rabbi Eli Scheller" }),
  ).toBeVisible();
  await expect(page.getByText('Thursday, July 23, 2026')).toBeVisible();
  await expect(page.getByText('3:00 PM Eastern / 10:00 PM Israel', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Send Me the Zoom Link' })).toBeVisible();
  await expect(page.locator('body')).not.toContainText(/student|payment|GHL iframe/i);

  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
  );
  expect(overflow).toBe(false);

  await page.getByRole('textbox', { name: 'Email' }).fill(`browser-${Date.now()}@example.test`);
  await page.getByLabel(/First name/).fill('Miriam');
  await page.getByRole('button', { name: 'Send Me the Zoom Link' }).click();

  await expect(page.getByRole('heading', { name: "You're registered." })).toBeVisible();
  const successPanel = page.locator('[data-event-success-panel]');
  await expect(
    successPanel.getByText("We'll email the private access details before the program."),
  ).toBeVisible();
  await expect(successPanel.getByText('Thursday, July 23')).toBeVisible();
});
