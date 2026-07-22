import { expect, type Locator, type Page, test } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const shareUrl = 'https://join.onetimeonetime.com/tisha-bav';
const eventTitle = 'Live Zoom class with Rabbi Eli Scheller for boys';
const eventPasuk = 'Ki Mala Haaretz Deas Hashem';
const eventDisclosure = 'By reserving, you’ll receive emails about this event.';
const successHebrew = 'שֶׁנִּזְכֶּה לִרְאוֹת אֶת יְרוּשָׁלַיִם בְּבִנְיָנָהּ';
const successDesktopBackground =
  '/assets/events/tisha-bav-2026/tisha-bav-success-bg-desktop-v20260722.png';
const successMobileBackground =
  '/assets/events/tisha-bav-2026/tisha-bav-success-bg-mobile-v20260722.png';
const screenshotDir = path.resolve(
  process.env.TISHA_BAV_SCREENSHOT_DIR ?? 'test-results/tisha-bav-funnel',
);

const mobileViewports = [
  { width: 375, height: 667 },
  { width: 390, height: 844 },
  { width: 430, height: 932 },
];

const desktopViewports = [
  { width: 1366, height: 768 },
  { width: 1440, height: 900 },
];

type Box = { x: number; y: number; width: number; height: number };
type ScrollMetric = {
  viewport: string;
  scrollHeight: number;
  innerHeight: number;
  scrollWidth: number;
  innerWidth: number;
};
type RegistrationPayload = Record<string, unknown>;

const scrollMetrics: ScrollMetric[] = [];

test.beforeAll(() => {
  mkdirSync(screenshotDir, { recursive: true });
});

test.afterAll(() => {
  writeFileSync(
    path.join(screenshotDir, 'scroll-results.json'),
    JSON.stringify(scrollMetrics, null, 2),
  );
});

test('Tisha BAv initial mobile landing fits one screen and opens full-page registration', async ({
  page,
}) => {
  const registrationRequests = await interceptRegistration(page);
  for (const [index, viewport] of mobileViewports.entries()) {
    const label = `${viewport.width}x${viewport.height}`;
    const email = `mobile-${viewport.width}-${viewport.height}-${Date.now()}@example.test`;
    await page.setViewportSize(viewport);
    await page.goto(`/tisha-bav?viewport=${label}`, { waitUntil: 'load' });
    await page.evaluate(() => document.fonts.ready);

    const metric = await scrollMetric(page, label);
    scrollMetrics.push(metric);
    expect(metric.scrollHeight, `${label} document height`).toBeLessThanOrEqual(
      metric.innerHeight + 2,
    );
    expect(metric.scrollWidth, `${label} document width`).toBeLessThanOrEqual(metric.innerWidth);

    const headline = page.getByRole('heading', {
      name: eventTitle,
    });
    const pasuk = page.getByText(eventPasuk, { exact: true });
    const image = page.locator('[data-event-hero-image]');
    const time = page.getByText('3 p.m. Eastern Time', { exact: true });
    const noCharge = page.getByText('No charge', { exact: true });
    const cta = page.getByRole('button', { name: 'Reserve My Spot' });

    await waitForHeroImage(page);
    await assertFullyVisible(page, headline, `${label} headline`);
    await assertFullyVisible(page, pasuk, `${label} pasuk line`);
    await assertFullyVisible(page, image, `${label} portrait art`);
    await assertFullyVisible(page, time, `${label} time`);
    await assertFullyVisible(page, noCharge, `${label} no charge`);
    await assertFullyVisible(page, cta, `${label} CTA`);
    await assertTitleOnTopOfArtwork(page, headline, pasuk, image, `${label} title overlay`);

    await expect(cta).toHaveCount(1);
    await expect(page.locator('form.event-form')).toBeHidden();
    await expect(page.locator('input[name="email"]')).toBeHidden();
    await expect(page.locator('input[type="checkbox"]')).toHaveCount(0);
    await expect(page.locator('body')).not.toContainText('Send me future One Time emails.');
    await expect(page.locator('body')).not.toContainText('We will use this email');
    await expect(page.locator('body')).not.toContainText(
      'Bringing Knowledge of Hashem into the World',
    );
    await expect(page.locator('body')).not.toContainText('10:00 PM Israel');
    await expect(page.locator('body')).not.toContainText("Special Tisha B'Av VIP Zoom Class");

    await assertHeroImage(page, {
      expectedName: 'tishea beav mobile(1).png',
      unexpectedName: 'tisha beav(1).png',
      naturalWidth: 1080,
      naturalHeight: 1350,
      label,
    });
    await assertSocialMetadata(page, label);
    await assertNoRawZoom(page);

    await page.screenshot({
      path: path.join(screenshotDir, `mobile-${label}-initial.png`),
      fullPage: false,
    });

    await cta.click();
    await assertFullPageModal(page, `${label} registration modal`);
    await expect(page.getByRole('dialog', { name: "Tisha B'Av registration" })).toBeVisible();
    await assertEventOnlyRegistrationForm(page, `${label} registration form`);
    await page.screenshot({
      path: path.join(screenshotDir, `mobile-${label}-modal.png`),
      fullPage: false,
    });

    await page.locator('input[name="email"]').fill(email);
    await page.locator('input[name="first_name"]').fill('Miriam');
    await page.locator('form.event-form button[type="submit"]').click();

    await assertSuccessShareState(page, `${label} success state`);
    await assertFullPageModal(page, `${label} success modal`, { successBackground: true });
    expect(registrationRequests, `${label} intercepted registration count`).toHaveLength(index + 1);
    assertRegistrationPayload(registrationRequests.at(-1), email, label);
    await page.screenshot({
      path: path.join(screenshotDir, `mobile-${label}-success.png`),
      fullPage: false,
    });
  }
});

