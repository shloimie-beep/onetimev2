import { mkdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { expect, test, type Page } from '@playwright/test';

const screenshotDir = path.resolve(process.cwd(), 'ops/evidence/ot-39/screenshots');

test('static and runtime checks keep free-text search in POST bodies', async ({ page }) => {
  const [entrySource, adapterSource] = await Promise.all([
    readFile(path.resolve(process.cwd(), 'apps/web/src/client/app/crm-entry.tsx'), 'utf8'),
    readFile(path.resolve(process.cwd(), 'apps/web/src/client/app/crm-api.ts'), 'utf8'),
  ]);
  expect(entrySource).not.toMatch(/params\.set\(['"]search['"]/);
  expect(adapterSource).not.toMatch(/params\.set\(['"]search['"]/);
  expect(adapterSource).toContain("status: 'post_body'");
  expect(adapterSource).toContain("endpoint: '/api/v1/crm/contacts/search'");
  expect(entrySource).toContain("markUsableAfterPaint('ot-crm-list-usable', isListUsable)");
  expect(entrySource).toContain("markUsableAfterPaint('ot-crm-detail-usable'");

  const requested: string[] = [];
  page.on('request', (request) => requested.push(request.url()));
  await login(page);

  const email = `ot39-private-post-${Date.now()}@example.test`;
  await createContact(page, 'OT39 Private Post Parent', email);
  await expect(page.getByLabel('Search')).toBeEnabled();
  await page.getByLabel('Search').fill(email);
  await page.getByLabel('Type').selectOption('family');
  await page.getByRole('button', { name: 'Apply' }).click();
  await waitForUsableList(page);
  await expect(page.getByRole('button', { name: /OT39 Private Post Parent/ })).toBeVisible();

  const contactListRequests = requested
    .map((url) => new URL(url))
    .filter((url) => url.pathname === '/api/v1/crm/contacts');
  const contactSearchRequests = requested
    .map((url) => new URL(url))
    .filter((url) => url.pathname === '/api/v1/crm/contacts/search');
  expect(contactListRequests.some((url) => url.searchParams.has('search'))).toBe(false);
  expect(contactSearchRequests.length).toBeGreaterThan(0);
  expect(requested.some((url) => url.includes(email))).toBe(false);
});

test('synthetic search text appears nowhere prohibited in the browser', async ({ page }) => {
  const requested: string[] = [];
  const consoleMessages: string[] = [];
  page.on('request', (request) => requested.push(request.url()));
  page.on('console', (message) => consoleMessages.push(message.text()));
  await page.setViewportSize({ width: 390, height: 844 });
  await login(page);

  const syntheticSearch = `ot39-private-search-${Date.now()}@example.test`;
  await expect(page.getByLabel('Search')).toBeEnabled();
  await page.getByLabel('Search').fill(syntheticSearch);
  await page.getByLabel('Type').selectOption('family');
  await page.getByRole('button', { name: 'Apply' }).click();
  await waitForUsableList(page);

  const browserLeakState = await page.evaluate((needle) => {
    const storage = {
      local: JSON.stringify({ ...localStorage }),
      session: JSON.stringify({ ...sessionStorage }),
    };
    const resources = performance
      .getEntriesByType('resource')
      .map((entry) => entry.name)
      .join('\n');
    return {
      href: location.href,
      historyState: JSON.stringify(history.state ?? {}),
      storage,
      resources,
      containsNeedle:
        location.href.includes(needle) ||
        JSON.stringify(history.state ?? {}).includes(needle) ||
        storage.local.includes(needle) ||
        storage.session.includes(needle) ||
        resources.includes(needle),
    };
  }, syntheticSearch);

  expect(browserLeakState.containsNeedle).toBe(false);
  expect(requested.some((url) => url.includes(syntheticSearch))).toBe(false);
  expect(consoleMessages.some((message) => message.includes(syntheticSearch))).toBe(false);
});

test('authenticated shell keeps one CRM destination, no BNA/Operations requests, and mobile controls', async ({
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

  await page.setViewportSize({ width: 360, height: 800 });
  await expect(page.getByLabel('Search')).toBeVisible();
  await expect(page.getByLabel('Search')).toBeEnabled();
  await expect(page.getByLabel('Type')).toBeVisible();
  await expect(page.getByLabel('Status')).toBeVisible();
  await expectNoHorizontalOverflow(page);
  await expectTouchTargets(page);
});

test('mobile drawer traps focus, closes by every shell action, and restores focus', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await login(page);
  const menu = page.getByRole('button', { name: 'Open navigation' });

  await menu.click();
  const drawer = page.getByRole('dialog', { name: 'One Time navigation' });
  const drawerClose = drawer.getByRole('button', { name: 'Close navigation' });
  await expect(drawer).toBeVisible();
  await expect(drawerClose).toBeFocused();
  const drawerLinks = drawer.getByRole('link');
  const drawerLinkCount = await drawerLinks.count();
  expect(drawerLinkCount).toBeGreaterThan(0);
  for (let index = 0; index < drawerLinkCount; index += 1) {
    await page.keyboard.press('Tab');
    await expect(drawerLinks.nth(index)).toBeFocused();
  }
  await page.keyboard.press('Tab');
  await expect(drawerClose).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(drawer).toBeHidden();
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

test('rows open by keyboard and Back restores focus from cached list without refetch', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await login(page);
  const email = `ot39-keyboard-${Date.now()}@example.test`;
  await createContact(page, 'OT39 Keyboard Parent', email);
  await reloadList(page);

  const row = page.getByRole('button', { name: /OT39 Keyboard Parent/ });
  await expect(row).toBeVisible();
  await row.focus();
  await page.keyboard.press('Enter');
  await waitForUsableDetail(page);
  await expect(page.getByRole('heading', { name: 'OT39 Keyboard Parent' })).toBeVisible();
  await expect(page.getByText(email)).toBeVisible();

  const requestPaths: string[] = [];
  page.on('request', (request) => requestPaths.push(new URL(request.url()).pathname));
  await page.evaluate(() => performance.clearMarks('ot-crm-list-usable'));
  await page.getByRole('button', { name: 'Back to CRM' }).click();
  await waitForUsableList(page);
  await expect(page.getByRole('button', { name: /OT39 Keyboard Parent/ })).toBeFocused();
  expect(
    requestPaths.filter((requestPath) => requestPath === '/api/v1/crm/contacts/search'),
  ).toEqual([]);
  expect(await page.evaluate(() => Object.keys(localStorage))).toEqual([]);
  expect(await page.evaluate(() => Object.keys(sessionStorage))).toEqual([]);
  expect(page.url()).not.toContain(email);
});

test('403 clears retained protected CRM details before recovery UI renders', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await login(page);
  const email = `ot39-expired-${Date.now()}@example.test`;
  await createContact(page, 'OT39 Expired Parent', email);
  await reloadList(page);
  await page.getByRole('button', { name: /OT39 Expired Parent/ }).click();
  await waitForUsableDetail(page);
  const contactPath = new URL(page.url()).pathname;

  await page.route('**/api/v1/crm/contacts/*', async (route) => {
    await route.fulfill({
      status: 403,
      contentType: 'application/json',
      body: JSON.stringify({ success: false, message: 'Forbidden test response.' }),
    });
  });
  await page.goto(contactPath);
  await expect(page.getByRole('heading', { name: 'Session expired' })).toBeVisible();
  await expect(page.getByText('OT39 Expired Parent')).toHaveCount(0);
  await expect(page.getByText(email)).toHaveCount(0);
  await expect(
    page.getByLabel('Session expired').getByRole('button', { name: 'Sign in' }),
  ).toBeVisible();
});

test('captures corrected CRM screenshots at OT-39 viewport matrix', async ({ page }) => {
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
    const email = `ot39-shot-${viewport.name}-${Date.now()}@example.test`;
    await createContact(page, `OT39 Shot ${viewport.name}`, email);
    await reloadList(page);
    await expect(
      page.getByRole('button', { name: new RegExp(`OT39 Shot ${viewport.name}`) }),
    ).toBeVisible();
    await expect(page.getByLabel('Search')).toBeEnabled();
    await expectNoHorizontalOverflow(page);
    await expectContactNamesReadable(page);
    await page.screenshot({
      path: path.join(screenshotDir, `crm-list-${viewport.name}.png`),
      fullPage: true,
    });

    await page.getByRole('button', { name: new RegExp(`OT39 Shot ${viewport.name}`) }).click();
    await waitForUsableDetail(page);
    await expect(page.getByRole('heading', { name: `OT39 Shot ${viewport.name}` })).toBeVisible();
    await expectNoHorizontalOverflow(page);
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
  await waitForUsableList(page);
}

async function createContact(page: Page, name: string, email: string) {
  const result = await page.evaluate(
    async ({ name: displayName, email: contactEmail }) => {
      const sessionResponse = await fetch('/api/v1/auth/session', {
        cache: 'no-store',
        headers: { accept: 'application/json', 'cache-control': 'no-store' },
      });
      const session = await sessionResponse.json();
      const response = await fetch('/api/v1/crm/contacts', {
        method: 'POST',
        cache: 'no-store',
        headers: {
          accept: 'application/json',
          'cache-control': 'no-store',
          'content-type': 'application/json',
          'x-csrf-token': session.csrf_token,
        },
        body: JSON.stringify({
          idempotency_key: `test-${crypto.randomUUID()}`,
          display_name: displayName,
          family_school_classification: 'family',
          email: contactEmail,
          phone: '',
          location: 'Jerusalem',
          timezone: 'Asia/Jerusalem',
          lead_status: 'new',
          internal_note: 'Synthetic OT-39 browser fixture.',
        }),
      });
      return response.json();
    },
    { name, email },
  );
  expect(result.success).toBe(true);
}

async function reloadList(page: Page) {
  await page.evaluate(() => performance.clearMarks('ot-crm-list-usable'));
  await page.getByRole('button', { name: 'Apply' }).click();
  await waitForUsableList(page);
}

async function waitForUsableList(page: Page) {
  await page.waitForFunction(() => performance.getEntriesByName('ot-crm-list-usable').length > 0);
}

async function waitForUsableDetail(page: Page) {
  await page.waitForFunction(() => performance.getEntriesByName('ot-crm-detail-usable').length > 0);
}

async function expectNoHorizontalOverflow(page: Page) {
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
  );
  expect(overflow).toBe(false);
}

async function expectTouchTargets(page: Page) {
  const undersizedTargets = await page.evaluate(() =>
    [
      ...document.querySelectorAll<HTMLElement>(
        'button, a[href], input:not([disabled]), select, textarea, [role="button"]',
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
}

async function expectContactNamesReadable(page: Page) {
  const fadedNames = await page.evaluate(() =>
    [...document.querySelectorAll<HTMLElement>('.contact-card strong, .contact-table strong')]
      .filter((element) => {
        const color = getComputedStyle(element).color;
        return color === 'rgb(200, 214, 217)' || color === 'rgb(165, 174, 169)';
      })
      .map((element) => element.textContent?.trim()),
  );
  expect(fadedNames).toEqual([]);
}
