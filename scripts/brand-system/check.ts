import { readFile, readdir, stat } from 'node:fs/promises';
import path from 'node:path';
import { oneTimeTokens } from '../../packages/brand-system/src/tokens.ts';
import {
  requiredRouteTemplates,
  routeBranding,
  tickerAllowlist,
} from '../../packages/brand-system/src/route-branding.ts';
import {
  componentContracts,
  preUsableScreenshotBan,
  visualBudgets,
} from '../../packages/brand-system/src/visual-contract.ts';

type BrandManifest = {
  schemaVersion: string;
  version: string;
  tokens: typeof oneTimeTokens & Record<string, unknown>;
  components: { required?: string[] };
  routes: Record<string, string>;
  ticker: { allowlist: string[] };
};

const root = process.cwd();
const brandRoot = path.join(root, 'packages/brand-system');
const manifestPath = path.join(brandRoot, 'manifest/one-time-brand.v1.json');
const schemaPath = path.join(brandRoot, 'manifest/one-time-brand.schema.json');
const tokenCssPath = path.join(brandRoot, 'src/tokens.css');
const exceptionPath = path.join(brandRoot, 'src/styles/exceptions.json');
const canonicalSourcePrefixes = [
  path.normalize('packages/brand-system/'),
  path.normalize('scripts/brand-system/'),
  path.normalize('ops/evidence/ot-82/'),
  path.normalize('tests/'),
];
const shippingClientExtensions = new Set(['.css', '.ts', '.tsx']);
const rawColorPattern = /#[0-9a-fA-F]{3,8}|rgba?\(/;
const fontFamilyPattern = /font-family\s*:/;
const externalFontPattern =
  /fonts\.(googleapis|gstatic)\.com|https?:\/\/[^'")\s]+(?:woff2?|ttf|otf)/i;
const runtimeStylePattern =
  /document\.createElement\(['"]style['"]\)|portalFeatureStyles|append\(style\)/;
const opacityPattern = /opacity\s*:\s*(0(?:\.\d+)?|0?\.\d+)/gi;

const failures: string[] = [];

function fail(message: string) {
  failures.push(message);
}

async function readJson<T>(filePath: string): Promise<T> {
  return JSON.parse(await readFile(filePath, 'utf8')) as T;
}

function rel(filePath: string) {
  return path.relative(root, filePath).replaceAll('\\', '/');
}

function isCanonical(relPath: string) {
  const normalized = path.normalize(relPath);
  return canonicalSourcePrefixes.some((prefix) => normalized.startsWith(prefix));
}

async function walk(dir: string): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true });
  const files: string[] = [];
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (['node_modules', 'dist', '.git', 'playwright-report'].includes(entry.name)) continue;
      files.push(...(await walk(fullPath)));
    } else {
      files.push(fullPath);
    }
  }
  return files;
}

function compareTokenGroup(
  manifest: Record<string, unknown>,
  tsTokens: Record<string, unknown>,
  group: string,
) {
  const manifestGroup = manifest[group] as Record<string, unknown> | undefined;
  const tsGroup = tsTokens[group] as Record<string, unknown> | undefined;
  if (!manifestGroup || !tsGroup) {
    fail(`Token group missing: ${group}`);
    return;
  }
  for (const [key, value] of Object.entries(tsGroup)) {
    if (manifestGroup[key] !== value) {
      fail(
        `Token drift: ${group}.${key} manifest=${String(manifestGroup[key])} ts=${String(value)}`,
      );
    }
  }
}

function cssBlocks(text: string) {
  const blocks: Array<{ selector: string; body: string }> = [];
  const blockPattern = /([^{}]+)\{([^{}]+)\}/g;
  for (const match of text.matchAll(blockPattern)) {
    blocks.push({ selector: (match[1] ?? '').trim(), body: match[2] ?? '' });
  }
  return blocks;
}

function assertNoFadedNormalText(relativePath: string, text: string) {
  if (!relativePath.endsWith('.css')) return;
  for (const block of cssBlocks(text)) {
    opacityPattern.lastIndex = 0;
    for (const match of block.body.matchAll(opacityPattern)) {
      const value = Number(match[1]);
      if (Number.isNaN(value) || value >= 0.72) continue;
      const allowed =
        block.selector.includes(':disabled') ||
        block.selector.includes('[disabled]') ||
        block.selector.includes('[hidden]') ||
        block.selector.includes('.skeleton') ||
        block.selector.includes('.mobile-current-link') ||
        block.selector.includes('.drawer-overlay');
      if (!allowed) {
        fail(`Low opacity on normal UI text/control: ${relativePath} selector=${block.selector}`);
      }
    }
  }
}

