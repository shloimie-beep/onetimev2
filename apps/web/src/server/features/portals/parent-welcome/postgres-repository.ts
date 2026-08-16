import { createHash } from 'node:crypto';
import type {
  ParentWelcomeEventReceipt,
  ParentWelcomeRepository,
  ParentWelcomeVideoSlotRecord,
} from '../../../../../../../packages/contracts/src/portals/parent-welcome/index.ts';
import {
  validateParentWelcomeAssetBinding,
  type ParentWelcomeAssetBinding,
  type ParentWelcomeAssetResolver,
} from '../../../../../../../packages/domain/src/portals/parent-welcome/asset-delivery.ts';
import type { DbPool } from '../../../../../../../packages/db/src/index.ts';

type Row = Record<string, unknown>;

export function createPostgresParentWelcomeRepository(
  pool: DbPool,
  input: {
    accountKey: string;
    runtimeTier: 'isolated_staging' | 'production';
    verificationEnvironmentId: string;
  },
): ParentWelcomeRepository & ParentWelcomeAssetResolver {
  if (!input.accountKey.trim() || !input.verificationEnvironmentId.trim()) {
    throw new Error('Parent welcome scope is required.');
  }
  const scope = [
    input.accountKey,
    'one_time_mishnayos',
    input.runtimeTier,
    input.verificationEnvironmentId,
  ] as const;

  return {
    async loadCurrentSlot(principal): Promise<ParentWelcomeVideoSlotRecord | null> {
      const result = await pool.query(
        `SELECT slot.account_key, slot.product_key, slot.runtime_tier,
                slot.verification_environment_id, slot.slot_key,
                slot.video_version_id, slot.content_id, slot.content_version_id,
                slot.publication_generation, slot.approval_projection_digest,
                slot.title, slot.duration_ms, slot.width, slot.height,
                slot.captions_available, slot.poster_available
           FROM onetime.parent_welcome_video_slots_v21 AS slot
           JOIN onetime.content_publications AS publication
             ON publication.account_key = slot.account_key
            AND publication.product_key = slot.product_key
            AND publication.content_id = slot.content_id
            AND publication.content_version_id = slot.content_version_id
            AND publication.publication_generation = slot.publication_generation
            AND publication.approval_projection_digest = slot.approval_projection_digest
            AND publication.state = 'published'
           JOIN onetime.content_processing_versions AS version
             ON version.account_key = slot.account_key
            AND version.product_key = slot.product_key
            AND version.content_version_key = slot.content_version_id
            AND version.processing_state = 'approved'
           JOIN onetime.content_sources_v21 AS source
             ON source.account_key = version.account_key
            AND source.product_key = version.product_key
            AND source.source_key = version.source_key
            AND source.source_sha256 = version.source_sha256
            AND source.object_version_id = version.source_object_version_id
            AND source.source_kind = 'drive'
            AND source.lifecycle_state IN ('approved', 'published')
           JOIN onetime.parent_welcome_video_assets_v21 AS media_asset
             ON media_asset.account_key = slot.account_key
            AND media_asset.product_key = slot.product_key
            AND media_asset.runtime_tier = slot.runtime_tier
            AND media_asset.verification_environment_id = slot.verification_environment_id
            AND media_asset.video_version_id = slot.video_version_id
            AND media_asset.asset_kind = 'media'
            AND media_asset.state = 'approved'
            AND media_asset.source_key = version.source_key
            AND media_asset.source_sha256 = version.source_sha256
            AND media_asset.source_object_version_id = version.source_object_version_id
           JOIN onetime.parent_welcome_video_assets_v21 AS captions_asset
             ON captions_asset.account_key = slot.account_key
            AND captions_asset.product_key = slot.product_key
            AND captions_asset.runtime_tier = slot.runtime_tier
            AND captions_asset.verification_environment_id = slot.verification_environment_id
            AND captions_asset.video_version_id = slot.video_version_id
            AND captions_asset.asset_kind = 'captions'
            AND captions_asset.state = 'approved'
            AND captions_asset.source_key = version.source_key
            AND captions_asset.source_sha256 = version.source_sha256
            AND captions_asset.source_object_version_id = version.source_object_version_id
           JOIN onetime.parent_welcome_video_assets_v21 AS poster_asset
             ON poster_asset.account_key = slot.account_key
            AND poster_asset.product_key = slot.product_key
            AND poster_asset.runtime_tier = slot.runtime_tier
            AND poster_asset.verification_environment_id = slot.verification_environment_id
            AND poster_asset.video_version_id = slot.video_version_id
            AND poster_asset.asset_kind = 'poster'
            AND poster_asset.state = 'approved'
            AND poster_asset.source_key = version.source_key
            AND poster_asset.source_sha256 = version.source_sha256
            AND poster_asset.source_object_version_id = version.source_object_version_id
           JOIN onetime.v21_households AS household
             ON household.household_id = $5
            AND household.product_key = slot.product_key
            AND household.runtime_tier = slot.runtime_tier
            AND household.verification_environment_id = slot.verification_environment_id
            AND household.owner_adult_id = $6
            AND household.classification = 'family'
            AND household.state = 'active'
           JOIN onetime.v21_adult_identities AS adult
             ON adult.adult_id = household.owner_adult_id
            AND adult.product_key = household.product_key
            AND adult.runtime_tier = household.runtime_tier
            AND adult.verification_environment_id = household.verification_environment_id
            AND adult.state = 'active'
          WHERE slot.account_key = $1
            AND slot.product_key = $2
            AND slot.runtime_tier = $3
            AND slot.verification_environment_id = $4
            AND slot.slot_key = 'parent_companion_welcome'
            AND slot.state = 'approved'
          LIMIT 2`,
        [...scope, principal.household_id, principal.adult_id],
      );
      return result.rows.length === 1 ? slotRecord(result.rows[0] as Row) : null;
    },

    async resolveAsset(assetInput): Promise<ParentWelcomeAssetBinding | null> {
      const result = await pool.query(
        `SELECT slot.account_key, slot.product_key, slot.runtime_tier,
                slot.verification_environment_id, slot.slot_key,
                slot.video_version_id, slot.content_id, slot.content_version_id,
                slot.publication_generation, slot.approval_projection_digest,
                asset.source_key, asset.source_sha256,
                asset.source_object_version_id, asset.asset_kind,
                asset.storage_provider, asset.bucket_ref, asset.object_key,
                asset.object_version_id, asset.byte_count, asset.payload_sha256,
                asset.content_type, asset.width AS asset_width,
                asset.height AS asset_height
           FROM onetime.parent_welcome_video_slots_v21 AS slot
           JOIN onetime.content_publications AS publication
             ON publication.account_key = slot.account_key
            AND publication.product_key = slot.product_key
            AND publication.content_id = slot.content_id
            AND publication.content_version_id = slot.content_version_id
            AND publication.publication_generation = slot.publication_generation
            AND publication.approval_projection_digest = slot.approval_projection_digest
            AND publication.state = 'published'
           JOIN onetime.content_processing_versions AS version
             ON version.account_key = slot.account_key
            AND version.product_key = slot.product_key
            AND version.content_version_key = slot.content_version_id
            AND version.processing_state = 'approved'
           JOIN onetime.parent_welcome_video_assets_v21 AS asset
             ON asset.account_key = slot.account_key
            AND asset.product_key = slot.product_key
            AND asset.runtime_tier = slot.runtime_tier
            AND asset.verification_environment_id = slot.verification_environment_id
            AND asset.video_version_id = slot.video_version_id
            AND asset.asset_kind = $8
            AND asset.state = 'approved'
            AND asset.source_key = version.source_key
            AND asset.source_sha256 = version.source_sha256
            AND asset.source_object_version_id = version.source_object_version_id
           JOIN onetime.content_sources_v21 AS source
             ON source.account_key = version.account_key
            AND source.product_key = version.product_key
            AND source.source_key = version.source_key
            AND source.source_sha256 = asset.source_sha256
            AND source.object_version_id = asset.source_object_version_id
            AND source.source_kind = 'drive'
            AND source.lifecycle_state IN ('approved', 'published')
           JOIN onetime.v21_households AS household
             ON household.household_id = $5
            AND household.product_key = slot.product_key
            AND household.runtime_tier = slot.runtime_tier
            AND household.verification_environment_id = slot.verification_environment_id
            AND household.owner_adult_id = $6
            AND household.classification = 'family'
            AND household.state = 'active'
           JOIN onetime.v21_adult_identities AS adult
             ON adult.adult_id = household.owner_adult_id
            AND adult.product_key = household.product_key
            AND adult.runtime_tier = household.runtime_tier
            AND adult.verification_environment_id = household.verification_environment_id
            AND adult.state = 'active'
          WHERE slot.account_key = $1
            AND slot.product_key = $2
            AND slot.runtime_tier = $3
            AND slot.verification_environment_id = $4
            AND slot.slot_key = 'parent_companion_welcome'
            AND slot.video_version_id = $7
            AND slot.state = 'approved'
          LIMIT 2`,
        [
          ...scope,
          assetInput.principal.household_id,
          assetInput.principal.adult_id,
          assetInput.video_version_id,
          assetInput.asset_kind,
        ],
      );
      return result.rows.length === 1 ? assetBinding(result.rows[0] as Row) : null;
    },

    async recordEvents(events): Promise<ParentWelcomeEventReceipt[]> {
      if (events.length === 0) return [];
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        const receipts: ParentWelcomeEventReceipt[] = [];
        for (const event of events) {
          const existingIdempotency = await client.query(
            `SELECT canonical_request_hash, event_type, video_version_id, recorded_at
               FROM onetime.parent_activation_events_v21
              WHERE account_key = $1 AND product_key = $2 AND runtime_tier = $3
                AND verification_environment_id = $4 AND household_id = $5
                AND parent_adult_id = $6 AND idempotency_key = $7
              LIMIT 1`,
            [
              ...scope,
              event.principal.household_id,
              event.principal.adult_id,
              event.binding.idempotency_key,
            ],
          );
          const replay = existingIdempotency.rows[0] as Row | undefined;
          if (replay) {
            if (
              text(replay.canonical_request_hash) !== event.binding.canonical_request_hash ||
              text(replay.event_type) !== event.event_type ||
              text(replay.video_version_id) !== event.video_version_id
            ) {
              throw new Error('parent_welcome_idempotency_conflict');
            }
            receipts.push({
              event_type: event.event_type,
              video_version_id: event.video_version_id,
              recorded: false,
              recorded_at: instant(replay.recorded_at),
            });
            continue;
          }
          const eventId = hash(
            [
              ...scope,
              event.principal.household_id,
              event.principal.adult_id,
              event.video_version_id,
              event.event_type,
            ].join('\0'),
          );
          const inserted = await client.query(
            `INSERT INTO onetime.parent_activation_events_v21 (
               event_id, account_key, product_key, runtime_tier,
               verification_environment_id, household_id, parent_adult_id,
               video_version_id, event_type, idempotency_key,
               canonical_request_hash, observed_playback_seconds,
               observed_position_percent, event_json, recorded_at
             ) VALUES (
               $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13,
               $14::jsonb, $15::timestamptz
             )
             ON CONFLICT (
               account_key, product_key, runtime_tier, verification_environment_id,
               household_id, parent_adult_id, video_version_id, event_type
             ) DO NOTHING
             RETURNING recorded_at`,
            [
              eventId,
              ...scope,
              event.principal.household_id,
              event.principal.adult_id,
              event.video_version_id,
              event.event_type,
              event.binding.idempotency_key,
              event.binding.canonical_request_hash,
              event.observed_playback_seconds,
              event.observed_position_percent,
              JSON.stringify({
                event_type: event.event_type,
                video_version_id: event.video_version_id,
                observed_playback_seconds: event.observed_playback_seconds,
                observed_position_percent: event.observed_position_percent,
              }),
              event.binding.occurred_at,
            ],
          );
          const recordedAt = inserted.rows[0]?.recorded_at;
          if (recordedAt) {
            receipts.push({
              event_type: event.event_type,
              video_version_id: event.video_version_id,
              recorded: true,
              recorded_at: instant(recordedAt),
            });
            continue;
          }
          const naturalReplay = await client.query(
            `SELECT recorded_at
               FROM onetime.parent_activation_events_v21
              WHERE account_key = $1 AND product_key = $2 AND runtime_tier = $3
                AND verification_environment_id = $4 AND household_id = $5
                AND parent_adult_id = $6 AND video_version_id = $7 AND event_type = $8
              LIMIT 1`,
            [
              ...scope,
              event.principal.household_id,
              event.principal.adult_id,
              event.video_version_id,
              event.event_type,
            ],
          );
          receipts.push({
            event_type: event.event_type,
            video_version_id: event.video_version_id,
            recorded: false,
            recorded_at: instant(naturalReplay.rows[0]?.recorded_at),
          });
        }
        await client.query('COMMIT');
        return receipts;
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      } finally {
        client.release();
      }
    },

    async loadFunnelReport() {
      const result = await pool.query(
        `SELECT step_order, event_type, label, household_count,
                previous_household_count, adjacent_conversion_percent
           FROM onetime.parent_welcome_activation_funnel_v21
          WHERE account_key = $1 AND product_key = $2 AND runtime_tier = $3
            AND verification_environment_id = $4
          ORDER BY step_order`,
        [...scope],
      );
      return result.rows.map((row) => ({
        step_order: integer(row.step_order),
        event_type: text(row.event_type) as never,
        label: text(row.label),
        household_count: integer(row.household_count),
        previous_household_count:
          row.previous_household_count === null ? null : integer(row.previous_household_count),
        adjacent_conversion_percent:
          row.adjacent_conversion_percent === null
            ? null
            : finiteNumber(row.adjacent_conversion_percent),
      }));
    },
  };
}