test('Tisha BAv desktop uses landscape art and keeps the modal full-page', async ({ page }) => {
  const registrationRequests = await interceptRegistration(page);
  for (const [index, viewport] of desktopViewports.entries()) {
    const label = `${viewport.width}x${viewport.height}`;
    const email = `desktop-${viewport.width}-${viewport.height}-${Date.now()}@example.test`;
    await page.setViewportSize(viewport);
    await page.goto(`/tisha-bav?desktop=${label}`, { waitUntil: 'load' });
    await page.evaluate(() => document.fonts.ready);
    await waitForHeroImage(page);

    await expect(page.getByRole('heading', { name: eventTitle })).toBeVisible();
    await expect(page.getByText(eventPasuk, { exact: true })).toBeVisible();
    await expect(page.getByText('3 p.m. Eastern Time', { exact: true })).toBeVisible();
    await expect(page.getByText('No charge', { exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Reserve My Spot' })).toHaveCount(1);
    await expect(page.locator('form.event-form')).toBeHidden();
    await expect(page.locator('body')).not.toContainText(/student|payment|pricing|GHL iframe/i);
    await expect(page.locator('body')).not.toContainText(
      'Bringing Knowledge of Hashem into the World',
    );
    await expect(page.locator('body')).not.toContainText('10:00 PM Israel');

    await assertHeroImage(page, {
      expectedName: 'tisha beav(1).png',
      unexpectedName: 'tishea beav mobile(1).png',
      naturalWidth: 1366,
      naturalHeight: 768,
      label,
    });
    await assertTitleOnTopOfArtwork(
      page,
      page.getByRole('heading', { name: eventTitle }),
      page.getByText(eventPasuk, { exact: true }),
      page.locator('[data-event-hero-image]'),
      `${label} title overlay`,
    );
    await assertDesktopComposition(page, label);
    await assertSocialMetadata(page, label);
    await assertNoRawZoom(page);

    const metric = await scrollMetric(page, label);
    scrollMetrics.push(metric);
    expect(metric.scrollWidth, `${label} desktop width`).toBeLessThanOrEqual(metric.innerWidth);
    if (viewport.width >= 1366) {
      expect(metric.scrollHeight, `${label} desktop height`).toBeLessThanOrEqual(
        metric.innerHeight + 2,
      );
    }
    await page.screenshot({
      path: path.join(screenshotDir, `desktop-${label}-initial.png`),
      fullPage: false,
    });
    await page.getByRole('button', { name: 'Reserve My Spot' }).click();
    await assertFullPageModal(page, `${label} registration modal`);
    await assertEventOnlyRegistrationForm(page, `${label} registration form`);
    await page.screenshot({
      path: path.join(screenshotDir, `desktop-${label}-modal.png`),
      fullPage: false,
    });
    await page.locator('input[name="email"]').fill(email);
    await page.locator('input[name="first_name"]').fill('Miriam');
    await page.locator('form.event-form button[type="submit"]').click();
    await assertSuccessShareState(page, `${label} success state`);
    await assertFullPageModal(page, `${label} success modal`, { successBackground: true });
    expect(registrationRequests, `${label} intercepted registration count`).toHaveLength(index + 1);
    assertRegistrationPayload(registrationRequests.at(-1), email, label);
    await page.screenshot({
      path: path.join(screenshotDir, `desktop-${label}-success.png`),
      fullPage: false,
    });
  }
});

async function interceptRegistration(page: Page) {
  const requests: RegistrationPayload[] = [];
  await page.route('**/api/v1/events/tisha-bav-2026/register', async (route) => {
    requests.push(route.request().postDataJSON() as RegistrationPayload);
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ success: true }),
    });
  });
  return requests;
}

