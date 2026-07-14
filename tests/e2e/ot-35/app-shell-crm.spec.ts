import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { expect, test, type Page } from '@playwright/test';

const screenshotDir = path.resolve(process.cwd(), 'ops/evidence/ot-35/screenshots');

test('authenticated shell has one CRM destination, no dead product nav, and no cross-app requests', async ({
  page,
}) => {
  const requested: string[] = [];
  page.on('request', (request) => requested.push(request.url()));
  await page.setViewportSize({ width: 1440, height: 1000 });
  await login(page);

  await expect(page.getByRole('heading', { name: 'CRM' })).toBeVisible();
  await expect(page.locator('.app-header')).toBeVisible();
  await expect(page.locator('.app-sidebar')).toBeVisible();
  await expect(
    page.getByRole('navigation', { name: 'One Time app' }).getByRole('link', { name: 'CRM' }),
  ).toHaveCount(1);

  for (const label of [
    'Home',
    'Contacts',
    'Communications',
    'Tasks',
    'Relationships',
    'Classes',
    'Billing',
    'Integrations',
    'Studio',
    'Telegram',
    'Reports',
  ]) {
    await expect(page.getByRole('link', { name: label })).toHaveCount(0);
  }
  await expect(page.getByText('View as Rabbi')).toHaveCount(0);
  await expect(page.getByText('Super Admin')).toHaveCount(0);

  expect(requested.some((url) => /\/(bna|operations)(\/|$)/i.test(new URL(url).pathname))).toBe(
    false,
  );
});

test('mobile drawer traps focus, closes by every shell action, and restores focus', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await login(page);
  const menu = page.getByRole('button', { name: 'Open navigation' });

  await menu.click();
  await expect(page.getByRole('dialog', { name: 'One Time navigation' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Close navigation' })).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(
    page.getByRole('dialog', { name: 'One Time navigation' }).getByRole('link', { name: 'CRM' }),
  ).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(page.getByRole('button', { name: 'Close navigation' })).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog', { name: 'One Time navigation' })).toBeHidden();
  await expect(menu).toBeFocused();

  await menu.click();
  await page
    .getByRole('dialog', { name: 'One Time navigation' })
    .getByRole('link', { name: 'CRM' })
    .click();
  await expect(page.getByRole('dialog', { name: 'One Time navigation' })).toBeHidden();

  await page.setViewportSize({ width: 768, height: 1024 });
  await menu.click();
  await page.mouse.click(760, 20);
  await expect(page.getByRole('dialog', { name: 'One Time navigation' })).toBeHidden();
  await expectNoHorizontalOverflow(page);
});

test('CRM filters stay visible on mobile and ordinary targets are 44 by 44', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 800 });
  await login(page);
  const email = `ot35-filter-${Date.now()}@example.test`;
  await createContact(page, 'OT35 Filter Parent', email);

  await page.getByLabel('Search').fill(email);
  await page.getByLabel('Type').selectOption('family');
  await page.getByRole('button', { name: 'Apply' }).click();

  await expect(page.getByLabel('Active filters')).toContainText('Search:');
  await expect(page.getByLabel('Active filters')).toContainText('Type: Family');
  expect(page.url()).not.toContain(email);
  await expect(page.getByRole('button', { name: /OT35 Filter Parent/ })).toBeVisible();

  const undersizedTargets = await page.evaluate(() =>
    [
      ...document.querySelectorAll<HTMLElement>(
        'button, a[href], input, select, textarea, [role="button"]',
      ),
    ]
      .filter((element) => {
        const style = getComputedStyle(element);
        const rect = element.getBoundingClientRect();
        return (
          style.display !== 'none' &&
          style.visibility !== 'hidden' &&
          rect.width > 0 &&
          rect.height > 0 &&
          (rect.width < 44 || rect.height < 44)
        );
      })
      .map((element) => {
        const rect = element.getBoundingClientRect();
        return {
          tag: element.tagName,
          text: element.textContent?.trim().slice(0, 40) ?? '',
          width: Math.round(rect.width),
          height: Math.round(rect.height),
        };
      }),
  );
  expect(undersizedTargets).toEqual([]);

  await expectNoHorizontalOverflow(page);
});

