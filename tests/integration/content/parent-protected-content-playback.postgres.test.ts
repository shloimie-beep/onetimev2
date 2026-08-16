import { createHash } from 'node:crypto';
import pg from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { createPostgresParentLearningRepository } from '../../../apps/web/src/server/features/portals/parent-learning/postgres-repository.ts';
import {
  PARENT_LEARNING_ERROR_CODES,
  type ParentLearningPrincipal,
} from '../../../packages/contracts/src/portals/parent-learning/index.ts';
import { runMigrations, type DbPool } from '../../../packages/db/src/index.ts';

const nativeDatabaseUrl = process.env.PARENT_PLAYBACK_NATIVE_DATABASE_URL;
const nativeProofEnabled =
  process.env.PARENT_PLAYBACK_NATIVE_POSTGRES_DISPOSABLE === 'true' && Boolean(nativeDatabaseUrl);

const ACCOUNT_KEY = 'native_parent_playback';
const PRODUCT_KEY = 'one_time_mishnayos';
const RUNTIME_TIER = 'isolated_staging';
const VERIFICATION_ENVIRONMENT_ID = 'ci';
const OBSERVED_AT = '2026-08-16T12:00:00.000Z';
const ADULT_ID = 'native_parent_playback_adult';
const HUMAN_ACCOUNT_ID = 'native_parent_playback_human';
const HOUSEHOLD_ID = 'native_parent_playback_household';
const PARTICIPANT_ID = `parent:${HOUSEHOLD_ID}`;
const SESSION_ID = 'native_parent_playback_session';
const BORROWER_ADULT_ID = 'native_parent_playback_borrower_adult';
const BORROWER_HUMAN_ACCOUNT_ID = 'native_parent_playback_borrower_human';
const BORROWER_SESSION_ID = 'native_parent_playback_borrower_session';
const CLASS_SERIES_KEY = 'native_parent_playback_canonical_class';
const EXISTING_CONTENT_ID = 'native_parent_playback_existing_vimeo';
const EXISTING_VERSION_ID = 'native_parent_playback_existing_vimeo_v1';
const EXISTING_DURATION_MS = 91_000;
const FACTORY_CONTENT_ID = 'native_parent_playback_content_factory';
const FACTORY_VERSION_ID = 'native_parent_playback_content_factory_v1';
const FACTORY_DURATION_MS = 89_000;

const principal: ParentLearningPrincipal = {
  role: 'parent',
  adult_id: ADULT_ID,
  human_account_id: HUMAN_ACCOUNT_ID,
  household_id: HOUSEHOLD_ID,
  session_id: SESSION_ID,
};

const borrowingPrincipal: ParentLearningPrincipal = {
  role: 'parent',
  adult_id: BORROWER_ADULT_ID,
  human_account_id: BORROWER_HUMAN_ACCOUNT_ID,
  household_id: HOUSEHOLD_ID,
  session_id: BORROWER_SESSION_ID,
};

describe('Parent playback native PostgreSQL target guard', () => {
  it('accepts only a distinct disposable loopback database prefix', () => {
    expect(() =>
      assertDisposableLoopback(
        nativeTestDatabaseUrl('127.0.0.1', 'onetime_parent_playback_progress_ci_16'),
      ),
    ).not.toThrow();
    expect(() =>
      assertDisposableLoopback(
        nativeTestDatabaseUrl('localhost', 'onetime_parent_playback_progress_ci_18'),
      ),
    ).not.toThrow();
  });

  it.each([
    nativeTestDatabaseUrl('10.0.0.8', 'onetime_parent_playback_progress_ci_16'),
    nativeTestDatabaseUrl('127.0.0.1', 'postgres'),
    nativeTestDatabaseUrl('127.0.0.1', 'onetime_parent_welcome_digest_ci_16'),
  ])('rejects a non-disposable native target: %s', (value) => {
    expect(() => assertDisposableLoopback(value)).toThrow(
      /onetime_parent_playback_progress_\* loopback database/u,
    );
  });
});

