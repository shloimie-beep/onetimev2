import { expect, test } from '@playwright/test';
import {
  customerSafetyFindings,
  horizontalOverflowMetrics,
  mobileViewport,
  writeEvidenceJson,
} from './launch-readiness-helpers.ts';

test('landing, signup, login, and 404 smoke in major browser engines', async ({
  page,
  browserName,
}) => {
  const engineRecords: Array<Record<string, unknown>> = [];
  await page.setViewportSize({ width: mobileViewport.width, height: mobileViewport.height });
  for (const route of [
    {
      path: '/',
      heading: 'Worldwide Mishnah Learning / Live from Eretz Yisrael',
      status: 200,
    },
    { path: '/signup', heading: 'Create your Family account', status: 200 },
    { path: '/login', heading: 'Welcome back', status: 200 },
    { path: '/w12-100-missing-route', heading: /not found/i, status: 404 },
  ]) {
    const response = await page.goto(route.path, { waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('heading', { name: route.heading })).toBeVisible();
    const overflow = await horizontalOverflowMetrics(page);
    const safetyFindings = await customerSafetyFindings(page);
    engineRecords.push({
      browser: browserName,
      route: route.path,
      status: response?.status() ?? null,
      overflow,
      safety_findings: safetyFindings,
    });
    expect(response?.status()).toBe(route.status);
    expect(safetyFindings).toEqual([]);
  }
  await writeEvidenceJson(`MAJOR-ENGINE-SMOKE-${browserName}.json`, {
    schema_version: 'onetime.w12_100.major_engine_smoke.v1',
    generated_at: new Date().toISOString(),
    browser: browserName,
    records: engineRecords,
    defects: summarizeEngineDefects(engineRecords),
    external_actions: 0,
    production_mutations: 0,
  });
});

function summarizeEngineDefects(records: Array<Record<string, unknown>>) {
  return records.flatMap((record) => {
    const overflow = record.overflow as
      { clientWidth?: number; scrollWidth?: number; bodyScrollWidth?: number } | undefined;
    if (
      overflow &&
      ((overflow.scrollWidth ?? 0) > (overflow.clientWidth ?? 0) + 1 ||
        (overflow.bodyScrollWidth ?? 0) > (overflow.clientWidth ?? 0) + 1)
    ) {
      return [
        {
          browser: record.browser,
          route: record.route,
          kind: 'horizontal_overflow',
          overflow,
        },
      ];
    }
    return [];
  });
}
