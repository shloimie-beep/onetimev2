import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';

const baseURL = process.env.BASE_URL ?? 'http://127.0.0.1:3100';
const evidenceDir = path.dirname(fileURLToPath(import.meta.url));
const screenshotDir = path.join(evidenceDir, 'screenshots');

const viewports = [
  { width: 360, height: 800 },
  { width: 390, height: 844 },
  { width: 768, height: 1024 },
  { width: 1440, height: 900 },
];

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function boxInsideViewport(locator, viewport, label) {
  const box = await locator.boundingBox();
  assert(box, `${label} is missing`);
  assert(box.x >= 0, `${label} starts left of viewport`);
  assert(box.y >= 0, `${label} starts above viewport`);
  assert(box.x + box.width <= viewport.width, `${label} exceeds viewport width`);
  assert(box.y + box.height <= viewport.height, `${label} exceeds viewport height`);
}

await mkdir(screenshotDir, { recursive: true });

const browser = await chromium.launch();
try {
  const page = await browser.newPage();
  const publicScript = await (await page.request.get(`${baseURL}/assets/public.js`)).text();
  assert(!publicScript.includes('data-campaign-deadline'), 'public bundle has dead campaign listener');
  assert(!publicScript.includes('JOIN FREE'), 'public bundle has retired campaign copy');

  for (const viewport of viewports) {
    await page.setViewportSize(viewport);
    await page.goto(`${baseURL}/`, { waitUntil: 'networkidle' });

    const bodyText = await page.locator('body').innerText();
    assert(!/JOIN FREE|ROSH HASHANAH|\$67|free until/i.test(bodyText), 'retired offer text is visible');
    assert((await page.locator('.campaign-ticker').count()) === 0, 'campaign ticker DOM is present');
    assert((await page.locator('[data-campaign-deadline]').count()) === 0, 'campaign deadline DOM is present');

    const header = page.locator('.site-header');
    const hero = page.locator('.hero');
    const headerBox = await header.boundingBox();
    const heroBox = await hero.boundingBox();
    assert(headerBox && heroBox, 'header or hero box missing');
    assert(Math.round(headerBox.y + headerBox.height) === Math.round(heroBox.y), 'header does not flow directly into hero');

    await boxInsideViewport(page.locator('.brand-lockup img').first(), viewport, 'brand logo');
    await boxInsideViewport(page.locator('.brand-lockup strong', { hasText: 'One Time Mishnayos' }).first(), viewport, 'brand title');
    await boxInsideViewport(page.locator('.brand-lockup small', { hasText: 'Worldwide Mishnah Learning' }).first(), viewport, 'brand subtitle');
    await boxInsideViewport(page.getByLabel('Primary').getByRole('link', { name: 'Member Login' }), viewport, 'member login');
    await boxInsideViewport(page.getByLabel('Primary').getByRole('link', { name: 'Sign Up Now' }), viewport, 'header signup');
    await boxInsideViewport(page.getByLabel('Primary').getByRole('button', { name: 'Open navigation' }), viewport, 'hamburger');
    await boxInsideViewport(page.locator('.hero .hero-cta'), viewport, 'hero signup');

    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
    );
    assert(!overflow, 'page has horizontal overflow');

    await page.screenshot({
      path: path.join(screenshotDir, `landing-${viewport.width}x${viewport.height}.png`),
      fullPage: false,
    });

    await page.locator('.site-footer').scrollIntoViewIfNeeded();
    const footerLinks = await page
      .locator('.site-footer nav a')
      .evaluateAll((links) => links.map((link) => [link.textContent?.trim(), link.getAttribute('href')]));
    assert(JSON.stringify(footerLinks) === JSON.stringify([
      ['Home', '/'],
      ['Sign Up Now', '/signup'],
      ['Privacy', '/privacy'],
      ['Terms', '/terms'],
      ['Member Login', '/login'],
    ]), 'footer links do not match canonical order');
    assert(
      await page.locator('.site-footer').getByText('One Time Mishnayos with Rabbi Eli Scheller.').isVisible(),
      'canonical footer line is not visible',
    );
  }
} finally {
  await browser.close();
}
