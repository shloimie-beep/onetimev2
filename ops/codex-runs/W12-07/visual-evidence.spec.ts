import { expect, test, type Page } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

type LayoutShiftEntry = PerformanceEntry & {
  hadRecentInput: boolean;
  value: number;
};

type ViewportEvidence = {
  activeGalleryCaption: string | null;
  appBundleRequests: string[];
  cls: number;
  ctaAboveFold: boolean;
  galleryOverflowX: string;
  heroHeadingLeftRatio: number;
  horizontalOverflow: boolean;
  lcp: number;
  name: string;
  retentionImageCount: number;
  studentImageCount: number;
  tickerBottomLocked: boolean;
  usableMs: number;
  viewport: {
    height: number;
    width: number;
  };
};

type WindowWithW12Metrics = Window &
  typeof globalThis & {
    __w12Metrics?: {
      cls: number;
      lcp: number;
    };
  };

const evidenceRoot = path.join(process.cwd(), 'ops', 'evidence', 'w12-07');
const screenshotRoot = path.join(evidenceRoot, 'screenshots');

const viewports = [
  { name: 'mobile-360', width: 360, height: 800 },
  { name: 'mobile-390', width: 390, height: 844 },
  { name: 'tablet', width: 768, height: 1024 },
  { name: 'desktop', width: 1440, height: 1000 },
];

const sections = [
  { name: 'initial-viewport', selector: 'body' },
  { name: 'hero', selector: '.hero' },
  { name: 'benefits', selector: '#gain' },
  { name: 'retention-card', selector: 'article[data-benefit="Retention"]' },
  { name: 'gallery', selector: '.gallery-section' },
];

test.setTimeout(150_000);

async function installMetrics(page: Page) {
  await page.addInitScript(() => {
    const target = window as WindowWithW12Metrics;
    target.__w12Metrics = { cls: 0, lcp: 0 };

    try {
      new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          const shift = entry as LayoutShiftEntry;
          if (!shift.hadRecentInput) target.__w12Metrics!.cls += shift.value;
        }
      }).observe({ type: 'layout-shift', buffered: true });

      new PerformanceObserver((list) => {
        const latest = list.getEntries().at(-1);
        if (latest) target.__w12Metrics!.lcp = latest.startTime;
      }).observe({ type: 'largest-contentful-paint', buffered: true });
    } catch {
      target.__w12Metrics = { cls: 0, lcp: 0 };
    }
  });
}

