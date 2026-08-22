import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('migration 2288 provider-proof lifecycle foundation', () => {
  const sql = readFileSync(
    'packages/db/migrations/2288_production_basic_host_lifecycle.sql',
    'utf8',
  );

  it('binds a host lifecycle to exact session, actor, context, occurrence, and instance digests', () => {
    for (const column of [
      'account_key',
      'product_key',
      'occurrence_key',
      'meeting_ref_digest',
      'provider_meeting_instance_digest',
      'lifecycle_context_digest',
      'actor_ref_digest',
      'session_ref_digest',
      'lifecycle_state',
      'expires_at',
      'version',
    ]) {
      expect(sql).toContain(column);
    }
    expect(sql).toContain('production_basic_host_lifecycles_instance_uq');
    expect(sql).toContain("'provider_ended'");
    expect(sql).toContain("'cleanup_pending'");
  });

  it('stores only narrow digest-only verified lifecycle events with replay and state guards', () => {
    expect(sql).toContain('production_basic_zoom_lifecycle_events');
    expect(sql).toContain('provider_event_key_digest text PRIMARY KEY');
    expect(sql).toContain('meeting_instance_digest text NOT NULL');
    expect(sql).toContain("event_type IN ('meeting_started', 'meeting_ended')");
    expect(sql).toContain("correlation_state IN ('pending', 'correlated')");
    expect(sql).toContain('production_basic_zoom_lifecycle_events_semantic_uq');
    for (const forbidden of [
      'raw_payload',
      'meeting_uuid text',
      'meeting_number',
      'passcode',
      'zak',
      'oauth_token',
      'webhook_secret',
      'host_email',
      'participant',
    ]) {
      expect(sql.toLowerCase()).not.toContain(forbidden);
    }
  });
});