test('rows open by keyboard and Back restores focus without PII storage', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await login(page);
  const email = `ot35-keyboard-${Date.now()}@example.test`;
  await createContact(page, 'OT35 Keyboard Parent', email);
  await page.getByLabel('Search').fill(email);
  await page.getByRole('button', { name: 'Apply' }).click();

  const row = page.getByRole('button', { name: /OT35 Keyboard Parent/ });
  await row.focus();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('heading', { name: 'OT35 Keyboard Parent' })).toBeVisible();
  await expect(page.getByText(email)).toBeVisible();

  await page.getByRole('button', { name: 'Back to CRM' }).click();
  await expect(page.getByRole('button', { name: /OT35 Keyboard Parent/ })).toBeFocused();
  expect(await page.evaluate(() => Object.keys(localStorage))).toEqual([]);
  expect(page.url()).not.toContain(email);
});

test('session expiry clears protected CRM details before sign-in recovery', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await login(page);
  const email = `ot35-expired-${Date.now()}@example.test`;
  await createContact(page, 'OT35 Expired Parent', email);
  await page.getByLabel('Search').fill(email);
  await page.getByRole('button', { name: 'Apply' }).click();
  await page.getByRole('button', { name: /OT35 Expired Parent/ }).click();
  await expect(page.getByRole('heading', { name: 'OT35 Expired Parent' })).toBeVisible();

  await page.context().clearCookies();
  await page.getByRole('button', { name: 'Back to CRM' }).click();
  await expect(page.getByRole('heading', { name: 'Session expired' })).toBeVisible();
  await expect(page.getByText('OT35 Expired Parent')).toHaveCount(0);
  await expect(
    page.getByLabel('Session expired').getByRole('button', { name: 'Sign in' }),
  ).toBeVisible();
});

test('captures synthetic list and detail screenshots at OT-35 viewport matrix', async ({
  page,
}) => {
  await mkdir(screenshotDir, { recursive: true });
  const viewports = [
    { name: '360x800', width: 360, height: 800 },
    { name: '390x844', width: 390, height: 844 },
    { name: '768x1024', width: 768, height: 1024 },
    { name: '1440x1000', width: 1440, height: 1000 },
  ];

  for (const viewport of viewports) {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await login(page);
    const email = `ot35-shot-${viewport.name}-${Date.now()}@example.test`;
    await createContact(page, `OT35 Shot ${viewport.name}`, email);
    await page.getByLabel('Search').fill(email);
    await page.getByRole('button', { name: 'Apply' }).click();
    await expect(
      page.getByRole('button', { name: new RegExp(`OT35 Shot ${viewport.name}`) }),
    ).toBeVisible();
    await page.screenshot({
      path: path.join(screenshotDir, `crm-list-${viewport.name}.png`),
      fullPage: true,
    });

    await page.getByRole('button', { name: new RegExp(`OT35 Shot ${viewport.name}`) }).click();
    await expect(page.getByRole('heading', { name: `OT35 Shot ${viewport.name}` })).toBeVisible();
    await page.screenshot({
      path: path.join(screenshotDir, `crm-detail-${viewport.name}.png`),
      fullPage: true,
    });
  }
});

async function login(page: Page) {
  await page.goto('/login');
  await page.getByLabel('Email').fill('ot-admin@example.test');
  await page.getByLabel('Password').fill('TestPassword!234');
  await page.getByRole('button', { name: 'Login' }).click();
  await page.waitForURL('**/app/crm');
  await page.waitForFunction(() => performance.getEntriesByName('ot-crm-list-usable').length > 0);
}

async function createContact(page: Page, name: string, email: string) {
  const result = await page.evaluate(
    async ({ name: displayName, email: contactEmail }) => {
      const sessionResponse = await fetch('/api/v1/auth/session', {
        headers: { accept: 'application/json' },
      });
      const session = await sessionResponse.json();
      const response = await fetch('/api/v1/crm/contacts', {
        method: 'POST',
        headers: {
          accept: 'application/json',
          'content-type': 'application/json',
          'x-csrf-token': session.csrf_token,
        },
        body: JSON.stringify({
          display_name: displayName,
          family_school_classification: 'family',
          email: contactEmail,
          phone: '',
          location: 'Jerusalem',
          timezone: 'Asia/Jerusalem',
          lead_status: 'new',
          internal_note: 'Synthetic OT-35 browser fixture.',
        }),
      });
      return response.json();
    },
    { name, email },
  );
  expect(result.success).toBe(true);
}

async function expectNoHorizontalOverflow(page: Page) {
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
  );
  expect(overflow).toBe(false);
}