describe.runIf(nativeProofEnabled)('Parent playback progress on native PostgreSQL', () => {
  let pool: DbPool | undefined;
  let ownsSchema = false;

  beforeAll(async () => {
    assertDisposableLoopback(nativeDatabaseUrl!);
    pool = new pg.Pool({ connectionString: nativeDatabaseUrl!, max: 4 });
    const database = await pool.query(
      `SELECT current_database() AS database_name,
              current_setting('server_version_num') AS server_version_num`,
    );
    expect(database.rows[0]?.database_name).toBe(new URL(nativeDatabaseUrl!).pathname.slice(1));
    expect(Number(database.rows[0]?.server_version_num)).toBeGreaterThanOrEqual(160_000);
    const tables = await pool.query(
      `SELECT count(*)::integer AS table_count
         FROM information_schema.tables
        WHERE table_schema NOT IN ('pg_catalog', 'information_schema')`,
    );
    expect(tables.rows[0]).toEqual({ table_count: 0 });
    ownsSchema = true;
    const first = await runMigrations(pool);
    const replay = await runMigrations(pool);
    expect(first.some(({ status }) => status === 'applied')).toBe(true);
    expect(replay.every(({ status }) => status === 'already_applied')).toBe(true);
    await seedPlaybackScope(pool);
  }, 120_000);

  afterAll(async () => {
    if (!pool) return;
    if (ownsSchema) await pool.query('DROP SCHEMA IF EXISTS onetime CASCADE');
    await pool.end();
  }, 30_000);

  it('executes the exact governed target SELECT for both sources and binds the exact actor', async () => {
    const repository = createPostgresParentLearningRepository(pool!, {
      accountKey: ACCOUNT_KEY,
      clock: () => new Date(OBSERVED_AT),
    });

    await expect(
      repository.loadContentProgressTarget({
        principal,
        participant_id: PARTICIPANT_ID,
        content_id: EXISTING_CONTENT_ID,
        content_version_id: EXISTING_VERSION_ID,
      }),
    ).resolves.toEqual({
      content_id: EXISTING_CONTENT_ID,
      content_version_id: EXISTING_VERSION_ID,
      duration_ms: EXISTING_DURATION_MS,
    });
    await expect(
      repository.loadContentProgressTarget({
        principal,
        participant_id: PARTICIPANT_ID,
        content_id: FACTORY_CONTENT_ID,
        content_version_id: FACTORY_VERSION_ID,
      }),
    ).resolves.toEqual({
      content_id: FACTORY_CONTENT_ID,
      content_version_id: FACTORY_VERSION_ID,
      duration_ms: FACTORY_DURATION_MS,
    });
    await expect(
      repository.loadContentProgressTarget({
        principal: borrowingPrincipal,
        participant_id: PARTICIPANT_ID,
        content_id: EXISTING_CONTENT_ID,
        content_version_id: EXISTING_VERSION_ID,
      }),
    ).resolves.toBeNull();
    await expect(
      repository.loadContentProgressTarget({
        principal,
        participant_id: PARTICIPANT_ID,
        content_id: EXISTING_CONTENT_ID,
        content_version_id: `${EXISTING_VERSION_ID}-stale`,
      }),
    ).resolves.toBeNull();

    await expect(
      repository.recordContentProgress({
        principal: borrowingPrincipal,
        write: progressWrite({
          contentId: EXISTING_CONTENT_ID,
          contentVersionId: EXISTING_VERSION_ID,
          positionMs: 1,
          durationMs: EXISTING_DURATION_MS,
          completed: false,
          idempotencyKey: 'native-parent-borrower-denied',
          requestHash: digest('native-parent-borrower-denied'),
        }),
      }),
    ).rejects.toMatchObject({ code: PARENT_LEARNING_ERROR_CODES.targetUnavailable });
  });

  it('fails closed on canonical, entitlement, and existing-Vimeo duration revocation', async () => {
    const repository = createPostgresParentLearningRepository(pool!, {
      accountKey: ACCOUNT_KEY,
      clock: () => new Date(OBSERVED_AT),
    });
    const existingTarget = () =>
      repository.loadContentProgressTarget({
        principal,
        participant_id: PARTICIPANT_ID,
        content_id: EXISTING_CONTENT_ID,
        content_version_id: EXISTING_VERSION_ID,
      });

    await transitionAccess(pool!, {
      previousState: 'free',
      nextState: 'inactive',
      expectedVersion: 1,
      accessCause: 'administrative_block',
      suffix: 'inactive',
    });
    await expect(existingTarget()).resolves.toBeNull();
    await expect(
      repository.recordContentProgress({
        principal,
        write: progressWrite({
          contentId: EXISTING_CONTENT_ID,
          contentVersionId: EXISTING_VERSION_ID,
          positionMs: 1,
          durationMs: EXISTING_DURATION_MS,
          completed: false,
          idempotencyKey: 'native-canonical-access-denied',
          requestHash: digest('native-canonical-access-denied'),
        }),
      }),
    ).rejects.toMatchObject({ code: PARENT_LEARNING_ERROR_CODES.targetUnavailable });
    await transitionAccess(pool!, {
      previousState: 'inactive',
      nextState: 'free',
      expectedVersion: 2,
      accessCause: 'free_period',
      suffix: 'restored',
    });

    await pool!.query(
      `UPDATE onetime.class_series
          SET series_state = 'paused'
        WHERE class_series_key = $1`,
      [CLASS_SERIES_KEY],
    );
    await expect(existingTarget()).resolves.toBeNull();
    await pool!.query(
      `UPDATE onetime.class_series
          SET series_state = 'active'
        WHERE class_series_key = $1`,
      [CLASS_SERIES_KEY],
    );

    await pool!.query(
      `UPDATE onetime.parent_learning_class_entitlements
          SET entitlement_state = 'revoked', revoked_at = $2::timestamptz
        WHERE participant_id = $1`,
      [PARTICIPANT_ID, OBSERVED_AT],
    );
    await expect(existingTarget()).resolves.toBeNull();
    await pool!.query(
      `UPDATE onetime.parent_learning_class_entitlements
          SET entitlement_state = 'active', revoked_at = NULL
        WHERE participant_id = $1`,
      [PARTICIPANT_ID],
    );

    await pool!.query(
      `UPDATE onetime.content_item_entitlements
          SET entitlement_state = 'revoked', revoked_at = $2::timestamptz
        WHERE content_item_key = $1`,
      [EXISTING_CONTENT_ID, OBSERVED_AT],
    );
    await expect(existingTarget()).resolves.toBeNull();
    await pool!.query(
      `UPDATE onetime.content_item_entitlements
          SET entitlement_state = 'active', revoked_at = NULL
        WHERE content_item_key = $1`,
      [EXISTING_CONTENT_ID],
    );

    for (const invalidDuration of [0, null]) {
      await pool!.query(
        `UPDATE onetime.ot104r_vimeo_sources
            SET duration_ms = $2
          WHERE source_key = $1`,
        [EXISTING_CONTENT_ID, invalidDuration],
      );
      await expect(existingTarget()).resolves.toBeNull();
    }
    await pool!.query(
      `UPDATE onetime.ot104r_vimeo_sources
          SET duration_ms = $2
        WHERE source_key = $1`,
      [EXISTING_CONTENT_ID, EXISTING_DURATION_MS],
    );
    await expect(existingTarget()).resolves.toMatchObject({
      duration_ms: EXISTING_DURATION_MS,
    });
  });

  it('executes the atomic CTE/INSERT with governed duration, completion, and idempotency', async () => {
    const repository = createPostgresParentLearningRepository(pool!, {
      accountKey: ACCOUNT_KEY,
      clock: () => new Date(OBSERVED_AT),
    });

    for (const target of [
      {
        contentId: EXISTING_CONTENT_ID,
        contentVersionId: EXISTING_VERSION_ID,
        durationMs: EXISTING_DURATION_MS,
      },
      {
        contentId: FACTORY_CONTENT_ID,
        contentVersionId: FACTORY_VERSION_ID,
        durationMs: FACTORY_DURATION_MS,
      },
    ]) {
      await expect(
        repository.recordContentProgress({
          principal,
          write: progressWrite({
            ...target,
            positionMs: 1,
            durationMs: 1,
            completed: true,
            idempotencyKey: `native-duration-mismatch-${target.contentId}`,
            requestHash: digest(`native-duration-mismatch-${target.contentId}`),
          }),
        }),
      ).rejects.toMatchObject({ code: PARENT_LEARNING_ERROR_CODES.targetUnavailable });
    }

    const existingEarly = progressWrite({
      contentId: EXISTING_CONTENT_ID,
      contentVersionId: EXISTING_VERSION_ID,
      positionMs: 45_000,
      durationMs: EXISTING_DURATION_MS,
      completed: true,
      idempotencyKey: 'native-existing-early-progress',
      requestHash: digest('native-existing-early-progress'),
    });
    await expect(
      repository.recordContentProgress({ principal, write: existingEarly }),
    ).resolves.toMatchObject({ disposition: 'committed' });
    await expect(
      repository.recordContentProgress({ principal, write: existingEarly }),
    ).resolves.toMatchObject({ disposition: 'replayed' });
    await expect(
      repository.recordContentProgress({
        principal,
        write: {
          ...existingEarly,
          context: {
            ...existingEarly.context,
            canonical_request_hash: digest('native-existing-early-progress-conflict'),
          },
        },
      }),
    ).rejects.toMatchObject({ code: PARENT_LEARNING_ERROR_CODES.idempotencyConflict });

    const factoryEnd = progressWrite({
      contentId: FACTORY_CONTENT_ID,
      contentVersionId: FACTORY_VERSION_ID,
      positionMs: FACTORY_DURATION_MS,
      durationMs: FACTORY_DURATION_MS,
      completed: false,
      idempotencyKey: 'native-factory-completed-progress',
      requestHash: digest('native-factory-completed-progress'),
    });
    await expect(
      repository.recordContentProgress({ principal, write: factoryEnd }),
    ).resolves.toMatchObject({ disposition: 'committed' });
    await expect(
      repository.recordContentProgress({ principal, write: factoryEnd }),
    ).resolves.toMatchObject({ disposition: 'replayed' });

    const stored = await pool!.query(
      `SELECT content_id, position_ms::text, duration_ms::text, completed, completed_at
         FROM onetime.parent_learning_content_progress_events
        ORDER BY content_id`,
    );
    expect(stored.rows).toHaveLength(2);
    expect(stored.rows).toEqual([
      {
        content_id: FACTORY_CONTENT_ID,
        position_ms: String(FACTORY_DURATION_MS),
        duration_ms: String(FACTORY_DURATION_MS),
        completed: true,
        completed_at: new Date(OBSERVED_AT),
      },
      {
        content_id: EXISTING_CONTENT_ID,
        position_ms: '45000',
        duration_ms: String(EXISTING_DURATION_MS),
        completed: false,
        completed_at: null,
      },
    ]);
  });
});