test('capture W12-07 landing visual evidence', async ({ baseURL, browser }) => {
  expect(baseURL).toBeTruthy();
  await mkdir(screenshotRoot, { recursive: true });
  const rows: ViewportEvidence[] = [];

  for (const viewport of viewports) {
    const context = await browser.newContext({
      viewport: { width: viewport.width, height: viewport.height },
    });
    const page = await context.newPage();
    await installMetrics(page);
    const requestedAssets: string[] = [];
    page.on('request', (request) => requestedAssets.push(new URL(request.url()).pathname));

    const started = Date.now();
    await page.goto(new URL('/', baseURL).toString(), { waitUntil: 'networkidle' });
    const usableMs = Date.now() - started;
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.getByRole('heading', { name: 'Give your son a love for learning Torah.' }).waitFor();
    await page.waitForTimeout(500);

    await page.screenshot({
      fullPage: true,
      path: path.join(screenshotRoot, `${viewport.name}-full.jpg`),
      quality: 82,
      type: 'jpeg',
    });
    await page.screenshot({
      path: path.join(screenshotRoot, `${viewport.name}-initial-viewport.jpg`),
      quality: 82,
      type: 'jpeg',
    });

    for (const section of sections.slice(1)) {
      const locator = page.locator(section.selector).first();
      await locator.evaluate((element) => {
        const top = window.scrollY + element.getBoundingClientRect().top - 116;
        window.scrollTo({ behavior: 'instant', top: Math.max(0, top) });
      });
      await page.waitForTimeout(120);
      const box = await locator.boundingBox();
      expect(box).not.toBeNull();
      if (!box) continue;
      await page.screenshot({
        clip: {
          height: Math.min(box.height, viewport.height - Math.max(0, box.y)),
          width: Math.min(box.width, viewport.width - Math.max(0, box.x)),
          x: Math.max(0, box.x),
          y: Math.max(0, box.y),
        },
        path: path.join(screenshotRoot, `${viewport.name}-${section.name}.jpg`),
        quality: 82,
        type: 'jpeg',
      });
    }

    const evidence = await page.evaluate(
      ({ measuredUsableMs, viewportName }): ViewportEvidence => {
        const metrics = (window as WindowWithW12Metrics).__w12Metrics ?? { cls: 0, lcp: 0 };
        const heroHeading = document.querySelector<HTMLElement>('.hero h1');
        const cta = document.querySelector<HTMLElement>('.hero .hero-cta');
        const ticker = document.querySelector<HTMLElement>('.campaign-ticker');
        const galleryViewport = document.querySelector<HTMLElement>('.gallery-viewport');
        const activeCaption = document
          .querySelector('.gallery-slide[data-active="true"] figcaption')
          ?.textContent?.trim();
        const ctaBox = cta?.getBoundingClientRect();
        const tickerBox = ticker?.getBoundingClientRect();
        const headingBox = heroHeading?.getBoundingClientRect();
        const appRequests = performance
          .getEntriesByType('resource')
          .map((entry) => entry.name)
          .filter((resourceUrl) => resourceUrl.includes('app-crm'));

        return {
          activeGalleryCaption: activeCaption || null,
          appBundleRequests: appRequests,
          cls: Number(metrics.cls.toFixed(4)),
          ctaAboveFold: Boolean(ctaBox && ctaBox.bottom <= window.innerHeight),
          galleryOverflowX: galleryViewport ? getComputedStyle(galleryViewport).overflowX : '',
          heroHeadingLeftRatio: headingBox
            ? Number((headingBox.left / window.innerWidth).toFixed(3))
            : 0,
          horizontalOverflow:
            document.documentElement.scrollWidth > document.documentElement.clientWidth,
          lcp: Number(metrics.lcp.toFixed(1)),
          name: viewportName,
          retentionImageCount: document.querySelectorAll(
            'article[data-benefit="Retention"] img[src="/assets/outcomes/retention-review-class-720.webp"]',
          ).length,
          studentImageCount: document.querySelectorAll('img[src="/assets/students/smiley-kid.png"]')
            .length,
          tickerBottomLocked: Boolean(
            tickerBox && Math.abs(window.innerHeight - tickerBox.bottom) < 2,
          ),
          usableMs: measuredUsableMs,
          viewport: {
            height: window.innerHeight,
            width: window.innerWidth,
          },
        };
      },
      { measuredUsableMs: usableMs, viewportName: viewport.name },
    );

    expect(evidence.horizontalOverflow).toBe(false);
    expect(evidence.ctaAboveFold).toBe(true);
    expect(evidence.studentImageCount).toBe(1);
    expect(evidence.retentionImageCount).toBe(1);
    expect(evidence.galleryOverflowX).toBe('hidden');
    expect(evidence.tickerBottomLocked).toBe(true);
    expect(evidence.appBundleRequests).toEqual([]);
    if (viewport.width >= 768) expect(evidence.heroHeadingLeftRatio).toBeGreaterThan(0.22);

    rows.push({
      ...evidence,
      appBundleRequests: Array.from(
        new Set(requestedAssets.filter((asset) => asset.includes('app-crm'))),
      ),
    });
    await context.close();
  }

  await writeFile(
    path.join(evidenceRoot, 'visual-metrics.json'),
    `${JSON.stringify(rows, null, 2)}\n`,
  );
  await writeFile(
    path.join(evidenceRoot, 'visual-metrics.md'),
    [
      '# W12-07 Visual Evidence',
      '',
      `Generated: ${new Date().toISOString()}`,
      '',
      '| Viewport | Overflow | CTA above fold | Retention images | Student images | App bundle requests | Ticker bottom | Gallery overflow | LCP ms | CLS |',
      '| --- | --- | --- | ---: | ---: | ---: | --- | --- | ---: | ---: |',
      ...rows.map(
        (row) =>
          `| ${row.name} (${row.viewport.width}x${row.viewport.height}) | ${
            row.horizontalOverflow ? 'Fail' : 'Pass'
          } | ${row.ctaAboveFold ? 'Pass' : 'Fail'} | ${row.retentionImageCount} | ${
            row.studentImageCount
          } | ${row.appBundleRequests.length} | ${
            row.tickerBottomLocked ? 'Pass' : 'Fail'
          } | ${row.galleryOverflowX} | ${row.lcp} | ${row.cls} |`,
      ),
      '',
      'Screenshots are stored in `ops/evidence/w12-07/screenshots/`.',
      '',
    ].join('\n'),
  );
});

test('W12-07 landing remains usable with no JavaScript', async ({ baseURL, browser }) => {
  const context = await browser.newContext({
    javaScriptEnabled: false,
    viewport: { width: 390, height: 844 },
  });
  const page = await context.newPage();
  await page.goto(new URL('/', baseURL).toString(), { waitUntil: 'domcontentloaded' });
  await expect(
    page.getByRole('heading', { name: 'Give your son a love for learning Torah.' }),
  ).toBeVisible();
  await expect(page.locator('article[data-benefit="Retention"] img')).toBeVisible();
  await expect(page.getByRole('link', { name: 'Sign Up Now' }).first()).toBeVisible();
  await context.close();
});

test('W12-07 landing honors 200 percent text zoom without horizontal overflow', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await page.evaluate(() => {
    document.documentElement.style.setProperty('font-size', '200%');
  });
  const hasOverflow = await page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
  );
  expect(hasOverflow).toBe(false);
});
