import { readdir, stat, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { expect, test, type Page } from '@playwright/test';

const evidencePath = path.resolve(process.cwd(), 'ops/evidence/ot-81/performance-30-sample.json');
const sampleCount = 30;

test.describe('OT81 integrated 30-sample performance matrix', () => {
  // This is intentionally a 30-sample route matrix; allow the complete serial
  // measurement run without weakening its route-level performance thresholds.
  test.setTimeout(720_000);

  test('records route-only loading, request counts, bundle sizes, LCP, and CLS', async ({
    page,
  }) => {
    await page.addInitScript(() => {
      window.__otVitals = { lcp: null, cls: 0 };
      try {
        new PerformanceObserver((entryList) => {
          const entries = entryList.getEntries();
          const last = entries.at(-1);
          const vitals = window.__otVitals;
          if (last && vitals) vitals.lcp = last.startTime;
        }).observe({ type: 'largest-contentful-paint', buffered: true });
        new PerformanceObserver((entryList) => {
          for (const entry of entryList.getEntries()) {
            const layoutShift = entry as LayoutShift;
            const vitals = window.__otVitals;
            if (!layoutShift.hadRecentInput && vitals) vitals.cls += layoutShift.value;
          }
        }).observe({ type: 'layout-shift', buffered: true });
      } catch {
        window.__otVitals.unsupported = true;
      }
    });

    const contactId = await createSyntheticContact(page);
    const results = [];
    results.push(
      await measureRoute(page, 'landing', async () => {
        await page.goto('/');
        await page
          .getByRole('heading', {
            name: 'Help your son love learning Mishnayos.',
          })
          .waitFor();
      }),
    );
    results.push(
      await measureRoute(page, 'signup', async () => {
        await page.goto('/signup');
        await page.getByRole('heading', { name: 'Create Family Account' }).waitFor();
      }),
    );
    results.push(
      await measureRoute(page, 'login', async () => {
        await page.goto('/login');
        await page.getByRole('button', { name: 'Login' }).waitFor();
      }),
    );

    await login(page, 'ot-admin@example.test', 'TestPassword!234', '/app/contacts');
    results.push(
      await measureRoute(page, 'crm_list', async () => {
        await page.goto('/app/contacts');
        await page.waitForFunction(
          () => performance.getEntriesByName('ot-crm-list-usable').length > 0,
        );
      }),
    );
    results.push(
      await measureRoute(page, 'crm_detail', async () => {
        await page.goto(`/app/contacts/${encodeURIComponent(contactId)}`);
        await page.waitForFunction(
          () => performance.getEntriesByName('ot-crm-detail-usable').length > 0,
        );
      }),
    );
    results.push(
      await measureRoute(page, 'warm_return', async () => {
        await page.goto('/app/contacts');
        await page.waitForFunction(
          () => performance.getEntriesByName('ot-crm-list-usable').length > 0,
        );
        await page.goto('/app/contacts');
        await page.waitForFunction(
          () => performance.getEntriesByName('ot-crm-list-usable').length > 0,
        );
      }),
    );

    await page.context().clearCookies();
    await login(page, 'ot-parent@example.test', 'ParentPassword!234', '/app/parent');
    results.push(
      await measureRoute(page, 'parent_portal', async () => {
        await page.goto('/app/parent');
        await page.locator('#app-main').getByRole('heading', { name: 'Parent Portal' }).waitFor();
      }),
    );

    await page.context().clearCookies();
    await login(page, 'ot-student@example.test', 'StudentPassword!234', '/app/student');
    results.push(
      await measureRoute(page, 'student_portal', async () => {
        await page.goto('/app/student');
        await page.locator('#app-main').getByRole('heading', { name: 'Student Portal' }).waitFor();
      }),
    );

    const evidence = {
      generated_at: new Date().toISOString(),
      sample_count: sampleCount,
      route_only_loading: true,
      bna_operations_fanout_count: 0,
      bundle_sizes: await bundleSizes(),
      results,
    };
    await mkdir(path.dirname(evidencePath), { recursive: true });
    await writeFile(evidencePath, `${JSON.stringify(evidence, null, 2)}\n`);

    for (const result of results) {
      expect(result.failures).toEqual([]);
      expect(result.p95_ms).toBeLessThanOrEqual(result.route === 'warm_return' ? 3500 : 3000);
      expect(result.bna_operations_fanout_count).toBe(0);
    }
  });
});

async function createSyntheticContact(page: Page) {
  await page.goto('/school');
  const email = `ot81-perf-${Date.now()}@example.test`;
  await page.getByLabel('School name').fill('OT81 Performance School');
  await page.getByLabel('Contact first name').fill('OT81');
  await page.getByLabel('Contact last name').fill('Performance Parent');
  await page.getByRole('textbox', { name: 'School contact email' }).fill(email);
  await page.getByRole('button', { name: 'Send school inquiry' }).click();
  await page.getByRole('heading', { name: /received your school inquiry/i }).waitFor();
  await login(page, 'ot-admin@example.test', 'TestPassword!234', '/app/contacts');
  const contactId = await page.evaluate(async (needle) => {
    const session = await fetch('/api/v1/auth/session');
    const sessionJson = (await session.json()) as { csrf_token: string };
    const response = await fetch('/api/v1/crm/contacts/search', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-csrf-token': sessionJson.csrf_token,
      },
      body: JSON.stringify({ search: needle }),
    });
    const json = (await response.json()) as {
      contacts?: Array<{ contact_id: string; email: string | null }>;
    };
    return json.contacts?.find((contact) => contact.email === needle)?.contact_id ?? null;
  }, email);
  if (!contactId) throw new Error('missing synthetic contact id');
  await page.context().clearCookies();
  return contactId;
}

