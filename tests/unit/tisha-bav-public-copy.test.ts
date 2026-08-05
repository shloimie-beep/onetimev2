import { execFileSync } from 'node:child_process';
import { access, mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const root = process.cwd();
const outputDir = path.resolve(root, 'dist/apps/web/public');
const retiredOutputs = [
  path.join(outputDir, 'tisha-bav.html'),
  path.join(outputDir, 'tisha-bav-live.html'),
] as const;

describe('Tisha BAv public-surface retirement', () => {
  it('removes stale generated pages and leaves no active client or build hooks', async () => {
    await mkdir(outputDir, { recursive: true });
    await Promise.all(
      retiredOutputs.map((output) => writeFile(output, '<h1>STALE ACTIVE EVENT PAGE</h1>')),
    );

    execFileSync(process.execPath, ['--import', 'tsx', 'scripts/build-public-pages.ts'], {
      cwd: root,
      env: {
        ...process.env,
        PUBLIC_SITE_ORIGIN: 'https://join.onetimeonetime.com',
      },
      stdio: 'pipe',
    });

    for (const output of retiredOutputs) {
      await expect(access(output), output).rejects.toMatchObject({ code: 'ENOENT' });
    }
    expect(await readFile(path.join(outputDir, 'index.html'), 'utf8')).toContain('<!doctype html>');

    const [buildSource, publicEntrySource] = await Promise.all([
      readFile(path.resolve(root, 'scripts/build-public-pages.ts'), 'utf8'),
      readFile(path.resolve(root, 'apps/web/src/client/public/public-entry.ts'), 'utf8'),
    ]);

    expect(buildSource).not.toContain('function tishaBavLandingPage');
    expect(buildSource).not.toContain('function tishaBavLivePage');
    expect(buildSource).not.toMatch(
      /writeFile\(\s*path\.join\(outDir, 'tisha-bav(?:-live)?\.html'/u,
    );
    expect(buildSource).toContain("rm(path.join(outDir, 'tisha-bav.html'), { force: true })");
    expect(buildSource).toContain("rm(path.join(outDir, 'tisha-bav-live.html'), { force: true })");

    for (const activeHook of [
      '[data-event-registration-form]',
      '[data-event-join-form]',
      '[data-event-open-modal]',
      '/api/v1/events/tisha-bav-2026/register',
      '/api/v1/events/tisha-bav-2026/join',
      '/api/v1/events/tisha-bav-2026/redirect',
      'tisha-bav-join-',
    ]) {
      expect(publicEntrySource, activeHook).not.toContain(activeHook);
    }

    await expect(
      access(
        path.resolve(
          root,
          'apps/web/public/assets/events/tisha-bav-2026/tisha-bav-social-card-v20260722.png',
        ),
      ),
    ).resolves.toBeUndefined();
    await expect(
      access(path.resolve(root, 'ops/archive/tisha-bav-template/manifest.yaml')),
    ).resolves.toBeUndefined();
  }, 30_000);
});
