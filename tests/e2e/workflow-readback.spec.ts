import { AxeBuilder } from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import { W12_E2E_ADMIN_COOKIES } from '../support/w12-portal-test-lab-session.ts';

test('admin workflow readback is repository-backed and exposes no provider controls', async ({
  page,
}) => {
  await page.context().addCookies([...W12_E2E_ADMIN_COOKIES]);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/app/communications');
  await expect(page.getByRole('heading', { name: 'Communications', exact: true })).toBeVisible();
  await expect(page.getByText(/Adult conversation context for Rabbi and Admin/)).toBeVisible();
  await expect(page.getByText('GHL mailbox connection pending')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Workflow readback', exact: true })).toHaveCount(
    0,
  );
  await expect(page.getByRole('link', { name: 'Open workflow readback' })).toHaveCount(0);

  await page.goto('/app/communications/OT-01');

  await expect(
    page.getByRole('heading', { name: 'OT-01 Family Account Confirmation' }),
  ).toBeVisible();
  await expect(page.getByText('Final browser readback pending')).toBeVisible();
  await expect(page.getByText(/Provider actions are not available here/)).toBeVisible();
  await expect(page.getByText(/Student contacts and live charges are prohibited/)).toBeVisible();
  await expect(page.locator('.communications-surface').getByRole('button')).toHaveCount(0);
  await expect(page.locator('.communications-surface a[href^="http"]')).toHaveCount(0);

  const api = await page.request.get('/api/v1/communications/workflows/OT-01');
  expect(api.status()).toBe(200);
  expect(await api.json()).toMatchObject({
    workflow: { workflow_key: 'OT-01', observed_status: 'DRAFT_SHELL' },
    external_readback: {
      status: 'pending_external_readback',
      registry_reconciled_from_result: false,
    },
    boundaries: { read_only: true, provider_actions_available: false },
  });

  const axe = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze();
  expect(
    axe.violations.filter((violation) => ['critical', 'serious'].includes(violation.impact ?? '')),
  ).toEqual([]);
});
