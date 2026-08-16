import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { expect, type Page } from '@playwright/test';
import { W12_E2E_ADMIN_COOKIES } from '../../support/w12-portal-test-lab-session.ts';

export type ViewportSpec = { label: string; width: number; height: number };
export type RouteProbe = {
  id: string;
  path: string;
  audience: 'public' | 'owner' | 'parent' | 'student' | 'test_lab' | 'failure';
  expectedHeading?: RegExp | string;
  collectionSurface?: boolean;
};

export const requiredViewports: ViewportSpec[] = [
  { label: '360x800', width: 360, height: 800 },
  { label: '390x844', width: 390, height: 844 },
  { label: 'tablet', width: 768, height: 1024 },
  { label: 'desktop', width: 1440, height: 1000 },
];
export const mobileViewport = requiredViewports[1]!;
export const desktopViewport = requiredViewports[3]!;
export const evidenceRoot = path.resolve(process.cwd(), 'ops/evidence/w12-100');
export const screenshotRoot = path.join(evidenceRoot, 'screenshots');

export const publicRouteProbes: RouteProbe[] = [
  {
    id: 'landing',
    path: '/',
    audience: 'public',
    expectedHeading: 'Help your son love learning Mishnayos.',
  },
  {
    id: 'signup',
    path: '/signup',
    audience: 'public',
    expectedHeading: 'Create Family Account',
    collectionSurface: true,
  },
  { id: 'privacy', path: '/privacy', audience: 'public', expectedHeading: /Privacy/i },
  { id: 'terms', path: '/terms', audience: 'public', expectedHeading: /Terms/i },
  {
    id: 'login',
    path: '/login',
    audience: 'public',
    expectedHeading: 'Welcome back',
    collectionSurface: true,
  },
  {
    id: 'activation',
    path: '/activate',
    audience: 'public',
    expectedHeading: 'Set your password',
    collectionSurface: true,
  },
  {
    id: 'reset_recovery',
    path: '/forgot-password',
    audience: 'public',
    expectedHeading: 'Reset your password',
    collectionSurface: true,
  },
  {
    id: 'reset_password',
    path: '/reset-password',
    audience: 'public',
    expectedHeading: 'Choose a new password',
    collectionSurface: true,
  },
  {
    id: '404',
    path: '/w12-100-missing-route',
    audience: 'failure',
    expectedHeading: /not found/i,
  },
];

export const ownerRouteProbes: RouteProbe[] = [
  { id: 'dashboard', path: '/app/dashboard', audience: 'owner', expectedHeading: 'Dashboard' },
  { id: 'contacts', path: '/app/contacts', audience: 'owner', expectedHeading: 'Contacts' },
  { id: 'contact_detail', path: '/app/contacts/__synthetic__', audience: 'owner' },
  {
    id: 'communications',
    path: '/app/communications',
    audience: 'owner',
    expectedHeading: 'Communications',
  },
  {
    id: 'classes',
    path: '/app/classroom/classes',
    audience: 'owner',
    expectedHeading: 'Classroom',
  },
  {
    id: 'class_detail',
    path: '/app/classroom/occurrences/e2e_class_occurrence',
    audience: 'owner',
    expectedHeading: 'Classroom',
  },
  {
    id: 'content',
    path: '/app/content',
    audience: 'owner',
    expectedHeading: 'Content',
  },
  {
    id: 'billing',
    path: '/app/billing-access',
    audience: 'owner',
    expectedHeading: 'Billing & Access',
  },
  { id: 'support', path: '/app/support', audience: 'owner', expectedHeading: 'Support' },
];

export async function writeEvidenceJson(name: string, data: unknown) {
  await mkdir(evidenceRoot, { recursive: true });
  await writeFile(path.join(evidenceRoot, name), `${JSON.stringify(data, null, 2)}\n`, 'utf8');
}

