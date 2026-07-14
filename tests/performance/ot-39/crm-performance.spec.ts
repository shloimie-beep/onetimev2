import { gzipSync } from 'node:zlib';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { expect, test, type BrowserContext, type Page } from '@playwright/test';

type SampleSet = {
  samples: number[];
  p50: number;
  p75: number;
  p95: number;
  target_ms: number;
  pass: boolean;
};

type VitalSample = {
  lcp_ms: number | null;
  cls: number;
  long_task_max_ms: number;
  long_task_over_200ms: boolean;
};

const sampleCount = 30;
const evidencePath = path.resolve(process.cwd(), 'ops/evidence/ot-39/performance-report.json');

test.setTimeout(300_000);

test('CRM shell emits post-paint marks and meets 30-sample performance gates', async ({
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
      requestedPaths.push(`${url.pathname}${url.search}`);
    }
  });

  await installPerfObservers(page);
  const email = `ot39-perf-${Date.now()}@example.test`;
  await login(page);
  await createContact(page, 'OT39 Perf Parent', email);
  await applyMobileThrottle(context, page);
  await reloadList(page);
  await page.getByRole('button', { name: /OT39 Perf Parent/ }).click();
  await waitForUsableDetail(page);
  const contactPath = new URL(page.url()).pathname;

  await warmJourneys(page, 'OT39 Perf Parent');

  const listSamples: number[] = [];
  const detailSamples: number[] = [];
  const returnSamples: number[] = [];
  const shellSamples: number[] = [];
  const webVitals = {
    list_first_usable: [] as VitalSample[],
    detail_first_usable: [] as VitalSample[],
  };
  const requestCounts = {
    list_first_usable: [] as number[],
    detail_first_usable: [] as number[],
    warm_return_list_gets: [] as number[],
    cached_shell_transition: [] as number[],
  };

  for (let index = 0; index < sampleCount; index += 1) {
    const list = await measureList(page);
    listSamples.push(list.elapsed);
    webVitals.list_first_usable.push(list.vitals);
    requestCounts.list_first_usable.push(list.request_count);

    const detail = await measureDetail(page, contactPath);
    detailSamples.push(detail.elapsed);
    webVitals.detail_first_usable.push(detail.vitals);
    requestCounts.detail_first_usable.push(detail.request_count);

    const warmReturn = await measureReturn(page, 'OT39 Perf Parent');
    returnSamples.push(warmReturn.elapsed);
    requestCounts.warm_return_list_gets.push(warmReturn.list_request_count);

    const shell = await measureDrawerTransition(page);
    shellSamples.push(shell.elapsed);
    requestCounts.cached_shell_transition.push(shell.request_count);
  }

  const bundle = await compressedBundleReport();
  const report = {
    profile: {
      samples_after_warmup: sampleCount,
      explicit_warmup_per_journey: true,
      network_latency_ms: 150,
      download_throughput_kbps: 1600,
      upload_throughput_kbps: 750,
      cpu_throttle_rate: 4,
      viewport: '390x844',
      measurement_definition:
        'List/detail marks are recorded from React effects only after committed visible/actionable UI and at least the next animation frame have painted. Warm return starts at Back to CRM click and must reuse the in-memory list without a full list GET.',
      synthetic_fixtures_only: true,
    },
    list_first_usable: sampleSet(listSamples, 2500),
    detail_first_usable: sampleSet(detailSamples, 2500),
    warm_return_to_cached_list: sampleSet(returnSamples, 1500),
    cached_shell_transition: sampleSet(shellSamples, 500),
    web_vitals: webVitals,
    bundles: bundle,
    request_counts: requestCounts,
    failures_timeouts: [],
    request_paths: [...new Set(requestedPaths)],
    zero_bna_operations_requests: !requestedPaths.some((requestPath) =>
      /\/(bna|operations)(\/|$)/i.test(requestPath),
    ),
    public_pages_exclude_authenticated_bundle: await publicPagesExcludeAppBundle(),
  };

  await mkdir(path.dirname(evidencePath), { recursive: true });
  await writeFile(evidencePath, `${JSON.stringify(report, null, 2)}\n`);

  expect(report.profile.samples_after_warmup).toBeGreaterThanOrEqual(30);
  expect(report.list_first_usable.pass).toBe(true);
  expect(report.detail_first_usable.pass).toBe(true);
  expect(report.warm_return_to_cached_list.pass).toBe(true);
  expect(report.cached_shell_transition.pass).toBe(true);
  expect(report.request_counts.warm_return_list_gets.every((count) => count === 0)).toBe(true);
  expect(report.web_vitals.list_first_usable.every((sample) => (sample.lcp_ms ?? 0) <= 2500)).toBe(
    true,
  );
  expect(
    report.web_vitals.detail_first_usable.every((sample) => (sample.lcp_ms ?? 0) <= 2500),
  ).toBe(true);
  expect(report.web_vitals.list_first_usable.every((sample) => sample.cls <= 0.1)).toBe(true);
  expect(report.web_vitals.detail_first_usable.every((sample) => sample.cls <= 0.1)).toBe(true);
  expect(
    [...report.web_vitals.list_first_usable, ...report.web_vitals.detail_first_usable].some(
      (sample) => sample.long_task_over_200ms,
    ),
  ).toBe(false);
  expect(report.bundles.app_js_gzip_bytes).toBeLessThanOrEqual(170_000);
  expect(report.bundles.app_css_gzip_bytes).toBeLessThanOrEqual(60_000);
  expect(report.zero_bna_operations_requests).toBe(true);
  expect(report.public_pages_exclude_authenticated_bundle).toBe(true);
});

