import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { promptFingerprint } from '../../../scripts/highlevel/prompt-fingerprint.ts';

const repoRoot = process.cwd();

type CurrentRegistry = {
  prompts: Array<{ file_path: string; sha256: string }>;
};

describe('HighLevel prompt fingerprint portability', () => {
  it('keeps every registered prompt fingerprint identical across LF, CRLF, and CR inputs', async () => {
    const current = JSON.parse(
      await readFile(path.join(repoRoot, 'integrations/highlevel/registry/current.json'), 'utf8'),
    ) as CurrentRegistry;

    for (const record of current.prompts) {
      const source = await readFile(path.join(repoRoot, record.file_path), 'utf8');
      const lf = source.replaceAll('\r\n', '\n').replaceAll('\r', '\n');
      const fingerprints = [
        promptFingerprint(lf),
        promptFingerprint(lf.replaceAll('\n', '\r\n')),
        promptFingerprint(lf.replaceAll('\n', '\r')),
      ];

      expect(new Set(fingerprints).size, record.file_path).toBe(1);
      expect(record.sha256, record.file_path).toBe(fingerprints[0]);
    }
  });
});