export async function loginAs(
  page: Page,
  role: 'owner' | 'admin' | 'parent' | 'student' | 'viewer',
  returnTo: string,
) {
  const credentials = {
    owner: ['ot-owner@example.test', 'OwnerPassword!234'],
    admin: ['ot-admin@example.test', 'TestPassword!234'],
    parent: ['ot-parent@example.test', 'ParentPassword!234'],
    student: ['ot-student@example.test', 'StudentPassword!234'],
    viewer: ['viewer@example.test', 'ViewerPass!234'],
  } as const;
  const [email, password] = credentials[role];
  await page.goto(`/login?return_to=${encodeURIComponent(returnTo)}`);
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password').fill(password);
  await page.getByRole('button', { name: 'Login' }).click();
  await page.waitForURL(`**${returnTo}`);
}

export async function useW12AdminSession(page: Page) {
  await page.context().addCookies([...W12_E2E_ADMIN_COOKIES]);
}

export async function waitForProbeReady(page: Page, probe: RouteProbe) {
  if (probe.expectedHeading) {
    await expect(page.getByRole('heading', { name: probe.expectedHeading }).first()).toBeVisible();
    return;
  }
  if (probe.id === 'crm_contact_detail') {
    await expect(page.locator('[data-usable="crm-detail"]')).toBeVisible();
    return;
  }
  await page.waitForLoadState('domcontentloaded');
}

export async function assertNoHorizontalOverflow(page: Page) {
  const metrics = await horizontalOverflowMetrics(page);
  expect(metrics.scrollWidth).toBeLessThanOrEqual(metrics.clientWidth + 1);
  expect(metrics.bodyScrollWidth).toBeLessThanOrEqual(metrics.clientWidth + 1);
  return metrics;
}

export async function horizontalOverflowMetrics(page: Page) {
  return page.evaluate(() => ({
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
    bodyScrollWidth: document.body?.scrollWidth ?? 0,
  }));
}

export async function collectRouteSnapshot(
  page: Page,
  probe: RouteProbe,
  viewport: ViewportSpec,
  browserName: string,
) {
  const response = await page.goto(probe.path, { waitUntil: 'domcontentloaded' });
  let readinessError = '';
  try {
    await waitForProbeReady(page, probe);
  } catch (error) {
    const message =
      error instanceof Error ? (error.message.split('\n')[0] ?? error.message) : String(error);
    readinessError = stripAnsi(message);
  }
  await page.waitForLoadState('networkidle').catch(() => undefined);
  const overflow = await horizontalOverflowMetrics(page);
  const snapshot = await page.evaluate(() => {
    const links = [...document.querySelectorAll<HTMLAnchorElement>('a[href]')].map((link) => ({
      text: link.textContent?.trim() ?? '',
      href: link.getAttribute('href') ?? '',
    }));
    const text = document.body.innerText.slice(0, 4000);
    return {
      title: document.title,
      headings: [...document.querySelectorAll<HTMLHeadingElement>('h1, h2')]
        .map((heading) => heading.textContent?.trim() ?? '')
        .filter(Boolean)
        .slice(0, 8),
      canonical: document.querySelector<HTMLLinkElement>('link[rel="canonical"]')?.href ?? null,
      robots: document.querySelector<HTMLMetaElement>('meta[name="robots"]')?.content ?? null,
      ogTitle:
        document.querySelector<HTMLMetaElement>('meta[property="og:title"]')?.content ?? null,
      ogDescription:
        document.querySelector<HTMLMetaElement>('meta[property="og:description"]')?.content ?? null,
      ogUrl: document.querySelector<HTMLMetaElement>('meta[property="og:url"]')?.content ?? null,
      scripts: [...document.querySelectorAll<HTMLScriptElement>('script[src]')].map((script) =>
        script.src.replace(location.origin, ''),
      ),
      stylesheets: [...document.querySelectorAll<HTMLLinkElement>('link[rel="stylesheet"]')].map(
        (link) => link.href.replace(location.origin, ''),
      ),
      links,
      textSampleHash: textHash(text),
    };

    function textHash(value: string) {
      let hash = 0;
      for (let index = 0; index < value.length; index += 1) {
        hash = (Math.imul(31, hash) + value.charCodeAt(index)) | 0;
      }
      return `domhash:${Math.abs(hash).toString(16)}`;
    }
  });
  const record = {
    id: probe.id,
    path: probe.path,
    audience: probe.audience,
    browser: browserName,
    viewport: viewport.label,
    status: response?.status() ?? null,
    ok: response?.ok() ?? false,
    readiness_error: readinessError || null,
    overflow,
    missing_accessible_names: await visibleControlsMissingNames(page),
    safety_findings: await customerSafetyFindings(page),
    privacy_terms: privacyTermsPresence(snapshot.links),
    metadata: {
      title: snapshot.title,
      headings: snapshot.headings,
      canonical: snapshot.canonical,
      robots: snapshot.robots,
      og_title_present: Boolean(snapshot.ogTitle),
      og_description_present: Boolean(snapshot.ogDescription),
      og_url: snapshot.ogUrl,
      scripts: snapshot.scripts,
      stylesheets: snapshot.stylesheets,
      text_sample_hash: snapshot.textSampleHash,
    },
  };
  return record;
}

