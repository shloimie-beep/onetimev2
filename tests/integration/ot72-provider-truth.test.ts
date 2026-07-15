import { describe, expect, it } from 'vitest';
import { createMemoryPool, runMigrations } from '../../packages/db/src/index.ts';
import { createPostgresProviderTruthRepository } from '../../packages/db/src/providers/repository.ts';
import { buildProviderEventRecord } from '../../packages/domain/src/providers/provider-events.ts';
import { buildOversightOutcome } from '../../packages/domain/src/providers/oversight.ts';

describe('OT-72 provider truth migration and repository', () => {
  it('applies the 1800 namespace and stores only redacted provider truth', async () => {
    const pool = createMemoryPool();
    try {
      await runMigrations(pool);
      const applied = await pool.query(
        "SELECT checksum FROM onetime.schema_migrations WHERE id = '1800_ot72_provider_truth'",
      );
      expect(applied.rowCount).toBe(1);

      const repository = createPostgresProviderTruthRepository(pool);
      const event = buildProviderEventRecord({
        accountKey: 'one_time',
        productKey: 'one_time_mishnah_class',
        provider: 'resend',
        environment: 'staging',
        providerEventRef: 'raw-resend-event-1',
        eventType: 'email.delivered',
        canonicalState: 'delivered',
        providerCreatedAt: '2026-07-15T06:00:00.000Z',
        minimizedPayload: { type: 'email.delivered' },
      });
      await repository.recordProviderEvent(event);
      await repository.recordReadiness({
        snapshot_key: 'readiness_ot72_resend',
        account_key: 'one_time',
        product_key: 'one_time_mishnah_class',
        provider: 'resend',
        environment: 'staging',
        readiness_state: 'configured',
        capability_names: ['email_send_canary'],
        safe_fingerprint: 'abc123',
        observed_at: '2026-07-15T06:00:00.000Z',
      });
      await repository.enqueueOversightOutcome(
        buildOversightOutcome({
          sourceSha: 'abcdef123456',
          accountKey: 'one_time',
          productKey: 'one_time_mishnah_class',
          category: 'provider_readiness',
          producedAt: new Date('2026-07-15T06:00:00Z'),
          staleAfter: new Date('2026-07-15T07:00:00Z'),
          summary: { resend: 'configured' },
        }),
      );

      const stored = await pool.query(
        'SELECT provider_event_ref_hash, canonical_state FROM onetime.provider_event_ledger',
      );
      expect(stored.rows[0].canonical_state).toBe('delivered');
      expect(stored.rows[0].provider_event_ref_hash).not.toContain('raw-resend-event-1');
      expect(
        (
          await pool.query(
            'SELECT count(*)::int AS count FROM onetime.provider_readiness_snapshots',
          )
        ).rows[0].count,
      ).toBe(1);
      expect(
        (await pool.query('SELECT count(*)::int AS count FROM onetime.oversight_outbox_events'))
          .rows[0].count,
      ).toBe(1);
    } finally {
      await pool.end();
    }
  });
});
