import { readdir, readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { gzipSync } from 'node:zlib';
import { expect, test } from '@playwright/test';
import {
  assertNoHorizontalOverflow,
  desktopViewport,
  mobileViewport,
  writeEvidenceJson,
} from '../../e2e/w12-100/launch-readiness-helpers.ts';

test.describe.configure({ mode: 'serial' });

const performanceRecords: Array<Record<string, unknown>> = [];

test('public pages meet local LCP, CLS, metadata, and navigation budgets', async ({ page }) => {
  for (const viewport of [mobileViewport, desktopViewport]) {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    for (const route of ['/', '/signup', '/privacy', '/terms']) {
      await installVitalsObserver(page);
      const started = Date.now();
      const response = await page.goto(route, { waitUntil: 'load' });
      await page.waitForLoadState('networkidle').catch(() => undefined);
      const usableMs = Date.now() - started;
      const vitals = await readVitals(page);
      const lcpMs = vitals.lcp || usableMs;
      const metadata = await page.evaluate(() => ({
        canonical: document.querySelector<HTMLLinkElement>('link[rel="canonical"]')?.href ?? '',
        robots: document.querySelector<HTMLMetaElement>('meta[name="robots"]')?.content ?? '',
        ogTitle:
          document.querySelector<HTMLMetaElement>('meta[property="og:title"]')?.content ?? '',
        ogDescription:
          document.querySelector<HTMLMetaElement>('meta[property="og:description"]')?.content ?? '',
        ogUrl: document.querySelector<HTMLMetaElement>('meta[property="og:url"]')?.content ?? '',
        h1Count: document.querySelectorAll('h1').length,
        navCount: document.querySelectorAll('nav, header, footer').length,
      }));
      await assertNoHorizontalOverflow(page);
      performanceRecords.push({
        route,
        viewport: viewport.label,
        status: response?.status() ?? null,
        usable_ms: usableMs,
        lcp_ms: lcpMs,
        cls: vitals.cls,
        metadata,
      });
      expect(response?.status()).toBe(200);
      expect(lcpMs).toBeLessThanOrEqual(2500);
      expect(vitals.cls).toBeLessThanOrEqual(0.1);
      if (route === '/' || route === '/signup') {
        expect(metadata.robots).toContain('index');
      } else {
        expect(metadata.robots).toMatch(/index/i);
      }
      expect(metadata.canonical).toMatch(
        new RegExp(`${escapeRegExp(route === '/' ? '/' : route)}$`),
      );
      expect(metadata.ogTitle).not.toBe('');
      expect(metadata.ogDescription).not.toBe('');
      expect(metadata.ogUrl).toBe(metadata.canonical);
      expect(metadata.h1Count).toBeGreaterThanOrEqual(1);
      expect(metadata.navCount).toBeGreaterThanOrEqual(2);
    }
  }
});

test('private and account recovery pages are noindex', async ({ page }) => {
  for (const route of ['/login', '/activate', '/forgot-password', '/reset-password']) {
    const response = await page.goto(route, { waitUntil: 'domcontentloaded' });
    const robots = await page.locator('meta[name="robots"]').getAttribute('content');
    const xRobots = response?.headers()['x-robots-tag'] ?? null;
    performanceRecords.push({
      route,
      status: response?.status() ?? null,
      robots,
      x_robots_tag: xRobots,
    });
    expect(response?.status()).toBe(200);
    expect(robots).toContain('noindex');
    expect(xRobots).toContain('noindex');
  }
});

test('public and authenticated bundles stay separated with launch budgets', async () => {
  const publicDir = path.resolve(process.cwd(), 'dist/apps/web/public');
  const publicJs = path.join(publicDir, 'assets/public.js');
  const publicCss = path.join(publicDir, 'assets/public.css');
  const publicJsText = await readFile(publicJs, 'utf8');
  const indexHtml = await readFile(path.join(publicDir, 'index.html'), 'utf8');
  const signupHtml = await readFile(path.join(publicDir, 'signup.html'), 'utf8');
  const appManifest = JSON.parse(
    await readFile(path.join(publicDir, 'manifest-app.json'), 'utf8'),
  ) as Record<string, { file?: string; imports?: string[]; css?: string[] }>;
  const crmEntry = appManifest['apps/web/src/client/app/crm-entry.tsx'];
  const portalEntry = appManifest['apps/web/src/client/app/portal-entry.tsx'];
  expect(crmEntry?.file).toBeTruthy();
  expect(portalEntry?.file).toBeTruthy();
  const crmFiles = collectManifestFiles(appManifest, crmEntry!);
  const portalFiles = collectManifestFiles(appManifest, portalEntry!);
  const metrics = {
    public_js: await fileMetrics(publicJs),
    public_css: await fileMetrics(publicCss),
    crm_js_raw_bytes: await sumFiles(
      publicDir,
      [...crmFiles].filter((file) => file.endsWith('.js')),
    ),
    portal_js_raw_bytes: await sumFiles(
      publicDir,
      [...portalFiles].filter((file) => file.endsWith('.js')),
    ),
    font_woff2_raw_bytes: await sumFontBytes(path.join(publicDir, 'assets/fonts')),
    public_html_references_crm:
      /app-crm\d*\.js/.test(indexHtml) || /app-crm\d*\.js/.test(signupHtml),
    public_js_mentions_react: /react|React/.test(publicJsText),
  };
  performanceRecords.push({ bundle_metrics: metrics });
  expect(metrics.public_js.raw_bytes).toBeLessThanOrEqual(45_000);
  expect(metrics.public_css.raw_bytes).toBeLessThanOrEqual(35_000);
  expect(metrics.crm_js_raw_bytes).toBeGreaterThan(50_000);
  expect(metrics.portal_js_raw_bytes).toBeGreaterThan(10_000);
  expect(metrics.font_woff2_raw_bytes).toBeLessThanOrEqual(250_000);
  expect(metrics.public_html_references_crm).toBe(false);
  expect(metrics.public_js_mentions_react).toBe(false);
  for (const importKey of new Set([
    ...(crmEntry?.imports ?? []),
    ...(portalEntry?.imports ?? []),
  ])) {
    expect(appManifest[importKey]?.file).toMatch(/-[A-Za-z0-9_-]{8}\.js$/);
  }
});

test.afterAll(async () => {
  await writeEvidenceJson('PERFORMANCE-SEO-BUNDLE-REPORT.json', {
    schema_version: 'onetime.w12_100.performance_seo_bundle_report.v1',
    generated_at: new Date().toISOString(),
    records: performanceRecords,
    external_actions: 0,
    production_mutations: 0,
  });
});

async function installVitalsObserver(page: import('@playwright/test').Page) {
  await page.addInitScript(() => {
    (window as unknown as { __w12Vitals: { lcp: number; cls: number } }).__w12Vitals = {
      lcp: 0,
      cls: 0,
    };
    try {
      new PerformanceObserver((entryList) => {
        const last = entryList.getEntries().at(-1);
        if (last) {
          (window as unknown as { __w12Vitals: { lcp: number; cls: number } }).__w12Vitals.lcp =
            last.startTime;
        }
      }).observe({ type: 'largest-contentful-paint', buffered: true });
      new PerformanceObserver((entryList) => {
        for (const entry of entryList.getEntries()) {
          const layoutEntry = entry as PerformanceEntry & {
            value?: number;
            hadRecentInput?: boolean;
          };
          if (!layoutEntry.hadRecentInput) {
            (window as unknown as { __w12Vitals: { lcp: number; cls: number } }).__w12Vitals.cls +=
              layoutEntry.value ?? 0;
          }
        }
      }).observe({ type: 'layout-shift', buffered: true });
    } catch {
      // Older browser engines may not expose these observer types under test.
    }
  });
}

async function readVitals(page: import('@playwright/test').Page) {
  return page.evaluate(
    () =>
      (window as unknown as { __w12Vitals?: { lcp: number; cls: number } }).__w12Vitals ?? {
        lcp: 0,
        cls: 0,
      },
  );
}

function collectManifestFiles(
  manifest: Record<string, { file?: string; imports?: string[]; css?: string[] }>,
  entry: { file?: string; imports?: string[]; css?: string[] },
) {
  const files = new Set<string>();
  if (entry.file) files.add(entry.file);
  for (const cssFile of entry.css ?? []) files.add(cssFile);
  for (const importKey of entry.imports ?? []) {
    const imported = manifest[importKey];
    if (imported?.file) files.add(imported.file);
    for (const cssFile of imported?.css ?? []) files.add(cssFile);
  }
  return files;
}

async function sumFiles(root: string, files: string[]) {
  const stats = await Promise.all(files.map((file) => stat(path.join(root, file))));
  return stats.reduce((total, fileStat) => total + fileStat.size, 0);
}

async function sumFontBytes(fontDir: string) {
  try {
    return sumFiles(
      fontDir,
      (await readdir(fontDir)).filter((file) => file.endsWith('.woff2')),
    );
  } catch {
    return 0;
  }
}

async function fileMetrics(filePath: string) {
  const buffer = await readFile(filePath);
  return { raw_bytes: buffer.byteLength, gzip_bytes: gzipSync(buffer).byteLength };
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
