import { createHash, randomUUID } from 'node:crypto';
import type { DbPool } from '../../../../../../../packages/db/src/index.ts';
import { jerusalemLocalDate } from './live-marker-repository.ts';
import type { ProductionBasicScope } from './service.ts';

export const PRODUCTION_BASIC_HOST_LIFECYCLE_TTL_MS = 2 * 60 * 60_000;
export const PRODUCTION_BASIC_PROVIDER_CORRELATION_WINDOW_MS = 90 * 60_000;

export type ProductionBasicHostLifecycleState =
  'live' | 'end_requested' | 'unknown_effect' | 'provider_ended' | 'cleanup_pending' | 'ended';

export type ProductionBasicHostLifecycle = {
  state: ProductionBasicHostLifecycleState;
  context: string | null;
};

export type ProductionBasicVerifiedZoomLifecycleEvent = {
  providerEventKeyDigest: string;
  providerAccountRefDigest: string;
  providerHostRefDigest: string;
  meetingRefDigest: string;
  meetingInstanceDigest: string;
  eventType: 'meeting_started' | 'meeting_ended';
  providerEventAt: Date;
  meetingStartedAt: Date;
  meetingEndedAt: Date | null;
  receivedAt: Date;
};

export type ProductionBasicProviderCleanupTarget = {
  scope: ProductionBasicScope;
  occurrenceKey: string;
  meetingRefDigest: string;
  meetingInstanceDigest: string;
  clearedAt: Date;
};

export type ProductionBasicHostLifecycleStore = {
  createLive(input: LifecycleActorInput): Promise<ProductionBasicHostLifecycle | null>;
  beginEnd(input: LifecycleInput): Promise<ProductionBasicHostLifecycleState | null>;
  markUnknown(input: LifecycleInput): Promise<ProductionBasicHostLifecycleState | null>;
  read(input: LifecycleInput): Promise<ProductionBasicHostLifecycle | null>;
  reconcile(input: LifecycleInput): Promise<ProductionBasicHostLifecycleState | null>;
  beginCleanup(input: LifecycleInput): Promise<ProductionBasicProviderCleanupTarget | null>;
  finishCleanup(input: LifecycleInput): Promise<ProductionBasicHostLifecycleState | null>;
  markCleanupPending(input: LifecycleInput): Promise<ProductionBasicHostLifecycleState | null>;
  recordVerifiedProviderEvent(input: {
    scope: ProductionBasicScope;
    event: ProductionBasicVerifiedZoomLifecycleEvent;
  }): Promise<{ duplicate: boolean; cleanupTarget: ProductionBasicProviderCleanupTarget | null }>;
  beginProviderCleanup(
    input: ProductionBasicProviderCleanupTarget,
  ): Promise<ProductionBasicProviderCleanupTarget | null>;
  finishProviderCleanup(
    input: ProductionBasicProviderCleanupTarget,
    succeeded: boolean,
  ): Promise<void>;
};

type LifecycleActorInput = {
  scope: ProductionBasicScope;
  meetingRefDigest: string;
  actorUserRef: string;
  sessionRef: string;
  now: Date;
};

type LifecycleInput = LifecycleActorInput & { context: string };

