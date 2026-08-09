import { expect, test } from '@playwright/test';

test('privacy notice renders launch-ready policy metadata and data categories', async ({
  page,
}) => {
  await page.goto('/privacy');

  await expect(page.getByRole('heading', { name: 'Privacy Notice' })).toBeVisible();
  await expect(page.locator('[data-policy-version="privacy-notice-v1-2026-07-17"]')).toBeVisible();
  await expect(page.getByText('Policy set version')).toBeVisible();
  await expect(page.getByText('one-time-public-legal-v2-2026-08-09')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Data We May Process' })).toBeVisible();

  for (const category of [
    'Signup records',
    'Account records',
    'Household and guardian records',
    'Learner records',
    'Class and classroom records',
    'Progress and learning records',
    'Communications records',
    'Support records',
    'Provider event records',
    'Payment and test-payment records',
    'Security records',
    'Operational records',
  ]) {
    await expect(page.getByRole('heading', { name: category })).toBeVisible();
  }

  await expect(
    page.getByRole('heading', { name: 'Communications Included In The Terms' }),
  ).toBeVisible();
  await expect(
    page.getByRole('heading', { name: 'Parent/Guardian and Student Data Notice' }),
  ).toBeVisible();
  await expect(page.getByText('does not ask for student names')).toBeVisible();
  await expect(
    page.getByText(
      'The acceptance is not split into separate visible general-marketing or Parent-newsletter checkboxes',
    ),
  ).toBeVisible();

  const body = await page.textContent('body');
  expect(body).not.toMatch(/\bCOPPA\b|\bFERPA\b|\bGDPR\b|\bHIPAA\b/);
  expect(body).toMatch(/does not publish internal architecture/i);
  expect(body).not.toMatch(/postgres:\/\/|sk_live_|whsec_|xoxb-|AKIA/i);
  expect(body).not.toMatch(/paid checkout is live/i);
});

test('terms use current account and billing truth without placeholder claims', async ({ page }) => {
  await page.goto('/terms');

  await expect(page.getByRole('heading', { name: 'Terms of Use' })).toBeVisible();
  await expect(page.locator('[data-policy-version="terms-of-use-v2-2026-08-09"]')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'One Integrated Agreement' })).toBeVisible();
  await expect(page.getByText(/single integrated agreement for Family signup/i)).toBeVisible();
  await expect(
    page.getByRole('heading', { name: 'Payment, Cancellation, And Refunds' }),
  ).toBeVisible();
  await expect(page.getByText('fixture and Stripe test-mode evidence')).toBeVisible();
  await expect(page.getByText(/does not collect payment-card details/i)).toBeVisible();

  const body = (await page.textContent('body')) ?? '';
  expect(body).not.toContain('does not sell access, process payments, or grant member accounts');
  expect(body).not.toMatch(/paid checkout is live|live paid checkout is available/i);
});

test('cancellation and refund policy states period-end access and manual review boundaries', async ({
  page,
}) => {
  await page.goto('/cancellation-refund');

  await expect(page.getByRole('heading', { name: 'Cancellation and Refund Policy' })).toBeVisible();
  await expect(
    page.locator('[data-policy-version="cancellation-refund-v2.1-2026-08-05"]'),
  ).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Canceling Future Renewal' })).toBeVisible();
  await expect(page.getByText(/access continues through the verified end/i)).toBeVisible();
  await expect(page.getByText(/does not automatically create a prorated refund/i)).toBeVisible();
  await expect(page.getByText(/does not by itself delete a Parent account/i)).toBeVisible();
  await expect(page.getByText(/does not collect payment card details/i)).toBeVisible();

  const body = (await page.textContent('body')) ?? '';
  expect(body).not.toMatch(/automatic refund|guaranteed refund|card number|sk_live_|whsec_/i);
});
