import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { chromium } from '@playwright/test';
import { loadConfig } from '../../../packages/config/src/index.ts';
import { createMemoryPool, runMigrations } from '../../../packages/db/src/index.ts';
import { createApp } from '../../../apps/web/src/server/app.ts';
import { captureLead, createAccountUser } from '../../../packages/domain/src/index.ts';

const config = loadConfig({
  NODE_ENV: 'test',
  PUBLIC_BASE_URL: 'https://join.onetimeonetime.com',
  APP_VERSION: 'ot-12-screenshot',
  COMMIT_SHA: 'local',
  OUTBOX_TRANSPORT_MODE: 'sink',
});
const pool = createMemoryPool();
await runMigrations(pool);
await createAccountUser({
  pool,
  config,
  email: 'ot-admin@example.test',
  password: 'TestPassword!234',
  displayName: 'Test Admin',
  role: 'admin',
  mfaCapable: true,
});
await captureLead({
  pool,
  config,
  payload: {
    contact_name: 'Screenshot Parent',
    family_or_school: 'Screenshot Family',
    audience_type: 'family',
    location: 'Jerusalem',
    timezone: 'Asia/Jerusalem',
    email: 'screenshot-parent@example.test',
    phone: '',
    reminder_preference: 'email',
    reminder_consent: true,
    idempotency_key: 'ot-12-screenshot-lead',
    attribution: { landing_path: '/signup' },
  },
});

const app = createApp({ config, pool });
const server = await new Promise((resolve, reject) => {
  const started = app.listen(0, (error) => {
    if (error) reject(error);
    else resolve(started);
  });
});
const address = server.address();
if (!address || typeof address !== 'object') throw new Error('missing server address');
const baseUrl = `http://127.0.0.1:${address.port}`;
const outDir = path.resolve(process.cwd(), 'ops/evidence/ot-12/screenshots');
await mkdir(outDir, { recursive: true });

const browser = await chromium.launch();
const viewports = [
  ['360', { width: 360, height: 800 }],
  ['390', { width: 390, height: 844 }],
  ['tablet', { width: 768, height: 1024 }],
  ['desktop', { width: 1440, height: 900 }],
];

try {
  for (const [label, viewport] of viewports) {
    const page = await browser.newPage({ viewport });
    await page.goto(`${baseUrl}/login`);
    await page.getByLabel('Email').fill('ot-admin@example.test');
    await page.getByLabel('Password').fill('TestPassword!234');
    await page.getByRole('button', { name: 'Login' }).click();
    await page.waitForURL('**/app/crm');
    await page.getByRole('heading', { name: 'CRM' }).waitFor();
    await page.screenshot({
      path: path.join(outDir, `crm-list-${label}.png`),
      fullPage: true,
    });
    await page.getByRole('button', { name: /Screenshot Parent/ }).click();
    await page.getByRole('heading', { name: 'Screenshot Parent' }).waitFor();
    await page.screenshot({
      path: path.join(outDir, `crm-detail-${label}.png`),
      fullPage: true,
    });
    await page.close();
  }
} finally {
  await browser.close();
  await new Promise((resolve) => server.close(resolve));
  await pool.end();
}

console.warn(`wrote screenshots to ${outDir}`);
