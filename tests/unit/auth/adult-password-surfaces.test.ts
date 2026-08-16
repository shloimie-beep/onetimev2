import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';

describe('adult password surfaces', () => {
  it('uses the shared six-to-128-character bounds without a composition requirement', async () => {
    for (const path of [
      'apps/web/src/client/app/portal-entry.tsx',
      'apps/web/src/client/app/crm-entry.tsx',
    ]) {
      const source = await readFile(path, 'utf8');
      expect(source).not.toMatch(/newPassword\.length >= 10|minLength=\{10\}/u);
      expect(source).not.toContain('at least one letter and one number');
      expect(source).toContain('newPassword.length >= 6');
      expect(source).toContain('minLength={6}');
      expect(source).toContain('maxLength={128}');
    }

    const privacySource = await readFile(
      'apps/web/src/client/app/parent/privacy/ParentPrivacyWorkspace.tsx',
      'utf8',
    );
    expect(privacySource).toContain('currentPassword.length < 6 || currentPassword.length > 128');
    expect(privacySource).toContain('minLength={6}');
    expect(privacySource).toContain('maxLength={128}');
  });
});
