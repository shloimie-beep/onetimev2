import { execFile } from 'node:child_process';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';

import { afterEach, describe, expect, it } from 'vitest';

const execute = promisify(execFile);
const temporaryDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(
    temporaryDirectories
      .splice(0)
      .map((directory) => rm(directory, { recursive: true, force: true })),
  );
});

describe('learning delivery keyholder readiness', () => {
  it('reports configured state without protected value metadata', async () => {
    const keyholderDirectory = await mkdtemp(join(tmpdir(), 'one-time-keyholder-readiness-'));
    temporaryDirectories.push(keyholderDirectory);

    const protectedValue = 'synthetic-private-token-for-presence-only-verification';
    await writeFile(join(keyholderDirectory, 'vimeo-access-token.txt'), protectedValue);

    const { stdout } = await execute(
      process.execPath,
      ['--import', 'tsx', 'scripts/media/learning-delivery-readiness.ts'],
      {
        cwd: process.cwd(),
        env: { ...process.env, BNA_KEYHOLDER_DIR: keyholderDirectory },
      },
    );

    const report = JSON.parse(stdout) as {
      protected_inputs: Array<{ name: string; present: boolean }>;
    };
    const serializedReport = JSON.stringify(report);

    expect(report.protected_inputs).toContainEqual(
      expect.objectContaining({ name: 'vimeo_access_token', present: true }),
    );
    expect(serializedReport).not.toContain(protectedValue);
    expect(serializedReport).not.toContain(keyholderDirectory);
    expect(serializedReport).not.toContain('bytes');
    expect(serializedReport).not.toContain('sha256_prefix');
    expect(serializedReport).not.toContain('path_name');
  });
});
