import { expect, test } from '@playwright/test';
import {
  collectRouteSnapshot,
  createSyntheticContact,
  desktopViewport,
  loginAs,
  mobileViewport,
  openSyntheticContactDetail,
  ownerRouteProbes,
  publicRouteProbes,
  requiredViewports,
  summarizeFindings,
  useW12AdminSession,
  writeEvidenceJson,
  type RouteProbe,
  type ViewportSpec,
} from './launch-readiness-helpers.ts';

test.describe.configure({ mode: 'serial' });

const routeRecords: Array<Record<string, unknown>> = [];

test('public route inventory covers launch pages, collection surfaces, and failure state', async ({
  page,
  browserName,
}) => {
  for (const viewport of requiredViewports) {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    for (const probe of publicRouteProbes) {
      const record = await collectRouteSnapshot(page, probe, viewport, browserName);
      routeRecords.push(record);
      expect(record.status).toBe(probe.id === '404' ? 404 : 200);
      expect(record.safety_findings).toEqual([]);
      expect(record.missing_accessible_names).toEqual([]);
      if (probe.id === 'signup') {
        expect(record.privacy_terms).toEqual({ privacy: true, terms: true });
      }
      expect(record.readiness_error).toBeNull();
      expect(record.overflow).toEqual(
        expect.objectContaining({
          clientWidth: expect.any(Number),
          scrollWidth: expect.any(Number),
          bodyScrollWidth: expect.any(Number),
        }),
      );
      expect(
        (record.overflow as { scrollWidth: number; clientWidth: number }).scrollWidth,
      ).toBeLessThanOrEqual(
        (record.overflow as { scrollWidth: number; clientWidth: number }).clientWidth + 1,
      );
    }
  }
});

test('authenticated owner routes cover dashboard, CRM detail, communications, classes, content, billing, and support', async ({
  page,
  browserName,
}) => {
  test.setTimeout(90_000);
  await page.setViewportSize({ width: mobileViewport.width, height: mobileViewport.height });
  const synthetic = await createSyntheticContact(page);
  await useW12AdminSession(page);
  await page.goto('/app/dashboard');
  await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();

  for (const viewport of [mobileViewport, desktopViewport]) {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    for (const probe of ownerRouteProbes) {
      if (probe.id === 'crm_contact_detail') {
        await openSyntheticContactDetail(page, synthetic.contactName, synthetic.email);
        const detailProbe: RouteProbe = {
          ...probe,
          path: new URL(page.url()).pathname,
          expectedHeading: synthetic.contactName,
        };
        const record = await collectRouteSnapshot(page, detailProbe, viewport, browserName);
        routeRecords.push(redactSynthetic(record, synthetic));
        expect(record.status).toBe(200);
        continue;
      }
      const record = await collectRouteSnapshot(page, probe, viewport, browserName);
      routeRecords.push(record);
      expect(record.missing_accessible_names).toEqual([]);
    }
  }
});

test('parent, student, and portal test lab journeys stay responsive and role-scoped', async ({
  browser,
  browserName,
}) => {
  test.setTimeout(90_000);
  const journeys: Array<{
    probe: RouteProbe;
    role: 'parent' | 'student' | null;
    viewport: ViewportSpec;
  }> = [
    {
      probe: {
        id: 'parent_portal',
        path: '/app/parent',
        audience: 'parent',
        expectedHeading: 'Parent Portal',
      },
      role: 'parent',
      viewport: mobileViewport,
    },
    {
      probe: {
        id: 'student_portal',
        path: '/app/student',
        audience: 'student',
        expectedHeading: 'Student Portal',
      },
      role: 'student',
      viewport: mobileViewport,
    },
    {
      probe: {
        id: 'portal_test_lab',
        path: '/app/portal-test-lab',
        audience: 'test_lab',
        expectedHeading: 'W12 Portal Test Lab',
      },
      role: null,
      viewport: desktopViewport,
    },
  ];

  for (const journey of journeys) {
    const context = await browser.newContext({
      viewport: { width: journey.viewport.width, height: journey.viewport.height },
    });
    const page = await context.newPage();
    if (journey.probe.id === 'portal_test_lab') await useW12AdminSession(page);
    if (journey.role) await loginAs(page, journey.role, journey.probe.path);
    const record = await collectRouteSnapshot(page, journey.probe, journey.viewport, browserName);
    routeRecords.push(record);
    expect(record.missing_accessible_names).toEqual([]);
    await context.close();
  }
});

test.afterAll(async () => {
  await writeEvidenceJson('ROUTE-JOURNEY-INVENTORY.json', {
    schema_version: 'onetime.w12_100.route_journey_inventory.v1',
    generated_at: new Date().toISOString(),
    route_count: new Set(routeRecords.map((record) => record.id)).size,
    records: routeRecords,
    defects: summarizeFindings(routeRecords),
    external_actions: 0,
    production_mutations: 0,
  });
});

function redactSynthetic(
  record: Record<string, unknown>,
  synthetic: { email: string; contactName: string },
) {
  return JSON.parse(
    JSON.stringify(record)
      .replaceAll(synthetic.email, '[synthetic-email]')
      .replaceAll(synthetic.contactName, '[synthetic-contact]'),
  ) as Record<string, unknown>;
}
