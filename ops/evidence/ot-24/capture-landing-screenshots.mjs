import { spawn } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { chromium } from '@playwright/test';

const baseUrl = 'http://127.0.0.1:3100';
const outputDir = path.resolve('ops/evidence/ot-24/screenshots');
const viewports = [
  { name: 'landing-360x800.png', width: 360, height: 800 },
  { name: 'landing-390x844.png', width: 390, height: 844 },
  { name: 'landing-desktop.png', width: 1440, height: 1000 },
];

async function waitForServer() {
  const deadline = Date.now() + 30_000;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(`${baseUrl}/health`);
      if (response.ok) return;
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 250));
    }
  }
  throw new Error('Timed out waiting for local test server.');
}

function startServer() {
  const child = spawn(process.execPath, ['--import', 'tsx', 'tests/support/test-server.ts'], {
    env: {
      ...process.env,
      NODE_ENV: 'test',
      OT_TEST_DATABASE: 'memory',
      RUN_MIGRATIONS_ON_STARTUP: 'true',
      PORT: '3100',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  child.stdout.on('data', () => undefined);
  child.stderr.on('data', () => undefined);
  return child;
}

const server = startServer();
const screenshots = [];

try {
  await mkdir(outputDir, { recursive: true });
  await waitForServer();
  const browser = await chromium.launch();
  const page = await browser.newPage();

  for (const viewport of viewports) {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await page.goto(baseUrl, { waitUntil: 'load' });
    await page.evaluate(async () => {
      const images = Array.from(document.images);
      await Promise.all(
        images.map(async (image) => {
          image.loading = 'eager';
          if (!image.complete) {
            await new Promise((resolve) => {
              image.addEventListener('load', resolve, { once: true });
              image.addEventListener('error', resolve, { once: true });
            });
          }
          if (image.complete && image.naturalWidth > 0 && 'decode' in image) {
            await image.decode().catch(() => undefined);
          }
        }),
      );
    });
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
    );
    if (overflow) throw new Error(`Horizontal overflow detected at ${viewport.width}x${viewport.height}`);
    const screenshotPath = path.join(outputDir, viewport.name);
    await page.screenshot({ path: screenshotPath, fullPage: true });
    screenshots.push({
      viewport: `${viewport.width}x${viewport.height}`,
      path: path.relative(process.cwd(), screenshotPath).replaceAll('\\', '/'),
    });
  }

  await browser.close();
  await writeFile(
    path.resolve('ops/evidence/ot-24/PR1-LANDING-SCREENSHOTS.md'),
    `# OT-24 PR #1 Landing Screenshots

Generated against local test server at ${baseUrl} after \`npm run build\`.

${screenshots.map((item) => `- ${item.viewport}: \`${item.path}\``).join('\n')}

All captures asserted no horizontal overflow before saving.
`,
  );
  process.stdout.write(`Captured ${screenshots.length} OT-24 landing screenshots.\n`);
} finally {
  server.kill('SIGTERM');
}
