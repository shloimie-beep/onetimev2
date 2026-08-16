import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('parent welcome video framework migration', () => {
  it('creates a fail-closed empty slot without embedding a candidate locator', () => {
    const sql = readFileSync(
      'packages/db/migrations/2285_parent_welcome_video_framework.sql',
      'utf8',
    );

    expect(sql).toContain('CREATE TABLE onetime.parent_welcome_video_slots_v21');
    expect(sql).toContain("state text NOT NULL CHECK (state IN ('approved', 'revoked'))");
    expect(sql).toContain("state <> 'approved' OR (captions_available AND poster_available)");
    expect(sql).toContain('width * 9 = height * 16');
    expect(sql).toContain(
      'duration_ms integer NOT NULL CHECK (duration_ms BETWEEN 60000 AND 120000)',
    );
    expect(sql).not.toMatch(/\bINSERT\s+INTO\s+onetime\.parent_welcome_video_slots_v21/iu);
    expect(sql).not.toMatch(/https?:\/\/|drive\.google\.com|youtu(?:be|\.be)|vimeo\.com|\.mp4\b/iu);
  });

  it('keeps activation events adult-household scoped and append-only', () => {
    const sql = readFileSync(
      'packages/db/migrations/2285_parent_welcome_video_framework.sql',
      'utf8',
    );

    expect(sql).toContain('CREATE TABLE onetime.parent_activation_events_v21');
    expect(sql).toContain('parent_adult_id text NOT NULL');
    expect(sql).toContain('parent_activation_events_append_only');
    expect(sql).toContain(
      'never update Student attendance, progress, streaks, badges, credentials, or HighLevel contacts',
    );
    expect(sql).not.toMatch(/student_(?:email|phone|contact)/iu);
  });
});
