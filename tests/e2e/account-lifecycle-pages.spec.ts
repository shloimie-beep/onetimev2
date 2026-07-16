import { expect, test } from '@playwright/test';

const viewports = [
  { width: 360, height: 800 },
  { width: 390, height: 844 },
  { width: 768, height: 1024 },
  { width: 1440, height: 1000 },
] as const;

test('OPS-03A auth pages are responsive and activation fragments are cleared', async ({ page }) => {
  for (const viewport of viewports) {
    await page.setViewportSize(viewport);
    for (const route of ['/login', '/forgot-password', '/reset-password']) {
      await page.goto(route);
      await expectNoHorizontalOverflow(page);
    }
    await page.goto(`/activate#token=${'a'.repeat(40)}`);
    await expect(page).toHaveURL(/\/activate$/);
    await expectNoHorizontalOverflow(page);
  }
  await page.goto('/login');
  await expect(page.getByRole('heading', { name: 'Welcome back' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Forgot password?' })).toBeVisible();
});

async function expectNoHorizontalOverflow(page: import('@playwright/test').Page) {
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
  );
  expect(overflow).toBe(false);
}