function assertRegistrationPayload(
  payload: RegistrationPayload | undefined,
  email: string,
  label: string,
) {
  expect(payload, `${label} registration payload`).toMatchObject({
    email,
    first_name: 'Miriam',
    source: 'tisha_bav_2026_landing',
    homepage: '',
  });
  expect(String(payload?.idempotency_key ?? ''), `${label} idempotency key`).toMatch(/^tisha-bav-/);
  expect(JSON.stringify(payload), `${label} provider mutation fields`).not.toMatch(
    /ghl|highlevel|provider|workflow|zoom/i,
  );
  expect(payload, `${label} newsletter field absent`).not.toHaveProperty('newsletter_opt_in');
  expect(JSON.stringify(payload), `${label} broad consent fields`).not.toMatch(
    /marketing|newsletter/i,
  );
}

async function assertEventOnlyRegistrationForm(page: Page, label: string) {
  const form = page.locator('.event-registration-content form.event-form');
  await expect(form.locator('input[name="email"]'), label).toBeVisible();
  await expect(form.locator('input[name="first_name"]'), label).toBeVisible();
  await expect(form.locator('input[type="checkbox"]'), label).toHaveCount(0);
  await expect(form.locator('input[type="checkbox"]:checked'), label).toHaveCount(0);
  await expect(form.locator('[role="switch"], [aria-checked]'), label).toHaveCount(0);
  await expect(form.locator('.button'), label).toHaveCount(1);
  await expect(form.getByText(eventDisclosure, { exact: true }), label).toBeVisible();
  await expect(page.locator('body'), label).not.toContainText('Send me future One Time emails.');
  await expect(page.locator('body'), label).not.toContainText('We will use this email');
  await expect(page.locator('body'), label).not.toContainText(
    /newsletter|marketing|future One Time/i,
  );
}

async function scrollMetric(page: Page, viewport: string): Promise<ScrollMetric> {
  return page.evaluate((viewportName) => {
    const root = document.documentElement;
    return {
      viewport: viewportName,
      scrollHeight: root.scrollHeight,
      innerHeight: window.innerHeight,
      scrollWidth: root.scrollWidth,
      innerWidth: window.innerWidth,
    };
  }, viewport);
}