export function privacyTermsPresence(links: Array<{ text: string; href: string }>) {
  return {
    privacy: links.some((link) => link.href === '/privacy' || /privacy/i.test(link.text)),
    terms: links.some((link) => link.href === '/terms' || /terms/i.test(link.text)),
  };
}

export async function visibleControlsMissingNames(page: Page) {
  return page.evaluate(() =>
    [
      ...document.querySelectorAll<HTMLElement>(
        'a[href], button, input:not([type="hidden"]), select, textarea',
      ),
    ]
      .filter((element) => {
        const rect = element.getBoundingClientRect();
        const style = getComputedStyle(element);
        return (
          rect.width > 0 &&
          rect.height > 0 &&
          style.display !== 'none' &&
          style.visibility !== 'hidden' &&
          !element.hasAttribute('disabled')
        );
      })
      .map((element) => {
        const id = element.getAttribute('id');
        const labelledBy = element.getAttribute('aria-labelledby');
        const explicitLabel = id
          ? document.querySelector<HTMLLabelElement>(`label[for="${CSS.escape(id)}"]`)?.innerText
          : '';
        const labelledByText = labelledBy
          ? labelledBy
              .split(/\s+/)
              .map((labelId) => document.getElementById(labelId)?.innerText ?? '')
              .join(' ')
          : '';
        const name = [
          element.getAttribute('aria-label') ?? '',
          labelledByText,
          explicitLabel ?? '',
          element.closest('label')?.innerText ?? '',
          element.textContent ?? '',
          element.getAttribute('title') ?? '',
          element.getAttribute('value') ?? '',
        ]
          .join(' ')
          .replace(/\s+/g, ' ')
          .trim();
        return {
          tag: element.tagName.toLowerCase(),
          id: id ?? '',
          type: element.getAttribute('type') ?? '',
          href: element.getAttribute('href') ?? '',
          name,
        };
      })
      .filter((control) => !control.name)
      .map(({ tag, id, type, href }) => ({ tag, id, type, href })),
  );
}

export async function customerSafetyFindings(page: Page) {
  const text = await page
    .locator('body')
    .innerText()
    .catch(() => '');
  const html = await page.content();
  const findings: string[] = [];
  const checks: Array<[RegExp, string]> = [
    [/\bBNA\b/i, 'bna_terminology_visible'],
    [/GoHighLevel|LeadConnector|LeadConnectorHQ/i, 'ghl_terminology_visible'],
    [/View as Rabbi|Super Admin|Operations diagnostics/i, 'internal_role_or_diagnostic_visible'],
    [
      /SQLSTATE|stack trace|node_modules|Unhandled|ReferenceError|TypeError/i,
      'technical_diagnostic_visible',
    ],
    [
      /\$67\/month afterward|No card today|ROSH HASHANAH SPECIAL/i,
      'stale_pricing_or_campaign_copy_visible',
    ],
  ];
  for (const [pattern, code] of checks) {
    if (pattern.test(text) || pattern.test(html)) findings.push(code);
  }
  return findings;
}

