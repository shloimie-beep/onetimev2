import { expect, test } from '@playwright/test';

test('W13-10 legal pages render versioned launch truth without billing claims', async ({
  page,
}) => {
  for (const [path, heading] of [
    ['/privacy', /Privacy Notice/i],
    ['/terms', /Terms of Use/i],
    ['/cancellation-refund', /Cancellation and Refund Policy/i],
    ['/communications-consent', /Communications Included In The Terms/i],
    ['/student-data', /Parent\/Guardian and Student Data Notice/i],
  ] as const) {
    await page.goto(path);
    await expect(page.getByRole('heading', { name: heading })).toBeVisible();
    await expect(page.locator('main').getByText('counsel_review_required').first()).toBeVisible();
    await expect(page.locator('main')).not.toContainText(/\$67|three seats|live billing/i);
  }
});

test('W13-10 Family signup uses one required integrated Terms acceptance', async ({ page }) => {
  await page.goto('/signup');
  await expect(page.getByRole('heading', { name: 'Create your Family account' })).toBeVisible();
  await expect(page.getByLabel(/reminder|WhatsApp|phone|Student.*email|card/i)).toHaveCount(0);
  await expect(page.getByLabel('Password', { exact: true })).toBeVisible();
  await expect(page.getByLabel('Confirm password')).toBeVisible();
  await expect(page.locator('[data-signup-form] input[type="checkbox"]')).toHaveCount(1);
  await expect(page.getByLabel(/I agree to the Terms of Use/)).not.toBeChecked();
  await expect(page.getByLabel(/I acknowledge the Privacy Notice/)).toHaveCount(0);
  await expect(page.getByLabel('General marketing')).toHaveCount(0);
  await expect(page.getByLabel('Parent newsletter')).toHaveCount(0);
  await expect(
    page.getByLabel('Create the adult Family account').getByRole('link', {
      name: 'Terms of Use',
    }),
  ).toHaveAttribute('href', '/terms');
});
