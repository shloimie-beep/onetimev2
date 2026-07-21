import { expect, test } from '@playwright/test';

test('Tisha BAv funnel renders final desktop and mobile hero art', async ({ page }) => {
  for (const viewport of [
    { width: 1440, height: 900, asset: 'hero-desktop.png' },
    { width: 390, height: 844, asset: 'hero-mobile.png' },
  ]) {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await page.goto('/tisha-bav', { waitUntil: 'load' });

    await expect(
      page.getByRole('heading', { name: 'Filling the World with Knowledge of Hashem' }),
    ).toBeVisible();
    await expect(page.getByText('כי מלאה הארץ דעה את השם')).toBeVisible();
    await expect(
      page.getByText("Special Tisha B'Av VIP Zoom Class with Rabbi Elly Scheller"),
    ).toBeVisible();
    await expect(page.getByText('Thursday, July 23, 2026')).toBeVisible();
    await expect(
      page.getByText('3:00 PM Eastern / 10:00 PM Israel', { exact: true }),
    ).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Reserve My Spot' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Reserve My Spot' })).toHaveCount(1);
    await expect(page.locator('.event-hero')).not.toContainText('One Time Mishnayos');
    await expect(page.locator('body')).not.toContainText(/student|payment|pricing|GHL iframe/i);

    const backgroundImage = await page
      .locator('.event-hero')
      .evaluate((node) => getComputedStyle(node).backgroundImage);
    expect(backgroundImage).toContain(viewport.asset);
    const imageLoaded = await page.evaluate(async (asset) => {
      const image = new Image();
      const done = new Promise<boolean>((resolve) => {
        image.onload = () => resolve(image.naturalWidth > 0 && image.naturalHeight > 0);
        image.onerror = () => resolve(false);
      });
      image.src = `/assets/events/tisha-bav-2026/${asset}`;
      return done;
    }, viewport.asset);
    expect(imageLoaded).toBe(true);

    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
    );
    expect(overflow).toBe(false);
  }
});

test('Tisha BAv funnel registers and shows final thank-you state on mobile', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/tisha-bav', { waitUntil: 'load' });

  await page.getByRole('textbox', { name: 'Email' }).fill(`browser-${Date.now()}@example.test`);
  await page.getByLabel(/First name/).fill('Miriam');
  await page.getByRole('button', { name: 'Reserve My Spot' }).scrollIntoViewIfNeeded();
  await page.getByRole('button', { name: 'Reserve My Spot' }).click();

  await expect(
    page.getByRole('heading', { name: 'Thank you — your spot has been reserved.' }),
  ).toBeVisible();
  const successPanel = page.locator('[data-event-success-panel]');
  await expect(
    successPanel.getByText("We'll send your Zoom link and event details by email."),
  ).toBeVisible();
});