async function main() {
  const manifest = await readJson<BrandManifest>(manifestPath);
  const schema = await readJson<Record<string, unknown>>(schemaPath);
  const tokenCss = await readFile(tokenCssPath, 'utf8');
  await readJson<Record<string, unknown>>(exceptionPath);

  if (schema.$id !== 'https://onetimeonetime.local/schemas/one-time-brand.schema.json') {
    fail('Schema $id changed or missing.');
  }
  if (manifest.schemaVersion !== '1.0.0' || manifest.version !== '1.0.0') {
    fail('Manifest version must remain 1.0.0 for OT82.');
  }

  for (const group of [
    'color',
    'typography',
    'spacing',
    'radius',
    'border',
    'shadow',
    'motion',
    'focus',
    'layers',
    'breakpoints',
    'safeAreas',
    'density',
    'componentSizes',
  ]) {
    compareTokenGroup(manifest.tokens, oneTimeTokens, group);
  }
  for (const color of Object.values(oneTimeTokens.color)) {
    if (!tokenCss.includes(color)) fail(`CSS token output is missing ${color}`);
  }

  const manifestRoutes = Object.keys(manifest.routes).sort();
  const sourceRoutes = routeBranding.map((entry) => entry.route).sort();
  if (JSON.stringify(manifestRoutes) !== JSON.stringify(sourceRoutes)) {
    fail('Route registry drift between manifest and TypeScript route branding.');
  }
  for (const route of requiredRouteTemplates) {
    if (!manifestRoutes.includes(route)) fail(`Required route is missing branding: ${route}`);
  }
  const manifestTicker = new Set(manifest.ticker.allowlist);
  for (const route of sourceRoutes) {
    const sourceTicker = tickerAllowlist.has(route);
    if (manifestTicker.has(route) !== sourceTicker) fail(`Ticker allowlist drift for ${route}`);
  }
  const navigationLabels = new Map<string, string>();
  for (const entry of routeBranding) {
    if (!entry.navigationLabel || !entry.navigationGroup) continue;
    const key = `${entry.navigationGroup}:${entry.navigationLabel}`;
    const existing = navigationLabels.get(key);
    if (existing)
      fail(
        `Duplicate navigation label "${entry.navigationLabel}" on ${existing} and ${entry.route}`,
      );
    navigationLabels.set(key, entry.route);
  }
  const manifestComponents = new Set((manifest.components.required ?? []) as string[]);
  for (const contract of componentContracts) {
    if (!manifestComponents.has(contract.primitive)) {
      fail(`Component contract missing from manifest: ${contract.primitive}`);
    }
  }
  if (oneTimeTokens.componentSizes.touchTarget !== `${visualBudgets.minTouchTargetCssPx}px`) {
    fail('Touch target token no longer matches visual budget.');
  }
  if (visualBudgets.horizontalOverflow !== false) {
    fail('Visual overflow budget must remain false.');
  }
  if (preUsableScreenshotBan.length < 4) {
    fail('Pre-usable screenshot ban list is incomplete.');
  }

  const files = await walk(root);
  for (const file of files) {
    const relativePath = rel(file);
    const ext = path.extname(file);
    if (!shippingClientExtensions.has(ext)) continue;
    const text = await readFile(file, 'utf8');
    const shippingSource =
      relativePath.startsWith('apps/web/src/client/') || relativePath.startsWith('scripts/');
    if (!isCanonical(relativePath) && shippingSource && rawColorPattern.test(text)) {
      fail(`Raw UI color outside canonical brand system: ${relativePath}`);
    }
    if (!isCanonical(relativePath) && shippingSource && fontFamilyPattern.test(text)) {
      fail(`font-family declaration outside canonical typography files: ${relativePath}`);
    }
    if (externalFontPattern.test(text)) {
      fail(`External font URL is not allowed: ${relativePath}`);
    }
    if (!isCanonical(relativePath) && shippingSource && runtimeStylePattern.test(text)) {
      fail(`Runtime route-wide style injection is not allowed: ${relativePath}`);
    }
    if (shippingSource || relativePath.startsWith('packages/brand-system/src/styles/')) {
      assertNoFadedNormalText(relativePath, text);
    }
    if (
      relativePath.startsWith('apps/web/src/client/public/') &&
      /from ['"]react['"]|react-dom/.test(text)
    ) {
      fail(`Public client source must not import React: ${relativePath}`);
    }
  }

  const distPublic = path.join(root, 'dist/apps/web/public/assets/public.js');
  try {
    const distStat = await stat(distPublic);
    if (distStat.size > 45_000) fail('public.js exceeds 45KB raw budget.');
    const publicText = await readFile(distPublic, 'utf8');
    if (/react|React/.test(publicText)) fail('Built public.js contains React text.');
  } catch {
    process.stderr.write(
      'brand:check note: dist public bundle was not present; build budgets skipped.\n',
    );
  }

  if (failures.length) {
    for (const failure of failures) process.stderr.write(`brand:check failed: ${failure}\n`);
    process.exit(1);
  }
  process.stdout.write(
    JSON.stringify(
      {
        manifest: 'pass',
        token_drift: 'pass',
        routes: routeBranding.length,
        ticker_allowlist: [...tickerAllowlist],
        raw_source_scan: 'pass',
      },
      null,
      2,
    ),
  );
  process.stdout.write('\n');
}

await main();
