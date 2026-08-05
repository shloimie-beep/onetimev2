import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const MIGRATION_PATH = path.resolve(
  process.cwd(),
  'packages/db/migrations/2261_complete_launch_timing_correction.sql',
);

describe('migration 2261 complete launch timing correction', () => {
  it('evidences only the replaced free-access boundary and restores append-only protection', async () => {
    const sql = await readFile(MIGRATION_PATH, 'utf8');

    expect(sql).toContain('family_signup_access_timing_correction_receipts');
    expect(sql).toContain("correction_key = 'complete-launch-2026-08-05'");
    expect(sql).toContain("timestamptz '2026-09-13T16:24:00.000Z'");
    expect(sql).toContain("timestamptz '2026-09-11T15:00:00.000Z'");
    expect(sql).toMatch(
      /WHERE access_branch = 'immediate_free'[\s\S]*access_state = 'free'[\s\S]*free_access_expires_at = timestamptz '2026-09-13T16:24:00\.000Z'/u,
    );
    expect(sql).toMatch(
      /CREATE TRIGGER family_signup_access_append_only[\s\S]*BEFORE UPDATE OR DELETE ON onetime\.family_signup_access_projections/u,
    );
    expect(sql).toMatch(
      /CREATE TRIGGER family_signup_access_timing_corrections_append_only[\s\S]*BEFORE UPDATE OR DELETE ON onetime\.family_signup_access_timing_correction_receipts/u,
    );
  });
});
