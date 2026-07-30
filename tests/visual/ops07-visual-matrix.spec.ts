import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';
import { expect, test, type Page } from '@playwright/test';

const evidenceDir = path.resolve(process.cwd(), 'test-results/f07-public-responsive');
const screenshotDir = path.join(evidenceDir, 'screenshots');
const matrixPath = path.join(evidenceDir, 'visual-matrix.json');

const viewports = [
  { name: '360x800', width: 360, height: 800 },
  { name: '390x844', width: 390, height: 844 },
  { name: '768x1024', width: 768, height: 1024 },
  { name: '1440x1000', width: 1440, height: 1000 },
];

test.describe('OPS-07 visual matrix', () => {
  test.setTimeout(180_000);

  test('asserts nonblank screenshots, no overflow, and stable usable state across core routes', async ({
    page,
  }) => {
    await page.route('**/api/v1/signup/family/bootstrap', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          idempotency_key: 'a'.repeat(43),
          csrf_token: `1789315200.${'b'.repeat(43)}.${'c'.repeat(43)}`,
          expires_at: '2026-09-13T16:40:00.000Z',
          writes_allowed: true,
        }),
      }),
    );
    await mkdir(screenshotDir, { recursive: true });
    const results = [];
    for (const viewport of viewports) {
      await page.setViewportSize(viewport);
      results.push(
        await captureRoute(page, `landing-${viewport.name}`, '/', 'MISHNAYOS MADE MEMORABLE'),
      );
      results.push(await captureRoute(page, `signup-${viewport.name}`, '/signup', 'Sign Up Now'));
    }

    const evidence = {
      generated_at: new Date().toISOString(),
      results,
      summary: {
        total: results.length,
        pass: results.filter((result) => result.status === 'PASS').length,
        fail: results.filter((result) => result.status === 'FAIL').length,
      },
    };
    await writeFile(matrixPath, `${JSON.stringify(evidence, null, 2)}\n`);
    expect(results.filter((result) => result.status === 'FAIL')).toEqual([]);
  });
});

async function captureRoute(page: Page, label: string, route: string, heading: string) {
  await page.goto(route);
  await page.getByRole('heading', { name: heading }).first().waitFor({ timeout: 15_000 });
  return captureCurrent(page, label, heading);
}

async function captureCurrent(page: Page, label: string, heading: string) {
  const findings: string[] = [];
  const screenshotPath = path.join(screenshotDir, `${label}.png`);
  try {
    await page.getByRole('heading', { name: heading }).first().waitFor({ timeout: 15_000 });
    await page.locator('img[loading="lazy"]').evaluateAll((images) => {
      images.forEach((image) => ((image as HTMLImageElement).loading = 'eager'));
    });
    await page.waitForFunction(
      () => [...document.images].every((image) => image.complete && image.naturalWidth > 0),
      undefined,
      { timeout: 15_000 },
    );
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
    );
    if (overflow) findings.push('horizontal overflow');
    const buffer = await page.screenshot({
      path: screenshotPath,
      fullPage: true,
      animations: 'disabled',
    });
    const metadata = await sharp(buffer).metadata();
    const stats = await sharp(buffer).stats();
    const maxStdev = Math.max(...stats.channels.map((channel) => channel.stdev));
    if (!metadata.width || !metadata.height) findings.push('missing screenshot dimensions');
    if (maxStdev < 3)
      findings.push(`screenshot appears blank; max channel stdev ${maxStdev.toFixed(2)}`);
    return {
      label,
      status: findings.length === 0 ? 'PASS' : 'FAIL',
      screenshot: path.relative(process.cwd(), screenshotPath).replaceAll('\\', '/'),
      width: metadata.width,
      height: metadata.height,
      max_channel_stdev: Number(maxStdev.toFixed(2)),
      findings,
    };
  } catch (error) {
    return {
      label,
      status: 'FAIL',
      screenshot: path.relative(process.cwd(), screenshotPath).replaceAll('\\', '/'),
      findings: [error instanceof Error ? error.message : String(error)],
    };
  }
}