async function assertFullyVisible(page: Page, locator: Locator, label: string) {
  await expect(locator, label).toBeVisible();
  const box = await locator.boundingBox();
  expect(box, `${label} bounding box`).not.toBeNull();
  const viewport = page.viewportSize();
  expect(viewport, `${label} viewport`).not.toBeNull();
  if (!box || !viewport) return;
  expect(box.x, `${label} left`).toBeGreaterThanOrEqual(-1);
  expect(box.y, `${label} top`).toBeGreaterThanOrEqual(-1);
  expect(box.x + box.width, `${label} right`).toBeLessThanOrEqual(viewport.width + 1);
  expect(box.y + box.height, `${label} bottom`).toBeLessThanOrEqual(viewport.height + 1);
}

async function assertHeroImage(
  page: Page,
  input: {
    expectedName: string;
    unexpectedName: string;
    naturalWidth: number;
    naturalHeight: number;
    label: string;
  },
) {
  const image = page.locator('[data-event-hero-image]');
  const details = await image.evaluate((node: HTMLImageElement) => {
    const rect = node.getBoundingClientRect();
    return {
      currentSrc: node.currentSrc,
      naturalWidth: node.naturalWidth,
      naturalHeight: node.naturalHeight,
      renderedWidth: rect.width,
      renderedHeight: rect.height,
    };
  });
  const sourcePath = decodeURIComponent(new URL(details.currentSrc).pathname);
  expect(sourcePath, `${input.label} selected hero asset`).toContain(input.expectedName);
  expect(sourcePath, `${input.label} rejected hero asset`).not.toContain(input.unexpectedName);
  const response = await page.request.get(details.currentSrc, {
    headers: { 'cache-control': 'no-cache', pragma: 'no-cache' },
  });
  expect(response.status(), `${input.label} hero asset HTTP status`).toBe(200);
  expect(details.naturalWidth, `${input.label} natural width is nonzero`).toBeGreaterThan(0);
  expect(details.naturalHeight, `${input.label} natural height is nonzero`).toBeGreaterThan(0);
  expect(details.naturalWidth, `${input.label} natural width`).toBe(input.naturalWidth);
  expect(details.naturalHeight, `${input.label} natural height`).toBe(input.naturalHeight);
  const naturalRatio = input.naturalWidth / input.naturalHeight;
  const renderedRatio = details.renderedWidth / details.renderedHeight;
  expect(Math.abs(renderedRatio - naturalRatio), `${input.label} rendered aspect`).toBeLessThan(
    0.03,
  );
}

async function assertSocialMetadata(page: Page, label: string) {
  const expectedPath = '/assets/events/tisha-bav-2026/tisha-bav-social-card-v20260722.png';
  const ogImage = await page
    .locator('meta[property="og:image"]')
    .getAttribute('content', { timeout: 5_000 });
  const secureImage = await page
    .locator('meta[property="og:image:secure_url"]')
    .getAttribute('content', { timeout: 5_000 });
  const twitterImage = await page
    .locator('meta[name="twitter:image"]')
    .getAttribute('content', { timeout: 5_000 });
  const favicon = await page.locator('link[rel="icon"]').getAttribute('href', { timeout: 5_000 });
  const appleTouchIcon = await page
    .locator('link[rel="apple-touch-icon"]')
    .getAttribute('href', { timeout: 5_000 });

  const ogImageUrl = new URL(ogImage ?? '');
  expect(ogImageUrl.protocol, `${label} og:image secure protocol`).toBe('https:');
  expect(ogImageUrl.pathname, `${label} og:image path`).toBe(expectedPath);
  expect(secureImage, `${label} og:image secure URL`).toBe(ogImage);
  expect(twitterImage, `${label} twitter image`).toBe(ogImage);
  expect(favicon, `${label} favicon`).toBe(
    '/assets/events/tisha-bav-2026/tisha-bav-favicon-v20260722.png',
  );
  expect(appleTouchIcon, `${label} apple touch icon`).toBe(
    '/assets/events/tisha-bav-2026/tisha-bav-apple-touch-icon-v20260722.png',
  );
  expect(favicon, `${label} favicon distinct from share image`).not.toBe(ogImage);

  await expect(
    page.locator('meta[property="og:image:type"]'),
    `${label} og image type`,
  ).toHaveAttribute('content', 'image/png');
  await expect(
    page.locator('meta[property="og:image:width"]'),
    `${label} og image width`,
  ).toHaveAttribute('content', '1200');
  await expect(
    page.locator('meta[property="og:image:height"]'),
    `${label} og image height`,
  ).toHaveAttribute('content', '630');
  await expect(
    page.locator('meta[property="og:image:alt"]'),
    `${label} og image alt`,
  ).toHaveAttribute('content', "One Time logo for the Tisha B'Av live Zoom class");

  const response = await page.request.get(ogImageUrl.pathname, {
    headers: { 'cache-control': 'no-cache', pragma: 'no-cache' },
  });
  expect(response.status(), `${label} social image HTTP status`).toBe(200);
  expect(response.headers()['content-type'], `${label} social image MIME`).toContain('image/png');
}