async function warmJourneys(page: Page, contactName: string) {
  await measureList(page);
  await page.getByRole('button', { name: new RegExp(contactName) }).click();
  await waitForUsableDetail(page);
  await measureReturn(page, contactName);
  await measureDrawerTransition(page);
}

async function measureList(page: Page) {
  await page.setViewportSize({ width: 390, height: 844 });
  const requests = await countRequests(page, async () => {
    await resetVitals(page);
    await page.evaluate(() => performance.clearMarks('ot-crm-list-usable'));
    const started = Date.now();
    await page.goto('/app/crm', { waitUntil: 'domcontentloaded' });
    await waitForUsableList(page);
    return Date.now() - started;
  });
  return {
    elapsed: requests.result,
    request_count: requests.paths.filter((requestPath) => requestPath === '/api/v1/crm/contacts')
      .length,
    vitals: await readWebVitals(page),
  };
}

async function measureDetail(page: Page, contactPath: string) {
  const requests = await countRequests(page, async () => {
    await resetVitals(page);
    await page.evaluate(() => performance.clearMarks('ot-crm-detail-usable'));
    const started = Date.now();
    await page.goto(contactPath, { waitUntil: 'domcontentloaded' });
    await waitForUsableDetail(page);
    return Date.now() - started;
  });
  return {
    elapsed: requests.result,
    request_count: requests.paths.filter((requestPath) =>
      requestPath.includes('/api/v1/crm/contacts/'),
    ).length,
    vitals: await readWebVitals(page),
  };
}

async function measureReturn(page: Page, contactName: string) {
  await page.goto('/app/crm', { waitUntil: 'domcontentloaded' });
  await waitForUsableList(page);
  await page.getByRole('button', { name: new RegExp(contactName) }).click();
  await waitForUsableDetail(page);
  const requests = await countRequests(page, async () => {
    await page.evaluate(() => performance.clearMarks('ot-crm-list-usable'));
    const started = Date.now();
    await page.getByRole('button', { name: 'Back to CRM' }).click();
    await waitForUsableList(page);
    return Date.now() - started;
  });
  return {
    elapsed: requests.result,
    list_request_count: requests.paths.filter(
      (requestPath) => requestPath === '/api/v1/crm/contacts',
    ).length,
  };
}