export function createProductionBasicHostLifecycleStore(
  pool: DbPool,
): ProductionBasicHostLifecycleStore {
  const actorDigest = (actorUserRef: string) =>
    productionBasicDigest('host-actor-v2', actorUserRef);
  const sessionDigest = (sessionRef: string) =>
    productionBasicDigest('host-session-v1', sessionRef);
  const contextDigest = (context: string) => productionBasicDigest('lifecycle-context-v2', context);

  async function transition(
    input: LifecycleInput,
    from: readonly ProductionBasicHostLifecycleState[],
    to: ProductionBasicHostLifecycleState,
  ) {
    const occurrence = await authorizedOccurrence(
      pool,
      input,
      actorDigest(input.actorUserRef),
      sessionDigest(input.sessionRef),
      contextDigest(input.context),
    );
    if (!occurrence) return null;
    const result = await pool.query(
      `UPDATE onetime.production_basic_host_lifecycles
          SET lifecycle_state = $9,
              version = version + 1,
              updated_at = $7
        WHERE account_key = $1
          AND product_key = $2
          AND occurrence_key = $3
          AND meeting_ref_digest = $4
          AND actor_ref_digest = $5
          AND session_ref_digest = $6
          AND lifecycle_context_digest = $8
          AND expires_at > $7
          AND lifecycle_state = ANY($10::text[])
      RETURNING lifecycle_state`,
      [
        input.scope.account_key,
        input.scope.product_key,
        occurrence,
        input.meetingRefDigest,
        actorDigest(input.actorUserRef),
        sessionDigest(input.sessionRef),
        input.now,
        contextDigest(input.context),
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
      const occurrence = await canonicalOccurrence(pool, input.scope, localDate);
      if (!occurrence) return null;
      const result = await pool.query(
        `INSERT INTO onetime.production_basic_host_lifecycles (
            account_key, product_key, occurrence_key, meeting_ref_digest,
            lifecycle_context_digest, actor_ref_digest, session_ref_digest,
            lifecycle_state, expires_at, updated_at
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, 'live', $8, $9)
          ON CONFLICT (account_key, product_key, occurrence_key) DO UPDATE
            SET lifecycle_context_digest = EXCLUDED.lifecycle_context_digest,
                expires_at = EXCLUDED.expires_at,
                version = onetime.production_basic_host_lifecycles.version + 1,
                updated_at = EXCLUDED.updated_at
          WHERE onetime.production_basic_host_lifecycles.meeting_ref_digest = EXCLUDED.meeting_ref_digest
            AND onetime.production_basic_host_lifecycles.actor_ref_digest = EXCLUDED.actor_ref_digest
            AND onetime.production_basic_host_lifecycles.session_ref_digest = EXCLUDED.session_ref_digest
            AND onetime.production_basic_host_lifecycles.expires_at > $9
            AND onetime.production_basic_host_lifecycles.lifecycle_state IN ('live', 'end_requested', 'unknown_effect')
          RETURNING lifecycle_state`,
        [
          input.scope.account_key,
          input.scope.product_key,
          occurrence,
          input.meetingRefDigest,
          contextDigest(context),
          actorDigest(input.actorUserRef),
          sessionDigest(input.sessionRef),
          new Date(input.now.getTime() + PRODUCTION_BASIC_HOST_LIFECYCLE_TTL_MS),
          input.now,
        ],
      );
      if (!result.rows[0]) return null;
      await synchronizeProviderProof(
        pool,
        input.scope,
        occurrence,
        input.meetingRefDigest,
        input.now,
      );
      const state = await exactLifecycleState(pool, {
        ...input,
        occurrenceKey: occurrence,
        actorRefDigest: actorDigest(input.actorUserRef),
        sessionRefDigest: sessionDigest(input.sessionRef),
      });
      return state ? { state, context } : null;
    },
    beginEnd: (input) => transition(input, ['live'], 'end_requested'),
    markUnknown: (input) => transition(input, ['end_requested'], 'unknown_effect'),
    async read(input) {
      const result = await pool.query<{
        lifecycle_state: ProductionBasicHostLifecycleState;
        occurrence_key: string;
      }>(
        `SELECT lifecycle_state, occurrence_key
           FROM onetime.production_basic_host_lifecycles
          WHERE account_key = $1
            AND product_key = $2
            AND meeting_ref_digest = $3
            AND actor_ref_digest = $4
            AND session_ref_digest = $5
            AND lifecycle_context_digest = $6
            AND expires_at > $7
          ORDER BY updated_at DESC, occurrence_key
          LIMIT 1`,
        [
          input.scope.account_key,
          input.scope.product_key,
          input.meetingRefDigest,
          actorDigest(input.actorUserRef),
          sessionDigest(input.sessionRef),
          contextDigest(input.context),
          input.now,
        ],
      );
      const state = result.rows[0]?.lifecycle_state as
        ProductionBasicHostLifecycleState | undefined;
      if (!state) return null;
      return { state, context: input.context };
    },
    async reconcile(input) {
      const occurrence = await authorizedOccurrence(
        pool,
        input,
        actorDigest(input.actorUserRef),
        sessionDigest(input.sessionRef),
        contextDigest(input.context),
      );
      if (!occurrence) return null;
      await synchronizeProviderProof(
        pool,
        input.scope,
        occurrence,
        input.meetingRefDigest,
        input.now,
      );
      return exactLifecycleState(pool, {
        ...input,
        occurrenceKey: occurrence,
        actorRefDigest: actorDigest(input.actorUserRef),
        sessionRefDigest: sessionDigest(input.sessionRef),
        contextRefDigest: contextDigest(input.context),
      });
    },
    async beginCleanup(input) {
      const occurrence = await authorizedOccurrence(
        pool,
        input,
        actorDigest(input.actorUserRef),
        sessionDigest(input.sessionRef),
        contextDigest(input.context),
      );
      if (!occurrence) return null;
      const result = await pool.query<{ provider_meeting_instance_digest: string }>(
        `UPDATE onetime.production_basic_host_lifecycles
            SET lifecycle_state = 'cleanup_pending', version = version + 1, updated_at = $7
          WHERE account_key = $1 AND product_key = $2 AND occurrence_key = $3
            AND meeting_ref_digest = $4 AND actor_ref_digest = $5
            AND session_ref_digest = $6 AND lifecycle_context_digest = $8
            AND expires_at > $7 AND provider_meeting_instance_digest IS NOT NULL
            AND lifecycle_state IN ('provider_ended', 'cleanup_pending')
        RETURNING provider_meeting_instance_digest`,
        [
          input.scope.account_key,
          input.scope.product_key,
          occurrence,
          input.meetingRefDigest,
          actorDigest(input.actorUserRef),
          sessionDigest(input.sessionRef),
          input.now,
          contextDigest(input.context),
        ],
      );
      const instanceDigest = result.rows[0]?.provider_meeting_instance_digest;
      return instanceDigest
        ? {
            scope: input.scope,
            occurrenceKey: occurrence,
            meetingRefDigest: input.meetingRefDigest,
            meetingInstanceDigest: instanceDigest,
            clearedAt: input.now,
          }
        : null;
    },
    finishCleanup: (input) => transition(input, ['cleanup_pending'], 'ended'),
    markCleanupPending: (input) => transition(input, ['cleanup_pending'], 'cleanup_pending'),
    async recordVerifiedProviderEvent({ scope, event }) {
      const occurrence = await occurrenceForProviderStart(pool, scope, event.meetingStartedAt);
      const inserted = await pool.query(
        `INSERT INTO onetime.production_basic_zoom_lifecycle_events (
            provider_event_key_digest, account_key, product_key,
            provider_account_ref_digest, provider_host_ref_digest,
            meeting_ref_digest, meeting_instance_digest, occurrence_key,
            event_type, provider_event_at, meeting_started_at, meeting_ended_at,
            correlation_state, received_at
          ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,'pending',$13)
          ON CONFLICT DO NOTHING`,
        [
          event.providerEventKeyDigest,
          scope.account_key,
          scope.product_key,
          event.providerAccountRefDigest,
          event.providerHostRefDigest,
          event.meetingRefDigest,
          event.meetingInstanceDigest,
          occurrence,
          event.eventType,
          event.providerEventAt,
          event.meetingStartedAt,
          event.meetingEndedAt,
          event.receivedAt,
        ],
      );
      if (occurrence) {
        await synchronizeProviderProof(
          pool,
          scope,
          occurrence,
          event.meetingRefDigest,
          event.receivedAt,
        );
      }
      const cleanupTarget = occurrence
        ? await providerCleanupTarget(pool, {
            scope,
            occurrenceKey: occurrence,
            meetingRefDigest: event.meetingRefDigest,
            meetingInstanceDigest: event.meetingInstanceDigest,
            clearedAt: event.meetingEndedAt ?? event.providerEventAt,
          })
        : null;
      return { duplicate: (inserted.rowCount ?? 0) === 0, cleanupTarget };
    },
    async beginProviderCleanup(input) {
      const result = await pool.query(
        `UPDATE onetime.production_basic_host_lifecycles
            SET lifecycle_state = 'cleanup_pending', version = version + 1, updated_at = $6
          WHERE account_key = $1 AND product_key = $2 AND occurrence_key = $3
            AND meeting_ref_digest = $4 AND provider_meeting_instance_digest = $5
            AND lifecycle_state IN ('provider_ended', 'cleanup_pending')
        RETURNING occurrence_key`,
        [
          input.scope.account_key,
          input.scope.product_key,
          input.occurrenceKey,
          input.meetingRefDigest,
          input.meetingInstanceDigest,
          input.clearedAt,
        ],
      );
      return result.rows[0] ? input : null;
    },
    async finishProviderCleanup(input, succeeded) {
      await pool.query(
        `UPDATE onetime.production_basic_host_lifecycles
            SET lifecycle_state = $6, version = version + 1, updated_at = $7
          WHERE account_key = $1 AND product_key = $2 AND occurrence_key = $3
            AND meeting_ref_digest = $4 AND provider_meeting_instance_digest = $5
            AND lifecycle_state = 'cleanup_pending'`,
        [
          input.scope.account_key,
          input.scope.product_key,
          input.occurrenceKey,
          input.meetingRefDigest,
          input.meetingInstanceDigest,
          succeeded ? 'ended' : 'cleanup_pending',
          input.clearedAt,
        ],
      );
    },
  };
}

async function canonicalOccurrence(pool: DbPool, scope: ProductionBasicScope, localDate: string) {
  const result = await pool.query<{ occurrence_key: string }>(
    `SELECT occurrence.occurrence_key
       FROM onetime.class_occurrences AS occurrence
       JOIN onetime.class_series AS series
         ON series.account_key = occurrence.account_key
        AND series.product_key = occurrence.product_key
        AND series.class_series_key = occurrence.class_series_key
      WHERE occurrence.account_key = $1 AND occurrence.product_key = $2
        AND occurrence.local_class_date = $3::date
        AND series.is_canonical = true AND series.status = 'active'
        AND series.series_state = 'active'
      ORDER BY occurrence.starts_at, occurrence.occurrence_key
      LIMIT 1`,
    [scope.account_key, scope.product_key, localDate],
  );
  return result.rows[0]?.occurrence_key ?? null;
}

async function authorizedOccurrence(
  pool: DbPool,
  input: LifecycleInput,
  actorRefDigest: string,
  sessionRefDigest: string,
  contextRefDigest: string,
) {
  const result = await pool.query<{ occurrence_key: string }>(
    `SELECT occurrence_key
       FROM onetime.production_basic_host_lifecycles
      WHERE account_key = $1 AND product_key = $2
        AND meeting_ref_digest = $3 AND actor_ref_digest = $4
        AND session_ref_digest = $5 AND lifecycle_context_digest = $6
        AND expires_at > $7
      ORDER BY updated_at DESC, occurrence_key
      LIMIT 1`,
    [
      input.scope.account_key,
      input.scope.product_key,
      input.meetingRefDigest,
      actorRefDigest,
      sessionRefDigest,
      contextRefDigest,
      input.now,
    ],
  );
  return result.rows[0]?.occurrence_key ?? null;
}

async function occurrenceForProviderStart(
  pool: DbPool,
  scope: ProductionBasicScope,
  meetingStartedAt: Date,
) {
  const result = await pool.query<{ occurrence_key: string; starts_at: Date }>(
    `SELECT occurrence.occurrence_key, occurrence.starts_at
       FROM onetime.class_occurrences AS occurrence
       JOIN onetime.class_series AS series
         ON series.account_key = occurrence.account_key
        AND series.product_key = occurrence.product_key
        AND series.class_series_key = occurrence.class_series_key
      WHERE occurrence.account_key = $1 AND occurrence.product_key = $2
        AND series.is_canonical = true AND series.status = 'active'
        AND series.series_state = 'active'
        AND occurrence.starts_at BETWEEN $3::timestamptz AND $4::timestamptz
      ORDER BY occurrence.starts_at, occurrence.occurrence_key
      LIMIT 50`,
    [
      scope.account_key,
      scope.product_key,
      new Date(meetingStartedAt.getTime() - PRODUCTION_BASIC_PROVIDER_CORRELATION_WINDOW_MS),
      new Date(meetingStartedAt.getTime() + PRODUCTION_BASIC_PROVIDER_CORRELATION_WINDOW_MS),
    ],
  );
  const closest = result.rows.sort((left, right) => {
    const distance =
      Math.abs(new Date(left.starts_at).getTime() - meetingStartedAt.getTime()) -
      Math.abs(new Date(right.starts_at).getTime() - meetingStartedAt.getTime());
    return distance || left.occurrence_key.localeCompare(right.occurrence_key);
  })[0];
  return closest?.occurrence_key ?? null;
}

async function synchronizeProviderProof(
  pool: DbPool,
  scope: ProductionBasicScope,
  occurrenceKey: string,
  meetingRefDigest: string,
  now: Date,
) {
  const lifecycle = await pool.query<{
    provider_meeting_instance_digest?: string | null;
    updated_at: Date;
  }>(
    `SELECT provider_meeting_instance_digest, updated_at
       FROM onetime.production_basic_host_lifecycles
      WHERE account_key = $1 AND product_key = $2 AND occurrence_key = $3
        AND meeting_ref_digest = $4 AND expires_at > $5
      LIMIT 1`,
    [scope.account_key, scope.product_key, occurrenceKey, meetingRefDigest, now],
  );
  if (!lifecycle.rows[0]) return;
  let instanceDigest = lifecycle.rows[0].provider_meeting_instance_digest ?? null;
  if (!instanceDigest) {
    const started = await pool.query<{
      meeting_instance_digest: string;
      meeting_started_at: Date;
      received_at: Date;
      provider_event_key_digest: string;
    }>(
      `SELECT meeting_instance_digest, meeting_started_at, received_at,
              provider_event_key_digest
         FROM onetime.production_basic_zoom_lifecycle_events
        WHERE account_key = $1 AND product_key = $2 AND occurrence_key = $3
          AND meeting_ref_digest = $4 AND event_type = 'meeting_started'
        ORDER BY meeting_started_at, received_at, provider_event_key_digest
        LIMIT 50`,
      [scope.account_key, scope.product_key, occurrenceKey, meetingRefDigest],
    );
    const lifecycleAt = new Date(lifecycle.rows[0].updated_at).getTime();
    const closest = started.rows.sort((left, right) => {
      const distance =
        Math.abs(new Date(left.meeting_started_at).getTime() - lifecycleAt) -
        Math.abs(new Date(right.meeting_started_at).getTime() - lifecycleAt);
      if (distance) return distance;
      const startedOrder =
        new Date(left.meeting_started_at).getTime() - new Date(right.meeting_started_at).getTime();
      if (startedOrder) return startedOrder;
      const receivedOrder =
        new Date(left.received_at).getTime() - new Date(right.received_at).getTime();
      return (
        receivedOrder ||
        left.provider_event_key_digest.localeCompare(right.provider_event_key_digest)
      );
    })[0];
    instanceDigest = closest?.meeting_instance_digest ?? null;
    if (instanceDigest) {
      const bound = await pool.query(
        `UPDATE onetime.production_basic_host_lifecycles
            SET provider_meeting_instance_digest = $5, version = version + 1, updated_at = $6
          WHERE account_key = $1 AND product_key = $2 AND occurrence_key = $3
            AND meeting_ref_digest = $4 AND provider_meeting_instance_digest IS NULL
            AND lifecycle_state IN ('live', 'end_requested', 'unknown_effect')
        RETURNING occurrence_key`,
        [
          scope.account_key,
          scope.product_key,
          occurrenceKey,
          meetingRefDigest,
          instanceDigest,
          now,
        ],
      );
      if (!bound.rows[0]) instanceDigest = null;
    }
  }
  if (!instanceDigest) return;
  await pool.query(
    `UPDATE onetime.production_basic_zoom_lifecycle_events
        SET correlation_state = 'correlated'
      WHERE account_key = $1 AND product_key = $2 AND occurrence_key = $3
        AND meeting_ref_digest = $4 AND meeting_instance_digest = $5`,
    [scope.account_key, scope.product_key, occurrenceKey, meetingRefDigest, instanceDigest],
  );
  await pool.query(
    `UPDATE onetime.production_basic_host_lifecycles
        SET lifecycle_state = 'provider_ended', version = version + 1, updated_at = $6
      WHERE account_key = $1 AND product_key = $2
        AND occurrence_key = $3 AND meeting_ref_digest = $4
        AND provider_meeting_instance_digest = $5
        AND lifecycle_state IN ('live', 'end_requested', 'unknown_effect')
        AND EXISTS (
          SELECT 1 FROM onetime.production_basic_zoom_lifecycle_events AS event
           WHERE event.account_key = $1
             AND event.product_key = $2
             AND event.occurrence_key = $3
             AND event.meeting_ref_digest = $4
             AND event.meeting_instance_digest = $5
             AND event.event_type = 'meeting_ended'
        )`,
    [scope.account_key, scope.product_key, occurrenceKey, meetingRefDigest, instanceDigest, now],
  );
}

async function exactLifecycleState(
  pool: DbPool,
  input: LifecycleActorInput & {
    occurrenceKey: string;
    actorRefDigest: string;
    sessionRefDigest: string;
    contextRefDigest?: string;
  },
) {
  const values: unknown[] = [
    input.scope.account_key,
    input.scope.product_key,
    input.occurrenceKey,
    input.meetingRefDigest,
    input.actorRefDigest,
    input.sessionRefDigest,
    input.now,
  ];
  const contextClause = input.contextRefDigest
    ? ` AND lifecycle_context_digest = $${values.push(input.contextRefDigest)}`
    : '';
  const result = await pool.query(
    `SELECT lifecycle_state FROM onetime.production_basic_host_lifecycles
      WHERE account_key = $1 AND product_key = $2 AND occurrence_key = $3
        AND meeting_ref_digest = $4 AND actor_ref_digest = $5
        AND session_ref_digest = $6 AND expires_at > $7${contextClause}
      LIMIT 1`,
    values,
  );
  return (result.rows[0]?.lifecycle_state as ProductionBasicHostLifecycleState | undefined) ?? null;
}

async function providerCleanupTarget(pool: DbPool, input: ProductionBasicProviderCleanupTarget) {
  const result = await pool.query(
    `SELECT 1 FROM onetime.production_basic_host_lifecycles
      WHERE account_key = $1 AND product_key = $2 AND occurrence_key = $3
        AND meeting_ref_digest = $4 AND provider_meeting_instance_digest = $5
        AND lifecycle_state IN ('provider_ended', 'cleanup_pending')
      LIMIT 1`,
    [
      input.scope.account_key,
      input.scope.product_key,
      input.occurrenceKey,
      input.meetingRefDigest,
      input.meetingInstanceDigest,
    ],
  );
  return result.rows[0] ? input : null;
}

export function productionBasicDigest(domain: string, value: string) {
  return createHash('sha256').update(`${domain}\0${value}`).digest('hex');
}
