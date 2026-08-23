import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const MIGRATION_PATH = path.resolve(
  process.cwd(),
  'packages/db/migrations/2262_complete_launch_class_anchor.sql',
);

describe('migration 2262 complete launch class anchor', () => {
  it('locks the canonical series and preserves attended pre-anchor history', async () => {
    const sql = await readFile(MIGRATION_PATH, 'utf8');

    expect(sql).toContain("recurrence_starts_on = DATE '2026-08-16'");
    expect(sql).toContain("local_start_time = time '19:00'");
    expect(sql).toContain("reminder_local_time = time '18:30'");
    expect(sql).toContain('ARRAY[1,2,3,4,7]::smallint[]');
    expect(sql).toContain("DATE '2026-08-16' + 89");
    expect(sql).toContain("interval '10 minutes'");
    expect(sql).toContain("interval '75 minutes'");
    expect(sql).toContain('class_launch_timing_correction_receipts');
    expect(sql).toMatch(/NOT EXISTS \([\s\S]*class_attendance_marks/u);
    expect(sql).toMatch(/NOT EXISTS \([\s\S]*classroom_attendance_events_v21/u);
    expect(sql).toContain('class_launch_timing_corrections_append_only');
  });
});
