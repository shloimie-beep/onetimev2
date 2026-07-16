import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

describe('account lifecycle PostgreSQL parameter contracts', () => {
  it('keeps student suspend/restore account update placeholders contiguous', async () => {
    const source = await readFile(
      path.resolve('packages/domain/src/accounts/lifecycle.ts'),
      'utf8',
    );
    const updateBlock = source.match(
      /await client\.query\(\s*`UPDATE onetime\.account_users[\s\S]*?\],\s*\);/,
    )?.[0];

    expect(updateBlock).toBeTruthy();
    expect(updateBlock).toContain('SET status = $4');
    expect(updateBlock).toContain("CASE WHEN $4 = 'disabled'");
    expect(updateBlock).toContain('security_policy_updated_at = $5');
    expect(updateBlock).toContain('updated_at = $5');
    expect(updateBlock).not.toContain('input.learnerKey');
  });
});
