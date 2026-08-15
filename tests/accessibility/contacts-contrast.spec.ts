import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { AxeBuilder } from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { W12_E2E_ADMIN_COOKIES } from '../support/w12-portal-test-lab-session.ts';

type ContrastSample = {
  selector: string;
  text: string;
  foreground: string;
  background: string;
  ratio: number;
  font_size: string;
  font_weight: string;
};

type SurfaceResult = {
  viewport: string;
  surface: 'list' | 'detail';
  theme: 'dark';
  axe_violations: number;
  horizontal_overflow: boolean;
  minimum_contrast_ratio: number;
  samples: ContrastSample[];
  failures: ContrastSample[];
  screenshot: string;
};

const evidencePhase = process.env.CONTACTS_CONTRAST_EVIDENCE_PHASE;
const evidenceRoot = evidencePhase
  ? path.resolve(process.cwd(), 'ops/evidence/contacts-contrast-20260815', evidencePhase)
  : path.resolve(process.cwd(), 'test-results/contacts-contrast');
const screenshotRoot = path.join(evidenceRoot, 'screenshots');
const viewports = [
  { name: '390x844', width: 390, height: 844 },
  { name: '768x1024', width: 768, height: 1024 },
  { name: '1440x1000', width: 1440, height: 1000 },
] as const;

test.describe('Contacts semantic contrast', () => {
  test.setTimeout(120_000);

  test('proves mounted list and detail contrast across the responsive matrix', async ({ page }) => {
    const apiRequests: string[] = [];
    page.on('request', (request) => {
      const pathname = new URL(request.url()).pathname;
      if (pathname.startsWith('/api/')) apiRequests.push(pathname);
    });

    await mkdir(screenshotRoot, { recursive: true });
    await page.context().addCookies([...W12_E2E_ADMIN_COOKIES]);
    const results: SurfaceResult[] = [];

    for (const viewport of viewports) {
      await page.setViewportSize(viewport);
      await page.goto('/app/contacts');
      await applyExactBaseContrastIfRequested(page);
      await waitForUsableList(page);
      await expect(page.getByRole('heading', { name: 'Contacts', exact: true })).toBeVisible();
      await expect(page.getByText('Students remain One Time-only.')).toBeVisible();
      results.push(await inspectSurface(page, viewport.name, 'list', '.app-workspace'));

      await page.locator('[data-contact-open="e2e-public-parent"]:visible').first().click();
      await waitForUsableDetail(page);
      await expect(page.getByRole('heading', { name: 'Test Parent', exact: true })).toBeVisible();
      results.push(await inspectSurface(page, viewport.name, 'detail', '.app-workspace'));
    }

    const report = {
      generated_at: new Date().toISOString(),
      source_sha: process.env.GITHUB_SHA ?? 'local-exact-0ed5-derived-candidate',
      evidence_phase: evidencePhase ?? 'candidate-test',
      exact_base_style_emulation: evidencePhase === 'before',
      route: '/app/contacts',
      role: 'admin',
      themes: ['dark'],
      theme_note: 'The authenticated One Time shell currently exposes one dark theme.',
      minimum_required_ratio: 4.5,
      adult_account_scope_only: true,
      student_ghl_contacts_created: 0,
      results,
      summary: {
        surfaces: results.length,
        axe_violations: results.reduce((total, result) => total + result.axe_violations, 0),
        contrast_failures: results.reduce((total, result) => total + result.failures.length, 0),
        minimum_contrast_ratio: Math.min(...results.map((result) => result.minimum_contrast_ratio)),
        horizontal_overflow: results.some((result) => result.horizontal_overflow),
      },
    };
    await writeFile(
      path.join(evidenceRoot, 'contrast-report.json'),
      `${JSON.stringify(report, null, 2)}\n`,
    );

    if (evidencePhase !== 'before') {
      expect(report.summary.axe_violations).toBe(0);
      expect(report.summary.contrast_failures).toBe(0);
      expect(report.summary.minimum_contrast_ratio).toBeGreaterThanOrEqual(4.5);
    }
    expect(report.summary.horizontal_overflow).toBe(false);
    expect(
      apiRequests.filter(
        (pathname) => pathname.includes('/students') || pathname.includes('/highlevel'),
      ),
    ).toEqual([]);
  });
});

async function inspectSurface(
  page: Page,
  viewport: string,
  surface: 'list' | 'detail',
  selector: string,
): Promise<SurfaceResult> {
  const axe = await new AxeBuilder({ page }).include('.app-workspace').analyze();
  const horizontalOverflow = await page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
  );
  const colorScheme = await page.evaluate(
    () => getComputedStyle(document.documentElement).colorScheme,
  );
  expect(colorScheme).toContain('dark');

  const samples = await collectTextContrast(page, selector);
  expect(samples.length).toBeGreaterThan(0);
  const failures = samples.filter((sample) => sample.ratio < 4.5);
  const screenshotPath = path.join(screenshotRoot, `contacts-${surface}-${viewport}.png`);
  await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
  await page.screenshot({ path: screenshotPath, fullPage: true, animations: 'disabled' });

  return {
    viewport,
    surface,
    theme: 'dark',
    axe_violations: axe.violations.length,
    horizontal_overflow: horizontalOverflow,
    minimum_contrast_ratio: Math.min(...samples.map((sample) => sample.ratio)),
    samples,
    failures,
    screenshot: path.relative(process.cwd(), screenshotPath).replaceAll('\\', '/'),
  };
}

