import { expect, test } from '@playwright/test';

test('W13-10 legal pages render versioned launch truth without billing claims', async ({
  page,
}) => {
  for (const [path, heading] of [
    ['/privacy', 'Privacy Notice'],
    ['/terms', 'Terms of Use'],
    ['/communications-consent', 'Communication And Reminder Consent'],
    ['/student-data', 'Parent, Guardian, And Student Data'],
  ] as const) {
    await page.goto(path);
    await expect(page.getByRole('heading', { name: heading })).toBeVisible();
    await expect(page.getByText('counsel_review_required')).toBeVisible();
    await expect(page.locator('main')).not.toContainText(/\$67|three seats|live billing/i);
  }
});

test('W13-10 signup does not preselect optional reminder consent', async ({ page }) => {
  await page.goto('/signup');
  const email = page.getByLabel('Email reminders');
  const whatsapp = page.getByLabel('WhatsApp reminders');
  await expect(email).not.toBeChecked();
  await expect(whatsapp).not.toBeChecked();
  await expect(page.locator('input[name="reminder_preference"]')).toHaveValue('none');
  await email.check();
  await expect(page.locator('input[name="reminder_preference"]')).toHaveValue('email');
  await whatsapp.check();
  await expect(page.locator('input[name="reminder_preference"]')).toHaveValue('both');
  await expect(page.getByLabel('Phone / WhatsApp')).toHaveAttribute('required', '');
  await expect(page.getByRole('link', { name: 'Communication consent' })).toHaveAttribute(
    'href',
    '/communications-consent',
  );
});