export async function createSyntheticContact(page: Page) {
  const email = `w12-100-${Date.now()}@example.test`;
  const suffix = Date.now();
  const contactName = `W12 100 Parent ${suffix}`;
  await page.goto('/signup');
  await page.getByLabel('First name', { exact: true }).fill('W12 100 Parent');
  await page.getByLabel('Last name', { exact: true }).fill(String(suffix));
  await page.getByRole('textbox', { name: 'Adult account email' }).fill(email);
  await page.getByLabel('Password', { exact: true }).fill('StrongPassword!234');
  await page.getByLabel('Confirm password').fill('StrongPassword!234');
  await page.getByLabel(/I agree to the Terms/).check();
  const submit = page.getByRole('button', { name: 'Create your Family account' });
  await expect(submit).toBeVisible();
  await submit.click();
  await expect(page).toHaveURL(/\/signup\/received\?state=session_pending&email=pending$/u);
  await expect(page.getByRole('heading', { name: 'Signup received' })).toBeVisible();
  await expect(page.getByText('No card was charged by this signup form.')).toBeVisible();
  return { email, contactName };
}

export async function openSyntheticContactDetail(page: Page, contactName: string, email: string) {
  await page.goto('/app/contacts');
  await page.waitForFunction(() => performance.getEntriesByName('ot-crm-list-usable').length > 0);
  await page.getByLabel('Search').fill(email);
  await page.getByRole('button', { name: 'Apply' }).click();
  await expect(page.getByRole('button', { name: new RegExp(contactName) })).toBeVisible();
  await page.getByRole('button', { name: new RegExp(contactName) }).click();
  await expect(page.getByRole('heading', { name: contactName })).toBeVisible();
}

export async function screenshotWithHash(page: Page, fileName: string) {
  await mkdir(screenshotRoot, { recursive: true });
  const filePath = path.join(screenshotRoot, fileName);
  await page.screenshot({ path: filePath, fullPage: false });
  const buffer = await readFile(filePath);
  return {
    path: filePath,
    sha256: createHash('sha256').update(buffer).digest('hex'),
    bytes: buffer.byteLength,
  };
}

export function summarizeFindings(records: Array<Record<string, unknown>>) {
  const defects: Array<Record<string, unknown>> = [];
  for (const record of records) {
    const id = String(record.id ?? 'unknown');
    const pathValue = String(record.path ?? '');
    const viewport = String(record.viewport ?? '');
    const safety = record.safety_findings;
    const status = Number(record.status ?? 0);
    const isExpectedFailureState = id === '404' && status === 404;
    if (!isExpectedFailureState && (status >= 400 || status === 0)) {
      defects.push({ id, path: pathValue, viewport, kind: 'route_status', status });
    }
    const overflow = record.overflow as
      { clientWidth?: number; scrollWidth?: number; bodyScrollWidth?: number } | undefined;
    if (
      overflow &&
      ((overflow.scrollWidth ?? 0) > (overflow.clientWidth ?? 0) + 1 ||
        (overflow.bodyScrollWidth ?? 0) > (overflow.clientWidth ?? 0) + 1)
    ) {
      defects.push({ id, path: pathValue, viewport, kind: 'horizontal_overflow', overflow });
    }
    const readinessError = record.readiness_error;
    if (typeof readinessError === 'string' && readinessError) {
      defects.push({
        id,
        path: pathValue,
        viewport,
        kind: 'route_readiness',
        message: readinessError,
      });
    }
    if (Array.isArray(safety) && safety.length > 0) {
      defects.push({ id, path: pathValue, viewport, kind: 'customer_safety', codes: safety });
    }
    const missingNames = record.missing_accessible_names;
    if (Array.isArray(missingNames) && missingNames.length > 0) {
      defects.push({
        id,
        path: pathValue,
        viewport,
        kind: 'accessible_names',
        count: missingNames.length,
      });
    }
    const collection = publicRouteProbes.find((probe) => probe.id === id)?.collectionSurface;
    const privacyTerms = record.privacy_terms as { privacy?: boolean; terms?: boolean } | undefined;
    if (collection && privacyTerms && (!privacyTerms.privacy || !privacyTerms.terms)) {
      defects.push({
        id,
        path: pathValue,
        viewport,
        kind: 'collection_surface_privacy_terms',
        privacy: privacyTerms.privacy === true,
        terms: privacyTerms.terms === true,
      });
    }
  }
  return defects;
}

function stripAnsi(value: string) {
  const escapeCharacter = String.fromCharCode(27);
  return value.replace(new RegExp(`${escapeCharacter}\\[[0-9;]*m`, 'g'), '');
}
