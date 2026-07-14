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
