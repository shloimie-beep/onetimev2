import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('production-basic live-class receipt migration', () => {
  it('keeps the receipt nullable, digest-bound, and capped at two hours', () => {
    const sql = readFileSync(
      'packages/db/migrations/2282_production_basic_live_class_receipt.sql',
      'utf8',
    );
    expect(sql).toContain('production_basic_live_confirmed_at timestamptz');
    expect(sql).toContain('production_basic_live_expires_at timestamptz');
    expect(sql).toContain('production_basic_meeting_ref_digest text');
    expect(sql).toContain("<= production_basic_live_confirmed_at + interval '2 hours'");
    expect(sql).toContain('length(production_basic_meeting_ref_digest) = 64');
    expect(sql).toContain(
      'production_basic_meeting_ref_digest = lower(production_basic_meeting_ref_digest)',
    );
    expect(sql).toContain(
      'production_basic_meeting_ref_digest = btrim(production_basic_meeting_ref_digest)',
    );
  });
});