function slotRecord(row: Row): ParentWelcomeVideoSlotRecord {
  return {
    account_key: text(row.account_key),
    product_key: exact(row.product_key, 'one_time_mishnayos'),
    runtime_tier: exact(row.runtime_tier, 'isolated_staging', 'production'),
    verification_environment_id: text(row.verification_environment_id),
    slot_key: exact(row.slot_key, 'parent_companion_welcome'),
    video_version_id: text(row.video_version_id),
    content_id: text(row.content_id),
    content_version_id: text(row.content_version_id),
    publication_generation: integer(row.publication_generation),
    approval_projection_digest: text(row.approval_projection_digest),
    title: text(row.title),
    duration_ms: integer(row.duration_ms),
    width: integer(row.width),
    height: integer(row.height),
    captions_available: boolean(row.captions_available),
    poster_available: boolean(row.poster_available),
  };
}

function assetBinding(row: Row): ParentWelcomeAssetBinding {
  return validateParentWelcomeAssetBinding({
    account_key: text(row.account_key),
    product_key: exact(row.product_key, 'one_time_mishnayos'),
    runtime_tier: exact(row.runtime_tier, 'isolated_staging', 'production'),
    verification_environment_id: text(row.verification_environment_id),
    slot_key: exact(row.slot_key, 'parent_companion_welcome'),
    video_version_id: text(row.video_version_id),
    content_id: text(row.content_id),
    content_version_id: text(row.content_version_id),
    publication_generation: integer(row.publication_generation),
    approval_projection_digest: text(row.approval_projection_digest),
    source_key: text(row.source_key),
    source_sha256: text(row.source_sha256),
    source_object_version_id: text(row.source_object_version_id),
    asset_kind: exact(row.asset_kind, 'media', 'captions', 'poster'),
    storage_provider: exact(row.storage_provider, 's3'),
    bucket_ref: text(row.bucket_ref),
    object_key: text(row.object_key),
    object_version_id: text(row.object_version_id),
    byte_count: integer(row.byte_count),
    payload_sha256: text(row.payload_sha256),
    content_type: exact(
      row.content_type,
      'video/mp4',
      'text/vtt',
      'image/jpeg',
      'image/png',
      'image/webp',
    ),
    width: nullableInteger(row.asset_width),
    height: nullableInteger(row.asset_height),
  });
}

