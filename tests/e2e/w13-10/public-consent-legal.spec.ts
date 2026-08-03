import { expect, test } from '@playwright/test';

test('W13-10 legal pages render versioned launch truth without billing claims', async ({
  page,
}) => {
  for (const [path, heading] of [
    ['/privacy', /Privacy Notice/i],
    ['/terms', /Terms of Use/i],
    ['/communications-consent', /Communication and Reminder Consent/i],
    ['/student-data', /Parent\/Guardian and Student Data Notice/i],
  ] as const) {
    await page.goto(path);
    await expect(page.getByRole('heading', { name: heading })).toBeVisible();
    await expect(page.locator('main').getByText('counsel_review_required').first()).toBeVisible();
    await expect(page.locator('main')).not.toContainText(/\$67|three seats|live billing/i);
  }
});

test('W13-10 adult pre-registration exposes no optional reminder or Student fields', async ({
  page,
}) => {
  await page.goto('/signup');
  await expect(page.getByRole('heading', { name: 'Pre-register Your Family' })).toBeVisible();
  await expect(page.getByLabel(/reminder|WhatsApp|phone|Student|password|marketing/i)).toHaveCount(
    0,
  );
  await expect(page.getByText(/Follow-up requested/)).toBeVisible();
  await expect(page.getByRole('link', { name: 'Privacy Notice' })).toHaveAttribute(
    'href',
    '/privacy',
  );
});