async function collectTextContrast(page: Page, rootSelector: string): Promise<ContrastSample[]> {
  return page.locator(rootSelector).evaluate((root) => {
    type Rgba = { r: number; g: number; b: number; a: number };

    function rgba(value: string): Rgba {
      const channels = value.match(/[\d.]+/gu)?.map(Number) ?? [];
      return {
        r: channels[0] ?? 0,
        g: channels[1] ?? 0,
        b: channels[2] ?? 0,
        a: channels[3] ?? 1,
      };
    }

    function composite(foreground: Rgba, background: Rgba): Rgba {
      const alpha = foreground.a + background.a * (1 - foreground.a);
      if (alpha === 0) return { r: 0, g: 0, b: 0, a: 0 };
      return {
        r: (foreground.r * foreground.a + background.r * background.a * (1 - foreground.a)) / alpha,
        g: (foreground.g * foreground.a + background.g * background.a * (1 - foreground.a)) / alpha,
        b: (foreground.b * foreground.a + background.b * background.a * (1 - foreground.a)) / alpha,
        a: alpha,
      };
    }

    function effectiveBackground(element: Element): Rgba {
      const layers: Rgba[] = [];
      let current: Element | null = element;
      while (current) {
        layers.push(rgba(getComputedStyle(current).backgroundColor));
        current = current.parentElement;
      }
      let result: Rgba = { r: 255, g: 255, b: 255, a: 1 };
      for (const layer of layers.reverse()) result = composite(layer, result);
      return result;
    }

    function luminance(color: Rgba) {
      const linear = [color.r, color.g, color.b].map((channel) => {
        const value = channel / 255;
        return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
      });
      return 0.2126 * linear[0]! + 0.7152 * linear[1]! + 0.0722 * linear[2]!;
    }

    function contrast(foreground: Rgba, background: Rgba) {
      const foregroundLuminance = luminance(foreground);
      const backgroundLuminance = luminance(background);
      return (
        (Math.max(foregroundLuminance, backgroundLuminance) + 0.05) /
        (Math.min(foregroundLuminance, backgroundLuminance) + 0.05)
      );
    }

    function cssColor(color: Rgba) {
      return `rgb(${Math.round(color.r)}, ${Math.round(color.g)}, ${Math.round(color.b)})`;
    }

    function selectorFor(element: Element) {
      const tag = element.tagName.toLowerCase();
      const id = element.id ? `#${element.id}` : '';
      const classes = [...element.classList]
        .slice(0, 3)
        .map((name) => `.${name}`)
        .join('');
      return `${tag}${id}${classes}`;
    }

    const textSamples = [...root.querySelectorAll<HTMLElement>('*')]
      .filter((element) => {
        const style = getComputedStyle(element);
        const rect = element.getBoundingClientRect();
        const directText = [...element.childNodes]
          .filter((node) => node.nodeType === Node.TEXT_NODE)
          .map((node) => node.textContent ?? '')
          .join('')
          .trim();
        return (
          directText.length > 0 &&
          rect.width > 0 &&
          rect.height > 0 &&
          style.display !== 'none' &&
          style.visibility !== 'hidden'
        );
      })
      .map((element) => {
        const style = getComputedStyle(element);
        const background = effectiveBackground(element);
        const foreground = composite(rgba(style.color), background);
        const text = [...element.childNodes]
          .filter((node) => node.nodeType === Node.TEXT_NODE)
          .map((node) => node.textContent ?? '')
          .join('')
          .trim()
          .replace(/\s+/gu, ' ')
          .slice(0, 80);
        return {
          selector: selectorFor(element),
          text,
          foreground: cssColor(foreground),
          background: cssColor(background),
          ratio: Number(contrast(foreground, background).toFixed(2)),
          font_size: style.fontSize,
          font_weight: style.fontWeight,
        };
      });
    const placeholderSamples = [
      ...root.querySelectorAll<HTMLInputElement | HTMLTextAreaElement>('[placeholder]'),
    ]
      .filter((element) => {
        const style = getComputedStyle(element);
        const rect = element.getBoundingClientRect();
        return (
          element.placeholder.length > 0 &&
          rect.width > 0 &&
          rect.height > 0 &&
          style.display !== 'none' &&
          style.visibility !== 'hidden'
        );
      })
      .map((element) => {
        const style = getComputedStyle(element, '::placeholder');
        const background = effectiveBackground(element);
        const foreground = composite(rgba(style.color), background);
        return {
          selector: `${selectorFor(element)}::placeholder`,
          text: element.placeholder,
          foreground: cssColor(foreground),
          background: cssColor(background),
          ratio: Number(contrast(foreground, background).toFixed(2)),
          font_size: style.fontSize,
          font_weight: style.fontWeight,
        };
      });
    return [...textSamples, ...placeholderSamples];
  });
}

async function waitForUsableList(page: Page) {
  await page.waitForFunction(() => performance.getEntriesByName('ot-crm-list-usable').length > 0);
}

async function waitForUsableDetail(page: Page) {
  await page.waitForFunction(() => performance.getEntriesByName('ot-crm-detail-usable').length > 0);
}

async function applyExactBaseContrastIfRequested(page: Page) {
  if (evidencePhase !== 'before') return;
  await page.evaluate(() => {
    document.documentElement.style.setProperty('--ot-color-text-secondary', '#c8d6d9');
    const stylesheet = [...document.styleSheets].find((candidate) => {
      try {
        return candidate.cssRules.length > 0;
      } catch {
        return false;
      }
    });
    if (!stylesheet) throw new Error('Authenticated stylesheet was not available.');
    stylesheet.insertRule(
      `.toolbar-filters input::placeholder,
       .contact-form input::placeholder,
       .contact-form textarea::placeholder { color: revert; opacity: revert; }`,
      stylesheet.cssRules.length,
    );
  });
}
