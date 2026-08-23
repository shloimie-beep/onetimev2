import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('parent welcome video framework migration', () => {
  const sql = readFileSync(
    'packages/db/migrations/2285_parent_welcome_video_framework.sql',
    'utf8',
  );

  it('creates a fail-closed empty slot without embedding a candidate locator', () => {
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

  it('requires one governed exact-version media, captions, and poster binding', () => {
    expect(sql).toContain('CREATE TABLE onetime.parent_welcome_video_assets_v21');
    expect(sql).toContain(
      "asset_kind text NOT NULL CHECK (asset_kind IN ('media', 'captions', 'poster'))",
    );
    expect(sql).toContain("storage_provider text NOT NULL CHECK (storage_provider = 's3')");
    expect(sql).toContain("asset_kind <> 'media' OR content_type = 'video/mp4'");
    expect(sql).toContain("asset_kind <> 'captions' OR content_type = 'text/vtt'");
    expect(sql).toMatch(
      /asset_kind <> 'poster'\s+OR content_type IN \('image\/jpeg', 'image\/png', 'image\/webp'\)/u,
    );
    expect(sql).toContain('parent_welcome_video_asset_slot_fk');
    expect(sql).toContain('source_object_version_id text NOT NULL');
    expect(sql).toContain('object_version_id text NOT NULL');
    expect(sql).not.toMatch(/\bINSERT\s+INTO\s+onetime\.parent_welcome_video_assets_v21/iu);
  });

  it('keeps activation events adult-household scoped and append-only', () => {
    expect(sql).toContain('CREATE TABLE onetime.parent_activation_events_v21');
    expect(sql).toContain('parent_adult_id text NOT NULL');
    expect(sql).toContain('parent_activation_events_append_only');
    expect(sql).toContain(
      'never update Student attendance, progress, streaks, badges, credentials, or HighLevel contacts',
    );
    expect(sql).not.toMatch(/student_(?:email|phone|contact)/iu);
  });
});