function progressWrite(input: {
  contentId: string;
  contentVersionId: string;
  positionMs: number;
  durationMs: number;
  completed: boolean;
  idempotencyKey: string;
  requestHash: string;
}) {
  return {
    participant_id: PARTICIPANT_ID,
    household_id: HOUSEHOLD_ID,
    actor_kind: 'parent' as const,
    content_id: input.contentId,
    content_version_id: input.contentVersionId,
    position_ms: input.positionMs,
    duration_ms: input.durationMs,
    completed: input.completed,
    context: {
      idempotency_key: input.idempotencyKey,
      canonical_request_hash: input.requestHash,
      occurred_at: OBSERVED_AT,
    },
  };
}

async function seedPlaybackScope(pool: DbPool) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    for (const adult of [
      {
        adultId: ADULT_ID,
        humanAccountId: HUMAN_ACCOUNT_ID,
        email: 'native-parent-playback@example.test',
        displayName: 'Native Parent',
      },
      {
        adultId: BORROWER_ADULT_ID,
        humanAccountId: BORROWER_HUMAN_ACCOUNT_ID,
        email: 'native-parent-playback-borrower@example.test',
        displayName: 'Native Borrower',
      },
    ]) {
      await client.query(
        `INSERT INTO onetime.v21_adult_identities
           (adult_id, normalized_email, display_name, state, product_key,
            runtime_tier, verification_environment_id)
         VALUES ($1,$2,$3,'active',$4,$5,$6)`,
        [
          adult.adultId,
          adult.email,
          adult.displayName,
          PRODUCT_KEY,
          RUNTIME_TIER,
          VERIFICATION_ENVIRONMENT_ID,
        ],
      );
      await client.query(
        `INSERT INTO onetime.v21_human_accounts
           (human_account_id, adult_id, state, product_key, runtime_tier,
            verification_environment_id)
         VALUES ($1,$2,'active',$3,$4,$5)`,
        [
          adult.humanAccountId,
          adult.adultId,
          PRODUCT_KEY,
          RUNTIME_TIER,
          VERIFICATION_ENVIRONMENT_ID,
        ],
      );
    }

    await client.query(
      `INSERT INTO onetime.v21_households
         (household_id, owner_adult_id, owner_human_account_id, classification, state,
          seat_limit, active_seat_count, access_aggregate_ref, product_key,
          runtime_tier, verification_environment_id)
       VALUES ($1,$2,$3,'family','active',3,0,$1,$4,$5,$6)`,
      [
        HOUSEHOLD_ID,
        ADULT_ID,
        HUMAN_ACCOUNT_ID,
        PRODUCT_KEY,
        RUNTIME_TIER,
        VERIFICATION_ENVIRONMENT_ID,
      ],
    );
    await client.query(
      `INSERT INTO onetime.class_series
         (class_series_key, account_key, product_key, title, timezone,
          local_start_time, reminder_local_time, reminder_minutes_before, status,
          series_state, is_canonical, recurrence_weekdays, recurrence_starts_on,
          duration_minutes, teacher_profile_key)
       VALUES ($1,$2,$3,'Native Parent playback class','Asia/Jerusalem','19:00',
         '18:30',30,'active','active',true,ARRAY[1,2,3,4,7]::smallint[],
         '2026-08-01',60,'native-rabbi')`,
      [CLASS_SERIES_KEY, ACCOUNT_KEY, PRODUCT_KEY],
    );
    await client.query(
      `INSERT INTO onetime.parent_learning_participants
         (participant_id, household_id, adult_id, human_account_id, participant_kind,
          learner_ordinal, state, product_key, runtime_tier, verification_environment_id)
       VALUES ($1,$2,$3,$4,'parent',1,'active',$5,$6,$7)`,
      [
        PARTICIPANT_ID,
        HOUSEHOLD_ID,
        ADULT_ID,
        HUMAN_ACCOUNT_ID,
        PRODUCT_KEY,
        RUNTIME_TIER,
        VERIFICATION_ENVIRONMENT_ID,
      ],
    );
    await client.query(
      `INSERT INTO onetime.parent_learning_class_entitlements
         (entitlement_id, participant_id, household_id, account_key, product_key,
          runtime_tier, verification_environment_id, class_series_key,
          entitlement_state, source, effective_at)
       VALUES ('native-parent-playback-class-entitlement',$1,$2,$3,$4,$5,$6,$7,
         'active','admin_repair','2026-08-01T00:00:00.000Z')`,
      [
        PARTICIPANT_ID,
        HOUSEHOLD_ID,
        ACCOUNT_KEY,
        PRODUCT_KEY,
        RUNTIME_TIER,
        VERIFICATION_ENVIRONMENT_ID,
        CLASS_SERIES_KEY,
      ],
    );

    for (const session of [
      { sessionId: SESSION_ID, humanAccountId: HUMAN_ACCOUNT_ID },
      { sessionId: BORROWER_SESSION_ID, humanAccountId: BORROWER_HUMAN_ACCOUNT_ID },
    ]) {
      await client.query(
        `INSERT INTO onetime.v21_adult_sessions
           (session_id, human_account_id, active_role, active_household_id,
            access_token_digest, refresh_token_digest, security_version,
            idle_expires_at, absolute_expires_at, product_key, runtime_tier,
            verification_environment_id)
         VALUES ($1,$2,'parent',$3,$4,$5,1,'2026-08-17T12:00:00.000Z',
           '2026-08-18T12:00:00.000Z',$6,$7,$8)`,
        [
          session.sessionId,
          session.humanAccountId,
          HOUSEHOLD_ID,
          digest(`${session.sessionId}-access`),
          digest(`${session.sessionId}-refresh`),
          PRODUCT_KEY,
          RUNTIME_TIER,
          VERIFICATION_ENVIRONMENT_ID,
        ],
      );
    }

    await client.query(
      `INSERT INTO onetime.canonical_state_transition_events
         (transition_key, aggregate_kind, aggregate_key, previous_state, next_state,
          expected_version, resulting_version, product_key, runtime_tier,
          verification_environment_id, actor_kind, actor_key, idempotency_key,
          canonical_request_hash, access_cause, created_at)
       VALUES ('native-parent-playback-access-created','access',$1,NULL,'free',0,1,
         $2,$3,$4,'system','native-parent-playback-seed',
         'native-parent-playback-access-created',$5,'free_period',$6::timestamptz)`,
      [
        HOUSEHOLD_ID,
        PRODUCT_KEY,
        RUNTIME_TIER,
        VERIFICATION_ENVIRONMENT_ID,
        digest('native-parent-playback-access-created'),
        OBSERVED_AT,
      ],
    );

    for (const content of [
      {
        contentId: EXISTING_CONTENT_ID,
        versionId: EXISTING_VERSION_ID,
        title: 'Native existing Vimeo lesson',
      },
      {
        contentId: FACTORY_CONTENT_ID,
        versionId: FACTORY_VERSION_ID,
        title: 'Native Content Factory lesson',
      },
    ]) {
      await client.query(
        `INSERT INTO onetime.content_items
           (content_item_key, account_key, product_key, title, item_type,
            lifecycle_state, latest_revision_number, latest_revision_key,
            published_revision_key, retention_state, metadata, published_at)
         VALUES ($1,$2,$3,$4,'video','published',1,$5,$5,'active','{}'::jsonb,
           $6::timestamptz)`,
        [
          content.contentId,
          ACCOUNT_KEY,
          PRODUCT_KEY,
          content.title,
          content.versionId,
          OBSERVED_AT,
        ],
      );
      await client.query(
        `INSERT INTO onetime.content_revisions
           (revision_key, account_key, product_key, content_item_key,
            outcome_event_key, revision_number, lifecycle_state, published_at)
         VALUES ($1,$2,$3,$4,$5,1,'published',$6::timestamptz)`,
        [
          content.versionId,
          ACCOUNT_KEY,
          PRODUCT_KEY,
          content.contentId,
          `native-outcome-${content.contentId}`,
          OBSERVED_AT,
        ],
      );
      await client.query(
        `INSERT INTO onetime.content_item_entitlements
           (entitlement_key, account_key, product_key, content_item_key,
            audience, household_key, entitlement_state)
         VALUES ($1,$2,$3,$4,'household',$5,'active')`,
        [
          `native-entitlement-${content.contentId}`,
          ACCOUNT_KEY,
          PRODUCT_KEY,
          content.contentId,
          HOUSEHOLD_ID,
        ],
      );
    }

    await client.query(
      `INSERT INTO onetime.ot104r_vimeo_sources
         (source_key, account_key, product_key, content_id, source_record_id,
          idempotency_key, request_sha256, source_ref_digest, title, source_sha256,
          byte_length, submitted_by_actor_id, registration_mode, provider_video_id,
          privacy_state, processing_state, duration_ms, sanitized_metadata_json)
       VALUES ($1,'rabbi_sheller_provider','one_time_mishnah_class',$2,
         'native-parent-playback-existing-record','native-parent-playback-existing-source',
         $3,$4,'Native existing Vimeo lesson',$5,1024,$6,'existing_private_video',
         '1234567890','private','available',$7,$8::jsonb)`,
      [
        EXISTING_CONTENT_ID,
        EXISTING_CONTENT_ID,
        digest('native-existing-request'),
        digest('native-existing-reference'),
        digest('native-existing-source'),
        ADULT_ID,
        EXISTING_DURATION_MS,
        JSON.stringify({ protection_digest: digest('native-existing-protection') }),
      ],
    );
    await client.query(
      `INSERT INTO onetime.learning_delivery_content_factory_items
         (source_key, account_key, product_key, source_kind, source_ref_digest,
          source_sha256, display_name, mime_type, byte_length, factory_state,
          original_duration_ms, prepared_duration_ms, trim_start_ms, trim_end_ms,
          trim_confidence, normalized_transcript, transcript_sha256, webvtt,
          webvtt_sha256, transcription_model, transcription_language,
          transcript_review_state, draft_json, provider_video_id, vimeo_privacy,
          captions_active, approved_by_user_key, approved_at, published_by_user_key,
          published_at, processing_mode)
       VALUES ($1,$2,$3,'local_drop',$4,$5,'native-content-factory.mp4','video/mp4',
         1024,'published',$6,$6,0,$6,1,'Native approved transcript',$7,'WEBVTT',$8,
         'native-transcriber','en','approved','{}'::jsonb,'2345678901','private',true,
         $9,$10::timestamptz,$9,$10::timestamptz,'vimeo')`,
      [
        FACTORY_CONTENT_ID,
        ACCOUNT_KEY,
        PRODUCT_KEY,
        digest('native-factory-reference'),
        digest('native-factory-source'),
        FACTORY_DURATION_MS,
        digest('native-factory-transcript'),
        digest('native-factory-webvtt'),
        ADULT_ID,
        OBSERVED_AT,
      ],
    );
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

