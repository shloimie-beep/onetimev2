import { expect, test, type Locator, type Page } from '@playwright/test';
import path from 'node:path';

const canonicalUrl = 'https://join.onetimeonetime.com/tisha-bav';
const previewUrl = process.env.TISHA_BAV_PREVIEW_URL;
const runLabel = previewUrl ? 'preview' : 'local';
const screenshotsDir = path.join(
  process.cwd(),
  'ops',
  'codex-runs',
  'TISHA-BAV-FUNNEL',
  'screenshots',
);

const viewports = [
  { name: 'mobile-360x800', width: 360, height: 800, mobile: true },
  { name: 'mobile-390x844', width: 390, height: 844, mobile: true },
  { name: 'mobile-430x932', width: 430, height: 932, mobile: true },
  { name: 'tablet-768x1024', width: 768, height: 1024, mobile: true },
  { name: 'desktop-1366x768', width: 1366, height: 768, mobile: false },
  { name: 'desktop-1440x900', width: 1440, height: 900, mobile: false },
] as const;

test.describe('Tisha BAv visual and registration funnel', () => {
  test.setTimeout(90_000);

  test('preserves complete responsive artwork with one modal-only CTA', async ({ page }) => {
    for (const viewport of viewports) {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await gotoTishaBav(page);

      const heading = page.getByRole('heading', {
        name: 'Filling the World with Knowledge of Hashem',
      });
      const hebrew = page.getByText('כי מלאה הארץ דעה את השם', { exact: true });
      const support = page.getByText("Special Tisha B'Av VIP Zoom Class with Rabbi Elly Scheller", {
        exact: true,
      });
      const date = page.getByText('Thursday, July 23, 2026', { exact: true });
      const time = page.getByText('3:00 PM Eastern / 10:00 PM Israel', { exact: true });
      const cta = page.locator('.event-primary-cta');
      const image = page.locator('[data-event-artwork-image]');

      await expect(heading).toBeVisible();
      await expect(hebrew).toBeVisible();
      await expect(support).toBeVisible();
      await expect(date).toBeVisible();
      await expect(time).toBeVisible();
      await expect(cta).toBeVisible();
      await expect(page.locator('.event-primary-cta:visible')).toHaveCount(1);
      await expect(page.locator('[data-event-modal]')).toBeHidden();
      await expect(page.locator('input:visible')).toHaveCount(0);
      await expect(page.locator('.event-hero')).not.toContainText('One Time Mishnayos');

      const imageState = await image.evaluate((node: HTMLImageElement) => ({
        currentSrc: node.currentSrc,
        naturalWidth: node.naturalWidth,
        naturalHeight: node.naturalHeight,
        objectFit: getComputedStyle(node).objectFit,
        objectPosition: getComputedStyle(node).objectPosition,
      }));
      const expectedAsset = viewport.mobile ? 'hero-mobile.png' : 'hero-desktop.png';
      const expectedNaturalSize = viewport.mobile
        ? { width: 1080, height: 1350 }
        : { width: 1366, height: 768 };
      expect(imageState.currentSrc).toContain(expectedAsset);
      expect(imageState.naturalWidth).toBe(expectedNaturalSize.width);
      expect(imageState.naturalHeight).toBe(expectedNaturalSize.height);
      expect(imageState.objectFit).toBe('contain');
      expect(imageState.objectPosition).toBe('50% 50%');

      const imageBox = await requiredBox(image);
      const expectedRatio = expectedNaturalSize.width / expectedNaturalSize.height;
      expect(imageBox.width / imageBox.height).toBeCloseTo(expectedRatio, 2);

      const textControls = [heading, hebrew, support, date, time, cta];
      if (viewport.mobile) {
        const faceRegion = page.getByTestId('mobile-artwork-safe-face-region');
        await expect(faceRegion).toBeVisible();
        const faceBox = await requiredBox(faceRegion);
        for (const locator of textControls) {
          expect(intersects(await requiredBox(locator), faceBox)).toBe(false);
        }
      } else {
        for (const locator of textControls) {
          expect(intersects(await requiredBox(locator), imageBox)).toBe(false);
        }
      }

      for (const locator of textControls) {
        const box = await requiredBox(locator);
        expect(box.x).toBeGreaterThanOrEqual(0);
        expect(box.x + box.width).toBeLessThanOrEqual(viewport.width + 1);
      }

      const typography = await page.evaluate(() => {
        const title = document.querySelector<HTMLElement>('#tisha-bav-title');
        const hebrewLine = document.querySelector<HTMLElement>('.event-hebrew');
        if (!title || !hebrewLine) throw new Error('missing event typography');
        const titleStyle = getComputedStyle(title);
        const lineHeight = Number.parseFloat(titleStyle.lineHeight);
        return {
          titleAlign: titleStyle.textAlign,
          titleLineCount: Math.round(title.getBoundingClientRect().height / lineHeight),
          hebrewAlign: getComputedStyle(hebrewLine).textAlign,
          hebrewDirection: getComputedStyle(hebrewLine).direction,
          horizontalOverflow:
            document.documentElement.scrollWidth > document.documentElement.clientWidth,
        };
      });
      expect(typography.titleAlign).toBe('center');
      expect(typography.titleLineCount).toBeLessThanOrEqual(3);
      expect(typography.hebrewAlign).toBe('center');
      expect(typography.hebrewDirection).toBe('rtl');
      expect(typography.horizontalOverflow).toBe(false);
      expect((await page.content()).toLowerCase()).not.toMatch(/zoom\.us|zoommtg|pwd=/);

      await page.screenshot({
        path: path.join(screenshotsDir, `${viewport.name}-initial-${runLabel}.png`),
        fullPage: true,
      });
    }
  });

  for (const viewport of viewports) {
    test(`opens, traps, closes, submits, and shares at ${viewport.name}`, async ({ page }) => {
      await page.addInitScript(() => {
        const testWindow = window as typeof window & {
          __copiedTishaBavUrl?: string;
          __sharedTishaBavUrl?: string;
        };
        Object.defineProperty(window.navigator, 'clipboard', {
          configurable: true,
          value: {
            writeText: async (value: string) => {
              testWindow.__copiedTishaBavUrl = value;
            },
          },
        });
        Object.defineProperty(window.navigator, 'share', {
          configurable: true,
          value: async (data: ShareData) => {
            testWindow.__sharedTishaBavUrl = String(data.url ?? '');
          },
        });
      });
      await page.route('**/api/v1/events/tisha-bav-2026/register', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            duplicate_submission: false,
            confirmation_queued: true,
          }),
        });
      });
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await gotoTishaBav(page);

      const cta = page.locator('.event-primary-cta');
      const modal = page.getByRole('dialog', { name: "Special Tisha B'Av VIP Zoom Class" });
      const email = page.getByRole('textbox', { name: 'Email' });

      await cta.click();
      await expect(modal).toBeVisible();
      await expect(email).toBeFocused();
      await expectModalInsideViewport(modal, viewport.width, viewport.height);
      await expect(page.locator('html')).toHaveAttribute('data-event-modal-open', 'true');
      await page.screenshot({
        path: path.join(screenshotsDir, `${viewport.name}-registration-modal-${runLabel}.png`),
        fullPage: false,
      });

      await page.getByRole('button', { name: 'Close registration' }).click();
      await expect(modal).toBeHidden();
      await expect(cta).toBeFocused();

      await cta.click();
      await page.keyboard.press('Escape');
      await expect(modal).toBeHidden();
      await expect(cta).toBeFocused();

      await cta.click();
      await email.fill(`browser-${viewport.width}-${Date.now()}@example.test`);
      await page.getByLabel('First name optional').fill('Miriam');
      await modal.getByRole('button', { name: 'Reserve My Spot' }).click();

      await expect(modal.getByRole('heading', { name: 'We got your request.' })).toBeVisible();
      await expect(
        modal.getByText(
          'Your spot has been reserved. We’ll send the Zoom link and event details to your email.',
          { exact: true },
        ),
      ).toBeVisible();
      await expect(modal.getByRole('textbox', { name: 'Email' })).toHaveCount(0);
      await expect(modal.getByRole('heading', { name: 'Invite a friend' })).toBeVisible();

      const whatsapp = modal.getByRole('link', { name: 'Share on WhatsApp' });
      const emailShare = modal.getByRole('link', { name: 'Email a Friend' });
      await expect(whatsapp).toHaveAttribute('href', /wa\.me\/\?text=/);
      await expect(whatsapp).toHaveAttribute('href', new RegExp(encodeURIComponent(canonicalUrl)));
      await expect(emailShare).toHaveAttribute('href', /^mailto:\?subject=/);
      await expect(emailShare).toHaveAttribute(
        'href',
        new RegExp(encodeURIComponent(canonicalUrl)),
      );

      await modal.getByRole('button', { name: 'Copy Link' }).click();
      await expect(modal.getByText('Link copied', { exact: true })).toBeVisible();
      expect(
        await page.evaluate(
          () => (window as typeof window & { __copiedTishaBavUrl?: string }).__copiedTishaBavUrl,
        ),
      ).toBe(canonicalUrl);

      const nativeShare = modal.getByRole('button', { name: 'Share', exact: true });
      await expect(nativeShare).toBeVisible();
      await nativeShare.click();
      expect(
        await page.evaluate(
          () => (window as typeof window & { __sharedTishaBavUrl?: string }).__sharedTishaBavUrl,
        ),
      ).toBe(canonicalUrl);

      await expectModalInsideViewport(modal, viewport.width, viewport.height);
      await page.screenshot({
        path: path.join(screenshotsDir, `${viewport.name}-success-share-${runLabel}.png`),
        fullPage: false,
      });
      expect((await page.content()).toLowerCase()).not.toMatch(/zoom\.us|zoommtg|pwd=/);

      await modal.getByRole('button', { name: 'Done' }).click();
      await expect(modal).toBeHidden();
      await expect(cta).toBeFocused();
    });
  }
});

async function gotoTishaBav(page: Page) {
  await page.goto(previewUrl ?? '/tisha-bav', { waitUntil: 'load' });
  await expect(page.locator('[data-event-artwork-image]')).toBeVisible();
}

async function requiredBox(locator: Locator) {
  const box = await locator.boundingBox();
  if (!box)
    throw new Error(`Missing bounding box for ${await locator.evaluate((node) => node.outerHTML)}`);
  return box;
}

function intersects(
  first: { x: number; y: number; width: number; height: number },
  second: { x: number; y: number; width: number; height: number },
) {
  return !(
    first.x + first.width <= second.x ||
    second.x + second.width <= first.x ||
    first.y + first.height <= second.y ||
    second.y + second.height <= first.y
  );
}

async function expectModalInsideViewport(modal: Locator, width: number, height: number) {
  const box = await requiredBox(modal);
  expect(box.x).toBeGreaterThanOrEqual(0);
  expect(box.y).toBeGreaterThanOrEqual(0);
  expect(box.x + box.width).toBeLessThanOrEqual(width + 1);
  expect(box.y + box.height).toBeLessThanOrEqual(height + 1);
}
