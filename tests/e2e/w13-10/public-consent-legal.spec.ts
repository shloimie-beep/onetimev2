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
    await expect(page.getByText('counsel_review_required')).toBeVisible();
    await expect(page.locator('main')).not.toContainText(/\$67|three seats|live billing/i);
  }
});

test('W13-10 signup does not preselect optional reminder consent', async ({ page }) => {
  await page.goto('/signup');
  const email = page.getByLabel('Email class reminders');
  const whatsapp = page.getByLabel('WhatsApp class reminders');
  await expect(email).not.toBeChecked();
  await expect(whatsapp).not.toBeChecked();
  await email.check();
  await expect(page.getByLabel('Phone / WhatsApp')).not.toHaveAttribute('required', '');
  await whatsapp.check();
  await expect(page.getByLabel('Phone / WhatsApp')).toHaveAttribute('required', '');
  await expect(
    page.getByRole('link', { name: 'Communication and Reminder Consent' }),
  ).toHaveAttribute('href', '/communications-consent');
  await expect(
    page.getByRole('link', { name: 'Parent/Guardian and Student Data Notice' }),
  ).toHaveAttribute('href', '/student-data');
});
