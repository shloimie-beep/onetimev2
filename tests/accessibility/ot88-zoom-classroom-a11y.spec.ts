import { AxeBuilder } from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

for (const viewport of [
  { label: 'mobile', width: 390, height: 844, view: 'client' },
  { label: 'desktop', width: 1200, height: 900, view: 'component' },
]) {
  test(`OT-88 classroom launch has no axe violations on ${viewport.label}`, async ({ page }) => {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await openClassroom(page);
    await expect(page.locator('[data-mocked-zoom-sdk="true"]')).toHaveAttribute(
      'data-selected-view',
      viewport.view,
    );

    const results = await new AxeBuilder({ page }).analyze();
    expect(results.violations).toEqual([]);
  });
}

async function openClassroom(page: Page) {
  await page.goto('/login?return_to=%2Fapp%2Fstudent');
  await page.getByLabel('Email').fill('ot-student@example.test');
  await page.getByLabel('Password').fill('StudentPassword!234');
  await page.getByRole('button', { name: 'Login' }).click();
  await page.waitForURL('**/app/student');
  await page.getByRole('button', { name: 'Join class' }).click();
  await page.waitForURL('**/classroom/launch/**');
  await expect(page.locator('[data-mocked-zoom-sdk="true"]')).toBeVisible();
}