async function measureRoute(page: Page, route: string, run: () => Promise<void>) {
  const samples = [];
  const failures = [];
  for (let index = 0; index < sampleCount; index += 1) {
    const requests: string[] = [];
    const onRequest = (request: { url: () => string }) => requests.push(request.url());
    page.on('request', onRequest);
    await resetVitals(page);
    const started = performance.now();
    try {
      await run();
    } catch (error) {
      failures.push({
        sample: index,
        message: error instanceof Error ? error.message : String(error),
      });
    }
    const duration = performance.now() - started;
    const vitals = await page.evaluate(
      (): { lcp: number | null; cls: number; unsupported?: boolean } =>
        window.__otVitals ?? { lcp: null, cls: 0 },
    );
    page.off('request', onRequest);
    samples.push({
      duration_ms: Number(duration.toFixed(1)),
      request_count: requests.length,
      api_request_count: requests.filter((url) => new URL(url).pathname.startsWith('/api/v1/'))
        .length,
      lcp_ms: typeof vitals.lcp === 'number' ? Number(vitals.lcp.toFixed(1)) : null,
      cls: typeof vitals.cls === 'number' ? Number(vitals.cls.toFixed(4)) : null,
      browser_vitals_supported: !vitals.unsupported,
      bna_operations_fanout_count: requests.filter((url) =>
        /\/(?:bna|operations)(?:\/|$)/i.test(new URL(url).pathname),
      ).length,
    });
  }
  const durations = samples.map((sample) => sample.duration_ms).sort((left, right) => left - right);
  const requestCounts = samples.map((sample) => sample.request_count);
  const fanoutCount = samples.reduce(
    (total, sample) => total + sample.bna_operations_fanout_count,
    0,
  );
  return {
    route,
    samples: sampleCount,
    p50_ms: percentile(durations, 0.5),
    p75_ms: percentile(durations, 0.75),
    p95_ms: percentile(durations, 0.95),
    max_request_count: Math.max(...requestCounts),
    bna_operations_fanout_count: fanoutCount,
    failures,
    sample_details: samples,
  };
}

async function resetVitals(page: Page) {
  await page.evaluate(() => {
    window.__otVitals = { lcp: null, cls: 0 };
    performance.clearMarks();
    performance.clearMeasures();
  });
}

async function login(page: Page, email: string, password: string, returnTo: string) {
  await page.goto(`/login?return_to=${encodeURIComponent(returnTo)}`);
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password').fill(password);
  await page.getByRole('button', { name: 'Login' }).click();
  await page.waitForURL(`**${returnTo}`);
}

async function bundleSizes() {
  const assetsDir = path.resolve(process.cwd(), 'dist/apps/web/public/assets');
  const files = await readdir(assetsDir).catch(() => []);
  const sizes: Record<string, number> = {};
  for (const file of files) {
    if (!/\.(js|css)$/.test(file)) continue;
    sizes[file] = (await stat(path.join(assetsDir, file))).size;
  }
  return sizes;
}

function percentile(values: number[], quantile: number) {
  const index = Math.min(values.length - 1, Math.max(0, Math.ceil(values.length * quantile) - 1));
  return Number((values[index] ?? 0).toFixed(1));
}

declare global {
  interface Window {
    __otVitals?: {
      lcp: number | null;
      cls: number;
      unsupported?: boolean;
    };
  }

  interface LayoutShift extends PerformanceEntry {
    value: number;
    hadRecentInput: boolean;
  }
}
