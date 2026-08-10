import { expect, test } from '@playwright/test';

test('W13-10 legal pages render versioned launch truth without billing claims', async ({
  page,
}) => {
  for (const [path, heading] of [
    ['/privacy', /Privacy Notice/i],
    ['/terms', /Terms of Use/i],
    ['/cancellation-refund', /Cancellation and Refund Policy/i],
    ['/communications-consent', /Communication and Reminder Consent/i],
    ['/student-data', /Parent\/Guardian and Student Data Notice/i],
  ] as const) {
    await page.goto(path);
    await expect(page.getByRole('heading', { name: heading })).toBeVisible();
    await expect(page.locator('main').getByText('counsel_review_required').first()).toBeVisible();
    await expect(page.locator('main')).not.toContainText(/\$67|three seats|live billing/i);
  }
});

test('W13-10 Family signup presents one required agreement control', async ({ page }) => {
  await page.goto('/signup');
  await expect(page.getByRole('heading', { name: 'Create your Family account' })).toBeVisible();
  await expect(page.getByLabel(/reminder|WhatsApp|phone|Student.*email|card/i)).toHaveCount(0);
  await expect(page.getByLabel('Password', { exact: true })).toBeVisible();
  await expect(page.getByLabel('Confirm password')).toBeVisible();
  await expect(page.getByLabel(/I agree to the Terms/)).not.toBeChecked();
  await expect(page.locator('input[type="checkbox"]')).toHaveCount(1);
  await expect(page.locator('input[name="privacy_accepted"]')).toHaveCount(0);
  await expect(page.locator('input[name="general_marketing_consent"]')).toHaveCount(0);
  await expect(page.locator('input[name="parent_newsletter_consent"]')).toHaveCount(0);
  await expect(
    page.getByLabel('Create the adult Family account').getByRole('link', {
      name: 'Privacy Notice',
    }),
  ).toHaveAttribute('href', '/privacy');
});
