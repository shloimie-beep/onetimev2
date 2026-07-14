import { gzipSync } from 'node:zlib';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { expect, test, type BrowserContext, type Page } from '@playwright/test';

type SampleSet = {
  samples: number[];
  p75: number;
  target_ms: number;
  pass: boolean;
};

const evidencePath = path.resolve(process.cwd(), 'ops/evidence/ot-35/performance-report.json');

test.setTimeout(120_000);

test('CRM shell meets repeated synthetic throttled performance gates', async ({
  page,
  context,
}) => {
  const requestedPaths: string[] = [];
  page.on('request', (request) => {
    const url = new URL(request.url());
    if (
      url.pathname.startsWith('/api/') ||
      url.pathname.includes('operations') ||
      url.pathname.includes('bna')
    ) {
      requestedPaths.push(url.pathname);
    }
  });

  await installPerfObservers(page);
  const email = `ot35-perf-${Date.now()}@example.test`;
  await login(page);
  await createContact(page, 'OT35 Perf Parent', email);
  await applyMobileThrottle(context, page);
  await page.getByLabel('Search').fill(email);
  await page.getByRole('button', { name: 'Apply' }).click();
  await page.getByRole('button', { name: /OT35 Perf Parent/ }).click();
  await page.waitForURL('**/app/crm/contacts/**');
  const contactPath = new URL(page.url()).pathname;

  await measureList(page);
  await measureDetail(page, contactPath);
  await measureReturn(page, contactPath);

  const listSamples: number[] = [];
  const detailSamples: number[] = [];
  const returnSamples: number[] = [];
  const shellSamples: number[] = [];
  for (let index = 0; index < 10; index += 1) {
    listSamples.push(await measureList(page));
    detailSamples.push(await measureDetail(page, contactPath));
    returnSamples.push(await measureReturn(page, contactPath));
    shellSamples.push(await measureDrawerTransition(page));
  }

  const bundle = await compressedBundleReport();
  const webVitals = await readWebVitals(page);
  const report = {
    profile: {
      samples_after_warmup: 10,
      network_latency_ms: 150,
      download_throughput_kbps: 1600,
      upload_throughput_kbps: 750,
      cpu_throttle_rate: 4,
      viewport: '390x844',
      synthetic_fixtures_only: true,
    },
    list_first_usable: sampleSet(listSamples, 2500),
    detail_first_usable: sampleSet(detailSamples, 2500),
    return_to_loaded_list: sampleSet(returnSamples, 1500),
    cached_shell_transition: sampleSet(shellSamples, 500),
    web_vitals: webVitals,
    bundles: bundle,
    request_paths: [...new Set(requestedPaths)],
    zero_bna_operations_requests: !requestedPaths.some((requestPath) =>
      /\/(bna|operations)(\/|$)/i.test(requestPath),
    ),
    public_pages_exclude_authenticated_bundle: await publicPagesExcludeAppBundle(),
  };

  await mkdir(path.dirname(evidencePath), { recursive: true });
  await writeFile(evidencePath, `${JSON.stringify(report, null, 2)}\n`);

  expect(report.list_first_usable.pass).toBe(true);
  expect(report.detail_first_usable.pass).toBe(true);
  expect(report.return_to_loaded_list.pass).toBe(true);
  expect(report.cached_shell_transition.pass).toBe(true);
  expect(report.web_vitals.lcp_p75_ms).toBeLessThanOrEqual(2500);
  expect(report.web_vitals.cls).toBeLessThanOrEqual(0.1);
  expect(report.web_vitals.initial_long_task_over_200ms).toBe(false);
  expect(report.bundles.app_js_gzip_bytes).toBeLessThanOrEqual(170_000);
  expect(report.bundles.app_css_gzip_bytes).toBeLessThanOrEqual(60_000);
  expect(report.zero_bna_operations_requests).toBe(true);
  expect(report.public_pages_exclude_authenticated_bundle).toBe(true);
});

async function measureList(page: Page) {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.evaluate(() => performance.clearMarks('ot-crm-list-usable'));
  const started = Date.now();
  await page.goto('/app/crm', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => performance.getEntriesByName('ot-crm-list-usable').length > 0);
  return Date.now() - started;
}

async function measureDetail(page: Page, contactPath: string) {
  await page.evaluate(() => performance.clearMarks('ot-crm-detail-usable'));
  const started = Date.now();
  await page.goto(contactPath, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => performance.getEntriesByName('ot-crm-detail-usable').length > 0);
  return Date.now() - started;
}

async function measureReturn(page: Page, contactPath: string) {
  await page.goto('/app/crm', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => performance.getEntriesByName('ot-crm-list-usable').length > 0);
  await page.goto(contactPath, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => performance.getEntriesByName('ot-crm-detail-usable').length > 0);
  await page.evaluate(() => performance.clearMarks('ot-crm-list-usable'));
  const started = Date.now();
  await page.getByRole('button', { name: 'Back to CRM' }).click();
  await page.waitForFunction(() => performance.getEntriesByName('ot-crm-list-usable').length > 0);
  return Date.now() - started;
}

