import { AxeBuilder } from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import {
  assertNoHorizontalOverflow,
  customerSafetyFindings,
  desktopViewport,
  horizontalOverflowMetrics,
  loginAs,
  mobileViewport,
  requiredViewports,
  useW12AdminSession,
  visibleControlsMissingNames,
  writeEvidenceJson,
} from '../../e2e/w12-100/launch-readiness-helpers.ts';

test.describe.configure({ mode: 'serial' });

const a11yRecords: Array<Record<string, unknown>> = [];

test('public pages pass serious axe checks and expose labelled controls', async ({ page }) => {
  test.setTimeout(90_000);
  for (const viewport of requiredViewports) {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    for (const route of [
      '/',
      '/signup',
      '/privacy',
      '/terms',
      '/login',
      '/activate',
      '/forgot-password',
      '/reset-password',
    ]) {
      await page.goto(route, { waitUntil: 'domcontentloaded' });
      await page.waitForLoadState('networkidle').catch(() => undefined);
      const serious = seriousAxeViolations(await new AxeBuilder({ page }).analyze());
      const missingNames = await visibleControlsMissingNames(page);
      const safetyFindings = await customerSafetyFindings(page);
      await assertNoHorizontalOverflow(page);
      a11yRecords.push({
        route,
        viewport: viewport.label,
        critical_or_serious_violations: serious.map((violation) => violation.id),
        missing_accessible_names: missingNames,
        safety_findings: safetyFindings,
      });
      expect(serious).toEqual([]);
      expect(missingNames).toEqual([]);
      expect(safetyFindings).toEqual([]);
    }
  }
});

test('public and app navigation restore focus after drawer close', async ({ page }) => {
  await page.setViewportSize({ width: mobileViewport.width, height: mobileViewport.height });
  await page.goto('/');
  const publicMenu = page.getByRole('button', { name: 'Open navigation' });
  await publicMenu.click();
  await expect(page.locator('[data-drawer-close]')).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(publicMenu).toBeFocused();

  await useW12AdminSession(page);
  await page.goto('/app/dashboard');
  await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();
  const appMenu = page.getByRole('button', { name: 'Open navigation' });
  await appMenu.click();
  await expect(page.locator('.drawer-close')).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(appMenu).toBeFocused();
});

test('authenticated routes pass serious axe checks with mobile and desktop layouts', async ({
  browser,
}) => {
  test.setTimeout(90_000);
  const checks = [
    { role: 'admin_session' as const, route: '/app/dashboard', heading: 'Dashboard' },
    { role: 'admin_session' as const, route: '/app/crm', heading: 'CRM' },
    { role: 'admin_session' as const, route: '/app/communications', heading: 'Communications' },
    { role: 'admin_session' as const, route: '/app/classes', heading: 'Classes' },
    { role: 'admin_session' as const, route: '/app/content', heading: 'Content Workspace' },
    { role: 'admin_session' as const, route: '/app/billing', heading: 'Household Access' },
    { role: 'admin_session' as const, route: '/app/support', heading: 'Support' },
    { role: 'parent' as const, route: '/app/parent', heading: 'Parent Portal' },
    { role: 'student' as const, route: '/app/student', heading: 'Student Portal' },
  ];

  for (const viewport of [mobileViewport, desktopViewport]) {
    for (const check of checks) {
      const context = await browser.newContext({
        viewport: { width: viewport.width, height: viewport.height },
      });
      const page = await context.newPage();
      if (check.role === 'admin_session') {
        await useW12AdminSession(page);
        await page.goto(check.route);
      } else {
        await loginAs(page, check.role, check.route);
      }
      await page.waitForLoadState('networkidle').catch(() => undefined);
      const headingLocator = page.getByRole('heading', { name: check.heading });
      const headingVisible = await headingLocator
        .first()
        .isVisible()
        .catch(() => false);
      const serious = seriousAxeViolations(await new AxeBuilder({ page }).analyze());
      const missingNames = await visibleControlsMissingNames(page);
      const safetyFindings = await customerSafetyFindings(page);
      const overflow = await horizontalOverflowMetrics(page);
      a11yRecords.push({
        route: check.route,
        viewport: viewport.label,
        heading_visible: headingVisible,
        critical_or_serious_violations: serious.map((violation) => violation.id),
        missing_accessible_names: missingNames,
        safety_findings: safetyFindings,
        overflow,
      });
      await context.close();
    }
  }
});

test('form status regions and validation targets are present on collection surfaces', async ({
  page,
}) => {
  const records: Array<Record<string, unknown>> = [];
  for (const route of ['/signup', '/login', '/forgot-password', '/activate', '/reset-password']) {
    await page.goto(route);
    const statusCount = await page.locator('[role="status"]').count();
    const errorTargets = await page.locator('[data-error-for]').evaluateAll((nodes) =>
      nodes.map((node) => ({
        field: node.getAttribute('data-error-for'),
        focusable: node.getAttribute('tabindex') === '-1',
      })),
    );
    records.push({
      route,
      status_count: statusCount,
      error_targets: errorTargets,
      missing_describedby: await fieldsMissingErrorDescription(page),
    });
    expect(statusCount).toBeGreaterThan(0);
    expect(errorTargets.every((target) => target.focusable)).toBe(true);
  }
  a11yRecords.push({ collection_surface_error_association_review: records });
});

test.afterAll(async () => {
  await writeEvidenceJson('ACCESSIBILITY-REPORT.json', {
    schema_version: 'onetime.w12_100.accessibility_report.v1',
    generated_at: new Date().toISOString(),
    records: a11yRecords,
    external_actions: 0,
    production_mutations: 0,
  });
});

function seriousAxeViolations(results: Awaited<ReturnType<AxeBuilder['analyze']>>) {
  return results.violations.filter((violation) =>
    ['critical', 'serious'].includes(violation.impact ?? ''),
  );
}

async function fieldsMissingErrorDescription(page: Page) {
  return page.evaluate(() =>
    [
      ...document.querySelectorAll<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>(
        'input:not([type="hidden"]), select, textarea',
      ),
    ]
      .filter((field) => {
        const rect = field.getBoundingClientRect();
        return (
          rect.width > 0 &&
          rect.height > 0 &&
          Boolean(
            field.closest(
              '[data-signup-form], [data-login-form], [data-forgot-password-form], [data-activation-form], [data-reset-password-form]',
            ),
          )
        );
      })
      .filter((field) => {
        const name = field.getAttribute('name');
        if (!name) return false;
        const errorNode = field
          .closest('form')
          ?.querySelector<HTMLElement>(`[data-error-for="${CSS.escape(name)}"]`);
        if (!errorNode?.id) return true;
        return !(field.getAttribute('aria-describedby') ?? '').split(/\s+/).includes(errorNode.id);
      })
      .map((field) => ({ name: field.getAttribute('name'), id: field.id })),
  );
}
