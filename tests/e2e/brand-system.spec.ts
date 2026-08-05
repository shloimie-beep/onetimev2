import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { expect, type Page, test } from '@playwright/test';

const evidenceRoot = path.resolve(
  process.env.OT82_EVIDENCE_ROOT ?? path.join(process.cwd(), 'ops/evidence/ot-82'),
);
const screenshotRoot = path.join(evidenceRoot, 'screenshots');
const viewports = [
  { id: '360x800', width: 360, height: 800 },
  { id: '390x844', width: 390, height: 844 },
  { id: '768x1024', width: 768, height: 1024 },
  { id: '1440x1000', width: 1440, height: 1000 },
] as const;

test('OT82 canonical public shell, ticker, and mobile invariant', async ({ page }) => {
  const requests = collectRequests(page);
  for (const viewport of viewports) {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await page.goto('/');
    await page.evaluate(() => document.fonts.ready.then(() => true));
    await expect(page.locator('[data-ot-shell="public-marketing"]')).toBeVisible();
    await expect(page.locator('[data-ot-primitive="Button"]').first()).toBeVisible();
    await expect(page.locator('.campaign-ticker')).toHaveCount(1);
    await expect(page.locator('.campaign-ticker')).toHaveAttribute('href', '/signup');
    await expect(page.locator('.campaign-ticker')).toHaveAttribute(
      'aria-label',
      'CLASSES START AUG 16 · 7 PM · FREE ACCESS THROUGH SEP 11 · 6 PM · JERUSALEM TIME',
    );
    await expect(
      page.getByLabel('Primary').getByRole('link', { name: 'Create your Family account' }),
    ).toBeVisible();
    await expect(page.locator('.brand-lockup img')).toBeVisible();
    await expect(page.locator('.site-header')).toBeVisible();
    await expectNoHorizontalOverflow(page);
    await screenshot(page, `landing/landing__default__${viewport.id}.png`, true);
    if (viewport.id === '360x800' || viewport.id === '390x844') {
      await screenshot(page, `landing/landing__top-fold__${viewport.id}.png`, false);
    }
  }

  for (const route of ['/signup', '/login', '/privacy', '/terms']) {
    await page.goto(route);
    await expect(page.locator('.campaign-ticker')).toHaveCount(0);
  }
  expectForbiddenRequests(requests);
});

test('OT82 public/auth screenshot matrix', async ({ page }) => {
  const requests = collectRequests(page);
  for (const viewport of viewports) {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    for (const [surface, route] of [
      ['signup', '/signup'],
      ['login', '/login'],
    ] as const) {
      await page.goto(route);
      await page.evaluate(() => document.fonts.ready.then(() => true));
      await expectNoHorizontalOverflow(page);
      await screenshot(page, `${surface}/${surface}__default__${viewport.id}.png`, true);
    }
  }
  expectForbiddenRequests(requests);
});

test('OT82 authenticated shell screenshot matrix', async ({ page }) => {
  const requests = collectRequests(page);
  for (const viewport of viewports) {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });

    await page.goto('/app/crm.html');
    await expect(page.locator('[data-ot-primitive="Header"]')).toBeVisible();
    await expect(page.locator('[data-ot-primitive="Logo"]')).toBeVisible();
    await expect(page.locator('[data-ot-primitive="Footer"]')).toBeVisible();
    await expect(page.locator('.campaign-ticker')).toHaveCount(0);
    await expectNoHorizontalOverflow(page);
    await screenshot(page, `crm/crm__default__${viewport.id}.png`, true);

    await page.goto('/app/parent.html');
    await expect(page.locator('#page-title')).toHaveText('Parent Portal');
    await expect(page.locator('[data-ot-primitive="Header"]')).toBeVisible();
    await expect(page.locator('.campaign-ticker')).toHaveCount(0);
    await expectNoHorizontalOverflow(page);
    await screenshot(page, `parent/parent__default__${viewport.id}.png`, true);

    await page.goto('/app/student.html');
    await expect(page.locator('#page-title')).toHaveText('Student Portal');
    await expect(page.locator('[data-ot-primitive="Header"]')).toBeVisible();
    await expect(page.locator('.campaign-ticker')).toHaveCount(0);
    await expectNoHorizontalOverflow(page);
    await screenshot(page, `student/student__default__${viewport.id}.png`, true);
  }
  expectForbiddenRequests(requests);
});

test('OT82 reduced motion keeps a readable static ticker', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await expect(page.locator('.campaign-ticker-track')).toHaveCSS('animation-name', 'none');
  await expect(page.locator('.campaign-ticker-item').first()).toBeVisible();
  await screenshot(page, 'landing/landing__reduced-motion__390x844.png', false);
});

async function screenshot(page: Page, relativePath: string, fullPage: boolean) {
  const filePath = path.join(screenshotRoot, relativePath);
  await mkdir(path.dirname(filePath), { recursive: true });
  await page.screenshot({ path: filePath, fullPage });
}

async function expectNoHorizontalOverflow(page: Page) {
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
  );
  expect(overflow).toBe(false);
}

function collectRequests(page: Page) {
  const requests: string[] = [];
  page.on('request', (request) => requests.push(request.url()));
  return requests;
}

function expectForbiddenRequests(requests: string[]) {
  const forbidden = requests.filter((url) =>
    /bna|operations|fonts\.googleapis|fonts\.gstatic|leadconnector|gohighlevel/i.test(url),
  );
  expect(forbidden).toEqual([]);
}

test.afterAll(async () => {
  await mkdir(evidenceRoot, { recursive: true });
  await writeFile(
    path.join(evidenceRoot, 'visual-index.md'),
    [
      '# OT-82 Visual Index',
      '',
      'Generated by `tests/e2e/brand-system.spec.ts`.',
      '',
      'Core default screenshots cover landing, signup, login, CRM, parent, and student at `360x800`, `390x844`, `768x1024`, and `1440x1000`.',
      'Additional captures cover landing top-fold mobile invariants and reduced-motion ticker behavior.',
      '',
    ].join('\n'),
    'utf8',
  );
});