async function waitForHeroImage(page: Page) {
  const image = page.locator('[data-event-hero-image]');
  await expect(image).toBeVisible();
  await image.evaluate(async (node: HTMLImageElement) => {
    if (!node.complete || node.naturalWidth === 0) {
      await new Promise<void>((resolve, reject) => {
        node.addEventListener('load', () => resolve(), { once: true });
        node.addEventListener('error', () => reject(new Error('Hero image failed to load')), {
          once: true,
        });
      });
    }
    await node.decode().catch(() => undefined);
  });
}

async function assertTitleOnTopOfArtwork(
  page: Page,
  headline: Locator,
  pasuk: Locator,
  image: Locator,
  label: string,
) {
  const headlineBox = await headline.boundingBox();
  const pasukBox = await pasuk.boundingBox();
  const imageBox = await image.boundingBox();
  expect(headlineBox, `${label} headline box`).not.toBeNull();
  expect(pasukBox, `${label} pasuk box`).not.toBeNull();
  expect(imageBox, `${label} image box`).not.toBeNull();
  if (!headlineBox || !pasukBox || !imageBox) return;
  expect(pasukBox.y + pasukBox.height, `${label} pasuk above artwork`).toBeLessThanOrEqual(
    imageBox.y + 1,
  );
  expect(headlineBox.y, `${label} headline inside image top`).toBeGreaterThanOrEqual(
    imageBox.y - 1,
  );
  const upperBand = imageBox.y + imageBox.height * 0.32;
  expect(headlineBox.y + headlineBox.height, `${label} headline upper image band`).toBeLessThan(
    upperBand,
  );
}

async function assertDesktopComposition(page: Page, label: string) {
  const viewport = page.viewportSize();
  expect(viewport, `${label} viewport`).not.toBeNull();
  const detailsBox = await page.locator('.tisha-details').boundingBox();
  const imageBox = await page.locator('[data-event-hero-image]').boundingBox();
  expect(detailsBox, `${label} details box`).not.toBeNull();
  expect(imageBox, `${label} image box`).not.toBeNull();
  if (!viewport || !detailsBox || !imageBox) return;

  expect(detailsBox.x + detailsBox.width, `${label} details left of artwork`).toBeLessThan(
    imageBox.x,
  );
  expect(imageBox.width, `${label} desktop artwork width`).toBeGreaterThanOrEqual(950);
  expect(imageBox.width, `${label} desktop artwork width`).toBeLessThanOrEqual(1100);

  const leftEdge = Math.min(detailsBox.x, imageBox.x);
  const rightEdge = Math.max(detailsBox.x + detailsBox.width, imageBox.x + imageBox.width);
  const leftGutter = leftEdge;
  const rightGutter = viewport.width - rightEdge;
  expect(
    Math.abs(leftGutter - rightGutter),
    `${label} centered desktop composition gutters`,
  ).toBeLessThanOrEqual(36);
}

