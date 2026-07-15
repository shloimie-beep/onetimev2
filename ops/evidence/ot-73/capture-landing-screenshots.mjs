import { spawn } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { chromium, expect } from '@playwright/test';

const port = '3103';
const baseUrl = `http://127.0.0.1:${port}`;
const outputDir = path.resolve('ops/evidence/ot-73/screenshots');
const reportPath = path.resolve('ops/evidence/ot-73/SCREENSHOTS.md');
const viewports = [
  { name: 'landing-360x800.png', width: 360, height: 800 },
  { name: 'landing-390x844.png', width: 390, height: 844 },
  { name: 'landing-768x1024.png', width: 768, height: 1024 },
  { name: 'landing-1440x900.png', width: 1440, height: 900 },
];

async function waitForServer() {
  const deadline = Date.now() + 30_000;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(`${baseUrl}/health`);
      if (response.ok) return;
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 250));
    }
  }
  throw new Error('Timed out waiting for local test server.');
}

function startServer() {
  return spawn(process.execPath, ['--import', 'tsx', 'tests/support/test-server.ts'], {
    env: {
      ...process.env,
      NODE_ENV: 'test',
      OT_TEST_DATABASE: 'memory',
      RUN_MIGRATIONS_ON_STARTUP: 'true',
      PORT: port,
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
}

async function decodeImages(page) {
  await page.evaluate(async () => {
    const step = Math.max(240, Math.floor(window.innerHeight * 0.7));
    for (let y = 0; y <= document.documentElement.scrollHeight; y += step) {
      window.scrollTo(0, y);
      await new Promise((resolve) => setTimeout(resolve, 80));
    }
    window.scrollTo(0, 0);
    await new Promise((resolve) => setTimeout(resolve, 120));
  });
  await page.evaluate(async () => {
    const images = Array.from(document.images);
    await Promise.all(
      images.map(async (image) => {
        image.loading = 'eager';
        if (!image.complete) {
          await new Promise((resolve) => {
            image.addEventListener('load', resolve, { once: true });
            image.addEventListener('error', resolve, { once: true });
          });
        }
        if (image.complete && image.naturalWidth > 0 && 'decode' in image) {
          await image.decode().catch(() => undefined);
        }
      }),
    );
  });
}

async function assertLanding(page, viewport) {
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForFunction(() => window.scrollY === 0);
  await page.waitForTimeout(150);

  const ticker = page.locator('.campaign-ticker');
  await expect(ticker).toBeVisible();
  await expect(ticker).toHaveAttribute('data-campaign-deadline', '2026-09-11');
  await expect(ticker).toHaveAttribute(
    'aria-label',
    /JOIN NOW — FREE UNTIL ROSH HASHANAH — \d+ DAYS? TO ROSH HASHANAH/,
  );
  await expect(ticker.locator('.campaign-ticker-item')).toHaveCount(6);
  await expect(page.locator('.campaign-ticker-track')).not.toHaveCSS('animation-name', 'none');
  await expect(page.locator('.yellow-text')).toHaveCount(0);
  await expect(page.getByText(/ROSH HASHANAH SPECIAL|\$67|month afterward|No card today|trial/i)).toHaveCount(
    0,
  );
  await expect(page.locator('.hero').getByText(/FREE UNTIL ROSH HASHANAH/i)).toHaveCount(0);

  const heroGap = await page.evaluate(() => {
    const header = document.querySelector('.site-header')?.getBoundingClientRect();
    const hero = document.querySelector('.hero')?.getBoundingClientRect();
    if (!header || !hero) return Number.POSITIVE_INFINITY;
    return Math.abs(hero.top - header.bottom);
  });
  expect(heroGap).toBeLessThanOrEqual(1);

  const controls = [
    page.locator('.brand-lockup img'),
    page.locator('.brand-lockup strong'),
    page.locator('.brand-lockup small'),
    page.getByLabel('Primary').getByRole('link', { name: 'Member Login' }),
    page.getByLabel('Primary').getByRole('link', { name: 'Sign Up Now' }),
    page.getByRole('button', { name: 'Open navigation' }),
  ];
  for (const control of controls) {
    await expect(control).toBeVisible();
  }

  const heroCta = page.locator('.hero .hero-cta');
  await expect(heroCta).toBeVisible();
  const heroCtaBox = await heroCta.boundingBox();
  expect(heroCtaBox).not.toBeNull();
  expect(heroCtaBox.y + heroCtaBox.height).toBeLessThanOrEqual(viewport.height);

  await expect(page.locator('.hero .kicker span')).toHaveText([
    'WORLDWIDE MISHNAH LEARNING',
    'LIVE FROM ERETZ YISRAEL',
  ]);
  await expect(
    page.getByRole('heading', { name: 'Everything He Needs to Learn, Review, and Remember' }),
  ).toBeVisible();
  await expect(page.locator('.feature-panel li strong')).toHaveText([
    'LIVE EVERY DAY',
    'REVIEW ANYTIME',
    'REMEMBER THE LEARNING',
    'STAY ON TRACK',
    'STUDENT PORTAL',
    'PARENT PORTAL',
  ]);
  await expect(page.locator('.benefit-card h3')).toHaveText([
    'Clarity',
    'Retention',
    'Progress',
    'A Love of Learning',
  ]);
  await expect(
    page.getByRole('heading', {
      name: "A Ready-to-Run Mishnayos Class—Wherever Your Son Learns",
    }),
  ).toBeVisible();
  await expect(page.getByText(/teacher replacement|absent-rebbe|substitute/i)).toHaveCount(0);
  await expect(page.locator('.gallery-slide').first().locator('figcaption')).toHaveText(
    'Atlanta, Georgia',
  );
  await expect(page.getByText('Rabbi Scheller teaching a large student group.')).toHaveCount(0);

  const visualChecks = await page.evaluate(() => {
    const receiveImage = document.querySelector('.receive-image img')?.getBoundingClientRect();
    const featurePanel = document.querySelector('.feature-panel')?.getBoundingClientRect();
    const receiveImageStyles = document.querySelector('.receive-image img')
      ? getComputedStyle(document.querySelector('.receive-image img'))
      : null;
    const gallery = document.querySelector('.gallery')?.getBoundingClientRect();
    const galleryImage = document.querySelector('.gallery-slide img');
    const galleryImageFilter = galleryImage ? getComputedStyle(galleryImage).filter : null;
    const overlap =
      receiveImage && featurePanel
        ? !(
            receiveImage.right <= featurePanel.left ||
            featurePanel.right <= receiveImage.left ||
            receiveImage.bottom <= featurePanel.top ||
            featurePanel.bottom <= receiveImage.top
          )
        : true;
    return {
      receiveBorderRadius: receiveImageStyles?.borderRadius ?? '',
      receiveOverlap: overlap,
      galleryCentered: gallery
        ? Math.abs(gallery.left + gallery.width / 2 - document.documentElement.clientWidth / 2)
        : Number.POSITIVE_INFINITY,
      galleryFilter: galleryImageFilter,
    };
  });
  expect(visualChecks.receiveBorderRadius).not.toBe('999px');
  expect(visualChecks.receiveOverlap).toBe(false);
  expect(visualChecks.galleryCentered).toBeLessThanOrEqual(24);
  expect(visualChecks.galleryFilter).toBe('none');

  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
  );
  expect(overflow).toBe(false);

  const footer = page.locator('.site-footer');
  await expect(footer.locator('img[src="/assets/brand/onetimelogo.webp"]')).toBeVisible();
  await expect(footer.getByText('One Time Mishnayos with Rabbi Eli Scheller.')).toBeVisible();
  await expect(footer.getByRole('link')).toHaveText([
    'Home',
    'Sign Up Now',
    'Privacy',
    'Terms',
    'Member Login',
  ]);
}

const server = startServer();
const screenshots = [];

try {
  await mkdir(outputDir, { recursive: true });
  await waitForServer();
  const browser = await chromium.launch();
  const page = await browser.newPage();

  for (const viewport of viewports) {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await page.goto(baseUrl, { waitUntil: 'load' });
    await decodeImages(page);
    await assertLanding(page, viewport);
    const screenshotPath = path.join(outputDir, viewport.name);
    await page.screenshot({ path: screenshotPath, fullPage: true });
    screenshots.push({
      viewport: `${viewport.width}x${viewport.height}`,
      path: path.relative(process.cwd(), screenshotPath).replaceAll('\\', '/'),
    });
  }

  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto(baseUrl, { waitUntil: 'load' });
  await expect(page.locator('.campaign-ticker-item').first()).toBeVisible();
  await expect(page.locator('.campaign-ticker-track')).toHaveCSS('animation-name', 'none');

  await browser.close();
  await writeFile(
    reportPath,
    `# OT-73 Landing Screenshots

Generated against local test server at ${baseUrl} after \`npm run build\`.

${screenshots.map((item) => `- ${item.viewport}: \`${item.path}\``).join('\n')}

Assertions before capture:

- moving countdown ticker present with canonical deadline
- reduced-motion ticker falls back to readable static text
- no stale price, monthly, no-card, trial, or hero offer paragraph
- no blank gap between header and hero
- header logo/brand/actions/hamburger visible
- hero CTA visible above the fold
- exact two-line kicker
- exact feature/result/audience copy
- no circular receive image or image/text overlap
- centered full-color gallery with place-only captions
- no horizontal overflow
- approved footer logo, line, and link order
`,
  );
  process.stdout.write(`Captured ${screenshots.length} OT-73 landing screenshots.\n`);
} finally {
  server.kill('SIGTERM');
}
