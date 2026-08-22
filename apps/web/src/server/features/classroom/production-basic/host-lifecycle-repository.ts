import { createHash, randomUUID } from 'node:crypto';
import type { DbPool } from '../../../../../../../packages/db/src/index.ts';
import { jerusalemLocalDate } from './live-marker-repository.ts';
import type { ProductionBasicScope } from './service.ts';

export const PRODUCTION_BASIC_HOST_LIFECYCLE_TTL_MS = 2 * 60 * 60_000;

export type ProductionBasicHostLifecycleState =
  'live' | 'end_requested' | 'unknown_effect' | 'provider_ended' | 'cleanup_pending' | 'ended';

export type ProductionBasicHostLifecycle = {
  state: ProductionBasicHostLifecycleState;
  context: string | null;
};

export type ProductionBasicHostLifecycleStore = {
  createLive(input: {
    scope: ProductionBasicScope;
    meetingRefDigest: string;
    actorUserRef: string;
    now: Date;
  }): Promise<ProductionBasicHostLifecycle | null>;
  beginEnd(input: LifecycleInput): Promise<ProductionBasicHostLifecycleState | null>;
  markUnknown(input: LifecycleInput): Promise<ProductionBasicHostLifecycleState | null>;
  confirmEnded(input: LifecycleInput): Promise<ProductionBasicHostLifecycleState | null>;
  read(input: Omit<LifecycleInput, 'context'>): Promise<ProductionBasicHostLifecycle | null>;
  beginCleanup(input: LifecycleInput): Promise<ProductionBasicHostLifecycleState | null>;
  finishCleanup(input: LifecycleInput): Promise<ProductionBasicHostLifecycleState | null>;
  markCleanupPending(input: LifecycleInput): Promise<ProductionBasicHostLifecycleState | null>;
};

type LifecycleInput = {
  scope: ProductionBasicScope;
  meetingRefDigest: string;
  actorUserRef: string;
  context: string;
  now: Date;
};