async function measureDrawerTransition(page: Page) {
  await page.goto('/app/crm', { waitUntil: 'domcontentloaded' });
  await waitForUsableList(page);
  const requests = await countRequests(page, async () => {
    const started = Date.now();
    await page.getByRole('button', { name: 'Open navigation' }).click();
    await page.getByRole('dialog', { name: 'One Time navigation' }).waitFor();
    const elapsed = Date.now() - started;
    await page.keyboard.press('Escape');
    return elapsed;
  });
  return { elapsed: requests.result, request_count: requests.paths.length };
}

async function countRequests<T>(page: Page, action: () => Promise<T>) {
  const paths: string[] = [];
  const listener = (request: { url: () => string }) => {
    const url = new URL(request.url());
    if (url.pathname.startsWith('/api/')) paths.push(url.pathname);
  };
  page.on('request', listener);
  try {
    const result = await action();
    return { result, paths };
  } finally {
    page.off('request', listener);
  }
}

function sampleSet(samples: number[], targetMs: number): SampleSet {
  const p50 = percentile(samples, 0.5);
  const p75 = percentile(samples, 0.75);
  const p95 = percentile(samples, 0.95);
  return { samples, p50, p75, p95, target_ms: targetMs, pass: p75 <= targetMs };
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
    const install = () => {
      const state = {
        lcp: [] as number[],
        cls: 0,
        longTasks: [] as number[],
      };
      Object.defineProperty(window, '__ot39Perf', { value: state, configurable: true });
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
    };
    install();
  });
}

async function resetVitals(page: Page) {
  await page.evaluate(() => {
    const state = (
      window as typeof window & {
        __ot39Perf?: { lcp: number[]; cls: number; longTasks: number[] };
      }
    ).__ot39Perf;
    if (!state) return;
    state.lcp = [];
    state.cls = 0;
    state.longTasks = [];
  });
}

async function readWebVitals(page: Page): Promise<VitalSample> {
  await page.waitForTimeout(100);
  return page.evaluate(() => {
    const state = (
      window as typeof window & {
        __ot39Perf?: { lcp: number[]; cls: number; longTasks: number[] };
      }
    ).__ot39Perf ?? { lcp: [], cls: 0, longTasks: [] };
    return {
      lcp_ms: state.lcp.length ? Math.round(Math.max(...state.lcp)) : null,
      cls: Number(state.cls.toFixed(4)),
      long_task_over_200ms: state.longTasks.some((duration) => duration > 200),
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
  await waitForUsableList(page);
}

async function createContact(page: Page, name: string, email: string) {
  const result = await page.evaluate(
    async ({ name: displayName, email: contactEmail }) => {
      const sessionResponse = await fetch('/api/v1/auth/session', {
        cache: 'no-store',
        headers: { accept: 'application/json', 'cache-control': 'no-store' },
      });
      const session = await sessionResponse.json();
      const response = await fetch('/api/v1/crm/contacts', {
        method: 'POST',
        cache: 'no-store',
        headers: {
          accept: 'application/json',
          'cache-control': 'no-store',
          'content-type': 'application/json',
          'Idempotency-Key': `test-${crypto.randomUUID()}`,
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
          internal_note: 'Synthetic OT-39 performance fixture.',
        }),
      });
      return response.json();
    },
    { name, email },
  );
  expect(result.success).toBe(true);
}

async function reloadList(page: Page) {
  await page.evaluate(() => performance.clearMarks('ot-crm-list-usable'));
  await page.getByRole('button', { name: 'Apply' }).click();
  await waitForUsableList(page);
}

async function waitForUsableList(page: Page) {
  await page.waitForFunction(() => performance.getEntriesByName('ot-crm-list-usable').length > 0);
}

async function waitForUsableDetail(page: Page) {
  await page.waitForFunction(() => performance.getEntriesByName('ot-crm-detail-usable').length > 0);
}
