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

test('W13-10 Family signup requires legal acceptance and keeps optional consent adult-only', async ({
  page,
}) => {
  await page.route('**/api/v1/signup/family/bootstrap', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        idempotency_key: 'a'.repeat(43),
        csrf_token: `1789315200.${'b'.repeat(43)}.${'c'.repeat(43)}`,
        expires_at: '2026-09-11T15:20:00.000Z',
        writes_allowed: true,
      }),
    }),
  );
  await page.goto('/signup');
  await expect(page.getByRole('heading', { name: 'Enroll Your Son Free' })).toBeVisible();
  await expect(page.getByLabel('Password', { exact: true })).toHaveAttribute('required', '');
  await expect(page.getByLabel('Confirm password')).toHaveAttribute('required', '');
  await expect(
    page.locator(
      'input[name*="student" i], input[name*="whatsapp" i], input[name*="phone" i], input[name*="card" i], input[type="tel"]',
    ),
  ).toHaveCount(0);
  await expect(page.getByLabel('General marketing')).not.toBeChecked();
  await expect(page.getByLabel('Parent newsletter')).not.toBeChecked();
  await expect(page.getByLabel(/I agree to the Terms/)).toHaveAttribute('required', '');
  await expect(page.getByLabel(/I acknowledge the Privacy Notice/)).toHaveAttribute('required', '');
  await expect(page.getByRole('link', { name: 'Privacy Notice' })).toHaveAttribute(
    'href',
    '/privacy',
  );
  await expect(page.getByRole('link', { name: 'Student Data Notice' })).toHaveAttribute(
    'href',
    '/student-data',
  );
});