export function createProductionBasicHostLifecycleStore(
  pool: DbPool,
): ProductionBasicHostLifecycleStore {
  const actorDigest = (actorUserRef: string) => digest(`actor-v1\0${actorUserRef}`);
  const contextDigest = (context: string) => digest(`context-v1\0${context}`);

  async function transition(
    input: LifecycleInput,
    from: readonly ProductionBasicHostLifecycleState[],
    to: ProductionBasicHostLifecycleState,
  ) {
    const result = await pool.query(
      `UPDATE onetime.production_basic_host_lifecycles
          SET lifecycle_state = $7,
              version = version + 1,
              updated_at = $6
        WHERE account_key = $1
          AND product_key = $2
          AND meeting_ref_digest = $3
          AND lifecycle_context_digest = $4
          AND actor_ref_digest = $5
          AND expires_at > $6
          AND lifecycle_state = ANY($8::text[])
      RETURNING lifecycle_state`,
      [
        input.scope.account_key,
        input.scope.product_key,
        input.meetingRefDigest,
        contextDigest(input.context),
        actorDigest(input.actorUserRef),
        input.now,
        to,
        from,
      ],
    );
    return (
      (result.rows[0]?.lifecycle_state as ProductionBasicHostLifecycleState | undefined) ?? null
    );
  }

  return {
    async createLive(input) {
      const context = randomUUID();
      const localDate = jerusalemLocalDate(input.now);
      const occurrence = await pool.query<{ occurrence_key: string }>(
        `SELECT occurrence.occurrence_key
           FROM onetime.class_occurrences AS occurrence
           JOIN onetime.class_series AS series
             ON series.account_key = occurrence.account_key
            AND series.product_key = occurrence.product_key
            AND series.class_series_key = occurrence.class_series_key
          WHERE occurrence.account_key = $1
            AND occurrence.product_key = $2
            AND occurrence.local_class_date = $3::date
            AND series.is_canonical = true
            AND series.status = 'active'
            AND series.series_state = 'active'
          ORDER BY occurrence.starts_at, occurrence.occurrence_key
          LIMIT 1`,
        [input.scope.account_key, input.scope.product_key, localDate],
      );
      const occurrenceKey = occurrence.rows[0]?.occurrence_key;
      if (!occurrenceKey) return null;
      const result = await pool.query(
        `INSERT INTO onetime.production_basic_host_lifecycles (
            account_key, product_key, occurrence_key, meeting_ref_digest,
            lifecycle_context_digest, actor_ref_digest, lifecycle_state, expires_at, updated_at
          )
          VALUES ($1, $2, $3, $4, $5, $6, 'live', $7, $8)
          ON CONFLICT (account_key, product_key, occurrence_key) DO UPDATE
            SET meeting_ref_digest = EXCLUDED.meeting_ref_digest,
                lifecycle_context_digest = EXCLUDED.lifecycle_context_digest,
                actor_ref_digest = EXCLUDED.actor_ref_digest,
                lifecycle_state = 'live',
                expires_at = EXCLUDED.expires_at,
                version = onetime.production_basic_host_lifecycles.version + 1,
                updated_at = EXCLUDED.updated_at
          RETURNING lifecycle_state`,
        [
          input.scope.account_key,
          input.scope.product_key,
          occurrenceKey,
          input.meetingRefDigest,
          contextDigest(context),
          actorDigest(input.actorUserRef),
          new Date(input.now.getTime() + PRODUCTION_BASIC_HOST_LIFECYCLE_TTL_MS),
          input.now,
        ],
      );
      return result.rows[0] ? { state: 'live', context } : null;
    },
    beginEnd: (input) => transition(input, ['live'], 'end_requested'),
    markUnknown: (input) => transition(input, ['end_requested'], 'unknown_effect'),
    confirmEnded: (input) =>
      transition(input, ['live', 'end_requested', 'unknown_effect'], 'provider_ended'),
    async read(input) {
      const result = await pool.query(
        `SELECT lifecycle_state
           FROM onetime.production_basic_host_lifecycles
          WHERE account_key = $1
            AND product_key = $2
            AND meeting_ref_digest = $3
            AND actor_ref_digest = $4
            AND expires_at > $5
          ORDER BY updated_at DESC
          LIMIT 1`,
        [
          input.scope.account_key,
          input.scope.product_key,
          input.meetingRefDigest,
          actorDigest(input.actorUserRef),
          input.now,
        ],
      );
      const state = result.rows[0]?.lifecycle_state as
        ProductionBasicHostLifecycleState | undefined;
      if (!state) return null;
      // A restored host session gets a fresh opaque context. The database keeps
      // only its digest and binds it again to this actor, account, meeting, and
      // TTL; a stale browser context cannot be replayed after reload.
      const context = randomUUID();
      const refreshed = await pool.query(
        `UPDATE onetime.production_basic_host_lifecycles
            SET lifecycle_context_digest = $5,
                version = version + 1,
                updated_at = $4
          WHERE account_key = $1
            AND product_key = $2
            AND meeting_ref_digest = $3
            AND actor_ref_digest = $6
            AND expires_at > $4
            AND lifecycle_state = $7
        RETURNING lifecycle_state`,
        [
          input.scope.account_key,
          input.scope.product_key,
          input.meetingRefDigest,
          input.now,
          contextDigest(context),
          actorDigest(input.actorUserRef),
          state,
        ],
      );
      return refreshed.rows[0] ? { state, context } : null;
    },
    beginCleanup: (input) =>
      transition(input, ['provider_ended', 'cleanup_pending'], 'cleanup_pending'),
    finishCleanup: (input) => transition(input, ['cleanup_pending'], 'ended'),
    markCleanupPending: (input) => transition(input, ['cleanup_pending'], 'cleanup_pending'),
  };
}

function digest(value: string) {
  return createHash('sha256').update(value).digest('hex');
}
