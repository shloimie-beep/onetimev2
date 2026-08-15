import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('production-basic attendance session migration', () => {
  it('binds one opaque session to exact occurrence, Student, login, and bounded lifetime', () => {
    const sql = readFileSync(
      'packages/db/migrations/2283_production_basic_attendance_sessions.sql',
      'utf8',
    );
    expect(sql).toContain('CREATE TABLE onetime.production_basic_attendance_sessions');
    expect(sql).toContain('attendance_session_key_digest text PRIMARY KEY');
    expect(sql).toContain('occurrence_key text NOT NULL');
    expect(sql).toContain('learner_key text NOT NULL');
    expect(sql).toContain('authenticated_session_key text NOT NULL');
    expect(sql).toContain('connection_lineage_id text NOT NULL');
    expect(sql).toContain("expires_at <= issued_at + interval '4 hours'");
    expect(sql).toContain('left_observed_at IS NULL OR left_observed_at >= joined_observed_at');
    expect(sql).not.toMatch(/attendance_session_key text/iu);
    expect(sql).not.toMatch(/display_name|user_agent|provider_participant/iu);
  });
});