function text(value: unknown) {
  if (typeof value !== 'string' || !value.trim()) {
    throw new Error('Parent welcome data is invalid.');
  }
  return value;
}

function exact<const T extends readonly string[]>(value: unknown, ...allowed: T): T[number] {
  if (typeof value !== 'string' || !allowed.includes(value)) {
    throw new Error('Parent welcome scope is invalid.');
  }
  return value as T[number];
}

function integer(value: unknown) {
  const parsed = typeof value === 'number' ? value : Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < 0) {
    throw new Error('Parent welcome count is invalid.');
  }
  return parsed;
}

function nullableInteger(value: unknown) {
  return value === null ? null : integer(value);
}

function finiteNumber(value: unknown) {
  const parsed = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) throw new Error('Parent welcome rate is invalid.');
  return parsed;
}

function boolean(value: unknown) {
  if (typeof value !== 'boolean') throw new Error('Parent welcome media state is invalid.');
  return value;
}

function instant(value: unknown) {
  const parsed = value instanceof Date ? value : new Date(text(value));
  if (Number.isNaN(parsed.getTime())) throw new Error('Parent welcome timestamp is invalid.');
  return parsed.toISOString();
}

function hash(value: string) {
  return createHash('sha256').update(value, 'utf8').digest('hex');
}
