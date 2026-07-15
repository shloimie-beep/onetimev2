import type {
  ProviderEventRecord,
  ProviderReadinessSnapshot,
} from '../../../contracts/src/providers/events.ts';
import type { OversightOutcome } from '../../../contracts/src/providers/oversight.ts';
import type { DbPool } from '../index.ts';

export function createPostgresProviderTruthRepository(pool: DbPool) {
  return {
    async recordProviderEvent(record: ProviderEventRecord) {
      await pool.query(
        `INSERT INTO onetime.provider_event_ledger
         (event_key, account_key, product_key, provider, environment, provider_event_ref_hash,
          event_type, canonical_state, provider_created_at, payload_digest, object_refs, minimized_payload)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11::jsonb,$12::jsonb)
         ON CONFLICT (provider, environment, provider_event_ref_hash, event_type)
         DO UPDATE SET
           canonical_state = EXCLUDED.canonical_state,
           provider_created_at = COALESCE(EXCLUDED.provider_created_at, onetime.provider_event_ledger.provider_created_at),
           payload_digest = EXCLUDED.payload_digest,
           object_refs = EXCLUDED.object_refs,
           minimized_payload = EXCLUDED.minimized_payload`,
        [
          record.event_key,
          record.account_key,
          record.product_key,
          record.provider,
          record.environment,
          record.provider_event_ref_hash,
          record.event_type,
          record.canonical_state,
          record.provider_created_at,
          record.payload_digest,
          JSON.stringify(record.object_refs),
          JSON.stringify(record.minimized_payload),
        ],
      );
    },
    async recordReadiness(snapshot: ProviderReadinessSnapshot) {
      await pool.query(
        `INSERT INTO onetime.provider_readiness_snapshots
         (snapshot_key, account_key, product_key, provider, environment, readiness_state,
          capability_names, safe_fingerprint, observed_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
         ON CONFLICT (snapshot_key) DO NOTHING`,
        [
          snapshot.snapshot_key,
          snapshot.account_key,
          snapshot.product_key,
          snapshot.provider,
          snapshot.environment,
          snapshot.readiness_state,
          snapshot.capability_names,
          snapshot.safe_fingerprint,
          snapshot.observed_at,
        ],
      );
    },
    async enqueueOversightOutcome(outcome: OversightOutcome) {
      await pool.query(
        `INSERT INTO onetime.oversight_outbox_events
         (event_id, schema_version, source_sha, account_key, product_key, category,
          summary, signature_ref, produced_at, stale_after)
         VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb,$8,$9,$10)
         ON CONFLICT (event_id) DO NOTHING`,
        [
          outcome.event_id,
          outcome.schema_version,
          outcome.source_sha,
          outcome.account_key,
          outcome.product_key,
          outcome.category,
          JSON.stringify(outcome.summary),
          outcome.signature_ref,
          outcome.produced_at,
          outcome.stale_after,
        ],
      );
    },
  };
}
