import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const MIGRATION_PATH = path.resolve(
  process.cwd(),
  'packages/db/migrations/2263_family_signup_ghl_dispatch.sql',
);

describe('migration 2263 Family-signup HighLevel dispatch', () => {
  it('persists replay fences and quarantines unknown workflow acceptance', async () => {
    const sql = await readFile(MIGRATION_PATH, 'utf8');
    expect(sql).toContain('family_signup_ghl_dispatches');
    expect(sql).toContain('family_signup_ghl_effect_receipts');
    expect(sql).toContain("'acceptance_unknown'");
    expect(sql).toContain("'workflow_enrollment'");
    expect(sql).toContain('family_signup_ghl_effect_receipts_append_only');
    expect(sql).toMatch(/FOREIGN KEY \(intent_id\)[\s\S]*family_signup_outbox/u);
  });
});