async function measureDrawerTransition(page: Page) {
  await page.goto('/app/crm', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => performance.getEntriesByName('ot-crm-list-usable').length > 0);
  const started = Date.now();
  await page.getByRole('button', { name: 'Open navigation' }).click();
  await page.getByRole('dialog', { name: 'One Time navigation' }).waitFor();
  const elapsed = Date.now() - started;
  await page.keyboard.press('Escape');
  return elapsed;
}

function sampleSet(samples: number[], targetMs: number): SampleSet {
  const p75 = percentile(samples, 0.75);
  return { samples, p75, target_ms: targetMs, pass: p75 <= targetMs };
}

function percentile(samples: number[], ratio: number) {
  const sorted = [...samples].sort((a, b) => a - b);
  const index = Math.max(0, Math.ceil(sorted.length * ratio) - 1);
  return sorted[index] ?? 0;
}

async function applyMobileThrottle(context: BrowserContext, page: Page) {
  const client = await context.newCDPSession(page);
  await client.send('Network.enable');
  await client.send('Network.emulateNetworkConditions', {
    offline: false,
    latency: 150,
    downloadThroughput: (1600 * 1024) / 8,
    uploadThroughput: (750 * 1024) / 8,
  });
  await client.send('Emulation.setCPUThrottlingRate', { rate: 4 });
}

async function installPerfObservers(page: Page) {
  await page.addInitScript(() => {
    const state = {
      lcp: [] as number[],
      cls: 0,
      longTasks: [] as number[],
    };
    Object.defineProperty(window, '__ot35Perf', { value: state, configurable: true });
    try {
      new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) state.lcp.push(entry.startTime);
      }).observe({ type: 'largest-contentful-paint', buffered: true });
    } catch {
      state.lcp.push(0);
    }
    try {
      new PerformanceObserver((list) => {
        for (const entry of list.getEntries() as Array<
          PerformanceEntry & { hadRecentInput?: boolean; value?: number }
        >) {
          if (!entry.hadRecentInput) state.cls += entry.value ?? 0;
        }
      }).observe({ type: 'layout-shift', buffered: true });
    } catch {
      state.cls = 0;
    }
    try {
      new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) state.longTasks.push(entry.duration);
      }).observe({ type: 'longtask', buffered: true });
    } catch {
      state.longTasks = [];
    }
  });
}

async function readWebVitals(page: Page) {
  await page.waitForTimeout(100);
  return page.evaluate(() => {
    const state = (
      window as typeof window & {
        __ot35Perf?: { lcp: number[]; cls: number; longTasks: number[] };
      }
    ).__ot35Perf ?? { lcp: [0], cls: 0, longTasks: [] };
    const lcp = state.lcp.length ? state.lcp : [0];
    const sortedLcp = [...lcp].sort((a, b) => a - b);
    const lcpIndex = Math.max(0, Math.ceil(sortedLcp.length * 0.75) - 1);
    return {
      lcp_p75_ms: Math.round(sortedLcp[lcpIndex] ?? 0),
      cls: Number(state.cls.toFixed(4)),
      initial_long_task_over_200ms: state.longTasks.some((duration) => duration > 200),
      long_task_max_ms: Math.round(Math.max(0, ...state.longTasks)),
    };
  });
}

async function compressedBundleReport() {
  const publicDir = path.resolve(process.cwd(), 'dist/apps/web/public');
  const [appJs, appCss] = await Promise.all([
    readFile(path.join(publicDir, 'assets/app-crm.js')),
    readFile(path.join(publicDir, 'assets/app-crm.css')),
  ]);
  return {
    app_js_gzip_bytes: gzipSync(appJs).byteLength,
    app_css_gzip_bytes: gzipSync(appCss).byteLength,
  };
}

async function publicPagesExcludeAppBundle() {
  const publicDir = path.resolve(process.cwd(), 'dist/apps/web/public');
  const [indexHtml, signupHtml] = await Promise.all([
    readFile(path.join(publicDir, 'index.html'), 'utf8'),
    readFile(path.join(publicDir, 'signup.html'), 'utf8'),
  ]);
  return !indexHtml.includes('app-crm.js') && !signupHtml.includes('app-crm.js');
}

async function login(page: Page) {
  await page.goto('/login');
  await page.getByLabel('Email').fill('ot-admin@example.test');
  await page.getByLabel('Password').fill('TestPassword!234');
  await page.getByRole('button', { name: 'Login' }).click();
  await page.waitForURL('**/app/crm');
  await page.waitForFunction(() => performance.getEntriesByName('ot-crm-list-usable').length > 0);
}

async function createContact(page: Page, name: string, email: string) {
  const result = await page.evaluate(
    async ({ name: displayName, email: contactEmail }) => {
      const sessionResponse = await fetch('/api/v1/auth/session', {
        headers: { accept: 'application/json' },
      });
      const session = await sessionResponse.json();
      const response = await fetch('/api/v1/crm/contacts', {
        method: 'POST',
        headers: {
          accept: 'application/json',
          'content-type': 'application/json',
          'x-csrf-token': session.csrf_token,
        },
        body: JSON.stringify({
          display_name: displayName,
          family_school_classification: 'family',
          email: contactEmail,
          phone: '',
          location: 'Jerusalem',
          timezone: 'Asia/Jerusalem',
          lead_status: 'new',
          internal_note: 'Synthetic OT-35 performance fixture.',
        }),
      });
      return response.json();
    },
    { name, email },
  );
  expect(result.success).toBe(true);
}