async function assertFullPageModal(
  page: Page,
  label: string,
  options: { successBackground?: boolean } = {},
) {
  const modal = page.locator('[data-event-modal]');
  const shell = page.locator('.tisha-bav-page .event-register-shell');
  await expect(modal, label).toBeVisible();
  const metrics = await modal.evaluate((node) => ({
    scrollHeight: node.scrollHeight,
    clientHeight: node.clientHeight,
    scrollWidth: node.scrollWidth,
    clientWidth: node.clientWidth,
    rect: node.getBoundingClientRect().toJSON() as Box,
  }));
  expect(metrics.scrollHeight, `${label} modal vertical overflow`).toBeLessThanOrEqual(
    metrics.clientHeight + 2,
  );
  expect(metrics.scrollWidth, `${label} modal horizontal overflow`).toBeLessThanOrEqual(
    metrics.clientWidth + 2,
  );
  const shellMetrics = await shell.evaluate((node) => ({
    scrollHeight: node.scrollHeight,
    clientHeight: node.clientHeight,
    scrollWidth: node.scrollWidth,
    clientWidth: node.clientWidth,
  }));
  expect(shellMetrics.scrollHeight, `${label} shell vertical overflow`).toBeLessThanOrEqual(
    shellMetrics.clientHeight + 2,
  );
  expect(shellMetrics.scrollWidth, `${label} shell horizontal overflow`).toBeLessThanOrEqual(
    shellMetrics.clientWidth + 2,
  );
  const backgroundImage = await shell.evaluate((node) => getComputedStyle(node).backgroundImage);
  if (options.successBackground) {
    const viewport = page.viewportSize();
    const expectedPath =
      viewport && viewport.width <= 820 ? successMobileBackground : successDesktopBackground;
    expect(backgroundImage, `${label} success background image`).toContain(expectedPath);
    const response = await page.request.get(expectedPath, {
      headers: { 'cache-control': 'no-cache', pragma: 'no-cache' },
    });
    expect(response.status(), `${label} success background HTTP status`).toBe(200);
    const dimensions = await page.evaluate(async (src) => {
      const image = new Image();
      image.src = src;
      await image.decode();
      return { naturalWidth: image.naturalWidth, naturalHeight: image.naturalHeight };
    }, expectedPath);
    expect(dimensions.naturalWidth, `${label} success background natural width`).toBeGreaterThan(0);
    expect(dimensions.naturalHeight, `${label} success background natural height`).toBeGreaterThan(
      0,
    );
  } else {
    expect(backgroundImage, `${label} form shell artwork background`).toBe('none');
  }
}

async function assertSuccessShareState(page: Page, label: string) {
  const dialog = page.getByRole('dialog', { name: "Tisha B'Av registration" });
  const successPanel = page.locator('[data-event-success-panel]');
  await expect(successPanel.getByText('Registration complete')).toBeVisible({ timeout: 15_000 });
  await expect(successPanel.locator('h2[lang="he"]')).toHaveText(successHebrew);
  await expect(successPanel.getByText('May we merit to see Jerusalem rebuilt.')).toBeVisible();
  await expect(
    successPanel.getByText("We'll email the private Zoom link and event details."),
  ).toBeVisible();
  const whatsApp = dialog.getByRole('link', { name: 'WhatsApp share' });
  const email = dialog.getByRole('link', { name: 'Email a Friend' });
  await expect(whatsApp, label).toBeVisible();
  await expect(email, label).toBeVisible();
  expect(decodeURIComponent((await whatsApp.getAttribute('href')) ?? ''), label).toContain(
    shareUrl,
  );
  expect(decodeURIComponent((await email.getAttribute('href')) ?? ''), label).toContain(shareUrl);
  await expect(dialog.getByRole('button', { name: 'Copy Link' }), label).toBeVisible();
  const nativeShareSupported = await page.evaluate(() => typeof navigator.share === 'function');
  const nativeShare = dialog.getByRole('button', { name: 'Share' });
  if (nativeShareSupported) {
    await expect(nativeShare, label).toBeVisible();
  } else {
    await expect(nativeShare, label).toBeHidden();
  }
}

async function assertNoRawZoom(page: Page) {
  expect(await page.content()).not.toMatch(/https?:\/\/[^\s"']*zoom\.us\/j\//i);
}
