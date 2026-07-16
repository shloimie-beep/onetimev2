import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { expect, type Page, test } from '@playwright/test';
import { renderVisualFixtureGallery } from '../../packages/brand-system/src/fixture-gallery.ts';
import {
  componentContracts,
  preUsableScreenshotBan,
  visualViewports,
} from '../../packages/brand-system/src/visual-contract.ts';

const runRoot = path.resolve(process.cwd(), 'ops/codex-runs/OT-112');
const evidenceRoot = path.join(runRoot, 'evidence');
const screenshotRoot = path.resolve(process.cwd(), 'ops/evidence/ot-112/screenshots');
const fixturePath = path.join(evidenceRoot, 'visual-fixture-gallery.html');

test.beforeAll(async () => {
  await mkdir(evidenceRoot, { recursive: true });
  await writeFile(
    fixturePath,
    renderVisualFixtureGallery({ css: await fixtureCss(), assetBase: assetBase() }),
    'utf8',
  );
});

test('OT-112 fixture gallery covers every component contract at required viewports', async ({
  page,
}) => {
  for (const viewport of visualViewports) {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await openFixture(page);
    await expect(page.locator('[data-ot-visual-gallery="OT-112"]')).toHaveAttribute(
      'data-ot-usable',
      'true',
    );
    for (const contract of componentContracts) {
      await expect(page.locator(contract.fixtureSelector).first()).toBeVisible();
    }
    await expectNoHorizontalOverflow(page);
    await expectTouchTargets(page);
    await expectNoFadedNormalText(page);
    await expectNoPreUsableCopy(page);
    await screenshot(page, `fixture-default-${viewport.id}.png`, true);
  }
});

test('OT-112 visual matrix modes are deliberate and captureable', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await openFixture(page);
  await expectNoHorizontalOverflow(page);
  await screenshot(page, 'fixture-reduced-motion-390x844.png', false);

  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.evaluate(() => {
    document.documentElement.dir = 'rtl';
  });
  await expectNoHorizontalOverflow(page);
  await screenshot(page, 'fixture-rtl-390x844.png', false);

  await page.evaluate(() => {
    document.documentElement.dir = 'ltr';
  });
  await page.setViewportSize({ width: 720, height: 500 });
  await expectNoHorizontalOverflow(page);
  await screenshot(page, 'fixture-zoom-200-effective.png', false);

  await page.setViewportSize({ width: 390, height: 844 });
  await page.keyboard.press('Tab');
  const focus = await page.locator(':focus-visible').evaluate((element) => {
    const style = getComputedStyle(element);
    return {
      outlineWidth: style.outlineWidth,
      outlineStyle: style.outlineStyle,
    };
  });
  expect(focus.outlineStyle).not.toBe('none');
  expect(Number.parseFloat(focus.outlineWidth)).toBeGreaterThanOrEqual(3);
  await screenshot(page, 'fixture-keyboard-focus-390x844.png', false);

  const longContent = page.locator('.ot-long-content');
  await expect(longContent).toBeVisible();
  const longContentMetrics = await longContent.evaluate((element) => ({
    clientHeight: element.clientHeight,
    scrollHeight: element.scrollHeight,
  }));
  expect(longContentMetrics.scrollHeight).toBeGreaterThan(longContentMetrics.clientHeight);
  await screenshot(page, 'fixture-long-content-390x844.png', true);

  await expect(page.locator('[data-visual-state="loading"]')).toBeVisible();
  await expect(page.locator('[data-visual-state="error"]')).toBeVisible();
  await screenshot(page, 'fixture-slow-error-states-390x844.png', false);
});

async function openFixture(page: Page) {
  await page.goto(pathToFileURL(fixturePath).href);
  await page.waitForFunction(() => window.__OT112_VISUAL_FIXTURE_READY__ === true);
}

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

async function expectTouchTargets(page: Page) {
  const tinyTargets = await page.evaluate(() =>
    [
      ...document.querySelectorAll<HTMLElement>(
        'button, a[href], input, select, textarea, [role="button"]',
      ),
    ]
      .filter((element) => {
        const rect = element.getBoundingClientRect();
        const style = getComputedStyle(element);
        return rect.width > 0 && rect.height > 0 && style.visibility !== 'hidden';
      })
      .map((element) => {
        const rect = element.getBoundingClientRect();
        return {
          text: element.textContent?.trim() ?? element.getAttribute('aria-label') ?? '',
          width: rect.width,
          height: rect.height,
        };
      })
      .filter((target) => target.width < 44 || target.height < 44),
  );
  expect(tinyTargets).toEqual([]);
}

async function expectNoFadedNormalText(page: Page) {
  const faded = await page.evaluate(() =>
    [
      ...document.querySelectorAll<HTMLElement>(
        'p, span, strong, small, a[href], button, label, h1, h2, h3',
      ),
    ]
      .filter((element) => {
        const rect = element.getBoundingClientRect();
        const style = getComputedStyle(element);
        return (
          rect.width > 0 &&
          rect.height > 0 &&
          style.visibility !== 'hidden' &&
          Number.parseFloat(style.opacity) < 0.72 &&
          !element.matches(':disabled')
        );
      })
      .map((element) => element.textContent?.trim() ?? element.className),
  );
  expect(faded).toEqual([]);
}

async function expectNoPreUsableCopy(page: Page) {
  const bodyText = await page.locator('body').innerText();
  for (const banned of preUsableScreenshotBan) {
    expect(bodyText).not.toContain(banned);
  }
}

async function fixtureCss() {
  const cssFiles = [
    'packages/brand-system/src/tokens.css',
    'packages/brand-system/src/styles/portal.css',
    'packages/brand-system/src/styles/react.css',
  ];
  const css = await Promise.all(
    cssFiles.map(async (relativePath) =>
      (await readFile(path.resolve(process.cwd(), relativePath), 'utf8'))
        .split('\n')
        .filter((line) => !line.trimStart().startsWith('@import'))
        .join('\n'),
    ),
  );
  return css.join('\n');
}

function assetBase() {
  return pathToFileURL(path.resolve(process.cwd(), 'apps/web/public')).href.replace(/\/$/, '');
}

declare global {
  interface Window {
    __OT112_VISUAL_FIXTURE_READY__?: boolean;
  }
}
