import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';

describe('adult password surfaces', () => {
  it('keeps the internal bounds while presenting only plain six-character guidance', async () => {
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

    const customerFacingSources = await Promise.all(
      [
        'apps/web/src/client/app/portal-entry.tsx',
        'apps/web/src/client/app/parent/privacy/ParentPrivacyWorkspace.tsx',
        'apps/web/src/server/app.ts',
        'apps/web/src/server/features/signup/family/router.ts',
      ].map((path) => readFile(path, 'utf8')),
    );
    const customerFacingCopy = customerFacingSources.join('\n');
    expect(customerFacingCopy).toContain('At least 6 characters.');
    expect(customerFacingCopy).not.toMatch(/6 to 128|6(?:-|\u2013)128|between 6 and 128/iu);
    expect(customerFacingCopy).not.toMatch(
      /avoid common passwords|account details|name or email/iu,
    );

    const privacySource = await readFile(
      'apps/web/src/client/app/parent/privacy/ParentPrivacyWorkspace.tsx',
      'utf8',
    );
    expect(privacySource).toContain('currentPassword.length < 6 || currentPassword.length > 128');
    expect(privacySource).toContain('minLength={6}');
    expect(privacySource).toContain('maxLength={128}');
  });
});