async function transitionAccess(
  pool: DbPool,
  input: {
    previousState: 'free' | 'inactive';
    nextState: 'free' | 'inactive';
    expectedVersion: number;
    accessCause: 'administrative_block' | 'free_period';
    suffix: string;
  },
) {
  const resultingVersion = input.expectedVersion + 1;
  const transitionKey = `native-parent-playback-access-${input.suffix}`;
  await pool.query(
    `INSERT INTO onetime.canonical_state_transition_events
       (transition_key, aggregate_kind, aggregate_key, previous_state, next_state,
        expected_version, resulting_version, product_key, runtime_tier,
        verification_environment_id, actor_kind, actor_key, idempotency_key,
        canonical_request_hash, access_cause, created_at)
     VALUES ($1,'access',$2,$3,$4,$5,$6,$7,$8,$9,'system',
       'native-parent-playback-test',$1,$10,$11,$12::timestamptz)`,
    [
      transitionKey,
      HOUSEHOLD_ID,
      input.previousState,
      input.nextState,
      input.expectedVersion,
      resultingVersion,
      PRODUCT_KEY,
      RUNTIME_TIER,
      VERIFICATION_ENVIRONMENT_ID,
      digest(transitionKey),
      input.accessCause,
      OBSERVED_AT,
    ],
  );
}

function assertDisposableLoopback(value: string) {
  const url = new URL(value);
  if (
    !['127.0.0.1', 'localhost'].includes(url.hostname) ||
    !/^onetime_parent_playback_progress_[a-z0-9_]+$/u.test(url.pathname.slice(1))
  ) {
    throw new Error(
      'PARENT_PLAYBACK_NATIVE_DATABASE_URL must be an onetime_parent_playback_progress_* loopback database',
    );
  }
}

function nativeTestDatabaseUrl(hostname: string, databaseName: string) {
  const url = new URL('postgresql://localhost');
  url.hostname = hostname;
  url.port = '5432';
  url.pathname = `/${databaseName}`;
  return url.toString();
}

function digest(value: string) {
  return createHash('sha256').update(value).digest('hex');
}
