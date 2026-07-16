import { expect, test, type Page, type Request } from '@playwright/test';
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
  heading: string | null;
  horizontalOverflow: boolean;
  lcp: number;
  name: string;
  publicBundleRequests: string[];
  studentImageCount: number;
  usableMs: number;
  viewport: {
    height: number;
    width: number;
  };
};

type WindowWithOt108Metrics = Window &
  typeof globalThis & {
    __ot108Metrics?: {
      cls: number;
      lcp: number;
    };
  };

const evidenceRoot = path.join(process.cwd(), 'ops', 'evidence', 'ot-108');
const screenshotRoot = path.join(evidenceRoot, 'screenshots');

const viewports = [
  { name: 'mobile-360', width: 360, height: 800 },
  { name: 'mobile-390', width: 390, height: 844 },
  { name: 'tablet', width: 768, height: 1024 },
  { name: 'desktop', width: 1440, height: 1000 },
];

const sections = [
  { name: 'hero', selector: '.hero' },
  { name: 'benefits', selector: '#gain' },
  { name: 'clarity-card', selector: 'article[data-benefit="Clarity"]' },
  { name: 'retention-card', selector: 'article[data-benefit="Retention"]' },
  { name: 'gallery', selector: '.gallery' },
];

test.setTimeout(120_000);

async function installMetrics(page: Page) {
  await page.addInitScript(() => {
    const target = window as WindowWithOt108Metrics;
    target.__ot108Metrics = { cls: 0, lcp: 0 };

    try {
      new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          const shift = entry as LayoutShiftEntry;
          if (!shift.hadRecentInput) {
            target.__ot108Metrics!.cls += shift.value;
          }
        }
      }).observe({ type: 'layout-shift', buffered: true });

      new PerformanceObserver((list) => {
        const entries = list.getEntries();
        const latest = entries.at(-1);
        if (latest) {
          target.__ot108Metrics!.lcp = latest.startTime;
        }
      }).observe({ type: 'largest-contentful-paint', buffered: true });
    } catch {
      target.__ot108Metrics = { cls: 0, lcp: 0 };
    }
  });
}

test('capture OT-108 landing visual evidence', async ({ baseURL, browser }) => {
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
    const requestHandler = (request: Request) => {
      requestedAssets.push(new URL(request.url()).pathname);
    };

    page.on('request', requestHandler);
    try {
      const started = Date.now();
      await page.goto(new URL('/', baseURL).toString(), { waitUntil: 'networkidle' });
      const usableMs = Date.now() - started;

      await page.evaluate(() => window.scrollTo(0, 0));
      await page
        .getByRole('heading', { name: 'Give your son a love for learning Torah.' })
        .waitFor();
      await page.waitForTimeout(500);
      await page.screenshot({
        fullPage: true,
        path: path.join(screenshotRoot, `${viewport.name}-full.jpg`),
        quality: 82,
        type: 'jpeg',
      });

      for (const section of sections) {
        const locator = page.locator(section.selector).first();
        await locator.evaluate((element) => {
          const top = window.scrollY + element.getBoundingClientRect().top - 128;
          window.scrollTo({ behavior: 'instant', top: Math.max(0, top) });
        });
        await page.waitForTimeout(100);
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
        ({ viewportName, measuredUsableMs }): ViewportEvidence => {
          const metrics = (window as WindowWithOt108Metrics).__ot108Metrics ?? { cls: 0, lcp: 0 };
          const activeCaption = document
            .querySelector('.gallery-slide[data-active="true"] figcaption')
            ?.textContent?.trim();
          const appRequests = performance
            .getEntriesByType('resource')
            .map((entry) => entry.name)
            .filter((resourceUrl) => resourceUrl.includes('app-crm'));
          const publicRequests = performance
            .getEntriesByType('resource')
            .map((entry) => entry.name)
            .filter((resourceUrl) => resourceUrl.includes('public'));

          return {
            activeGalleryCaption: activeCaption || null,
            appBundleRequests: appRequests,
            cls: Number(metrics.cls.toFixed(4)),
            heading: document.querySelector('h1')?.textContent?.trim() ?? null,
            horizontalOverflow:
              document.documentElement.scrollWidth > document.documentElement.clientWidth,
            lcp: Number(metrics.lcp.toFixed(1)),
            name: viewportName,
            publicBundleRequests: publicRequests,
            studentImageCount: document.querySelectorAll(
              'img[src="/assets/students/smiley-kid.png"]',
            ).length,
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
      expect(evidence.studentImageCount).toBe(1);
      expect(evidence.appBundleRequests).toEqual([]);
      page.off('request', requestHandler);
      rows.push({
        ...evidence,
        appBundleRequests: Array.from(
          new Set(requestedAssets.filter((asset) => asset.includes('app-crm'))),
        ),
        publicBundleRequests: Array.from(new Set(evidence.publicBundleRequests)),
      });
    } finally {
      await context.close();
    }
  }

  const metricsPath = path.join(evidenceRoot, 'visual-metrics.json');
  await writeFile(metricsPath, `${JSON.stringify(rows, null, 2)}\n`);

  const markdown = [
    '# OT-108 Visual Evidence',
    '',
    `Generated: ${new Date().toISOString()}`,
    '',
    '| Viewport | Overflow | Student image uses | App bundle requests | Usable ms | LCP ms | CLS | Active gallery caption |',
    '| --- | --- | ---: | ---: | ---: | ---: | ---: | --- |',
    ...rows.map(
      (row) =>
        `| ${row.name} (${row.viewport.width}x${row.viewport.height}) | ${
          row.horizontalOverflow ? 'Fail' : 'Pass'
        } | ${row.studentImageCount} | ${row.appBundleRequests.length} | ${row.usableMs} | ${
          row.lcp
        } | ${row.cls} | ${row.activeGalleryCaption ?? 'n/a'} |`,
    ),
    '',
    'Screenshots are stored in `ops/evidence/ot-108/screenshots/`.',
    '',
  ].join('\n');

  await writeFile(path.join(evidenceRoot, 'VISUAL-EVIDENCE.md'), markdown);
});
