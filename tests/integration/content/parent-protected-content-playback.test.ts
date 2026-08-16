import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../../../apps/web/src/server/app.ts';
import { createV21AdultSessionRuntime } from '../../../apps/web/src/server/features/auth/v21-adult-session.ts';
import { createPostgresParentLearningRepository } from '../../../apps/web/src/server/features/portals/parent-learning/postgres-repository.ts';
import { loadConfig, type AppConfig } from '../../../packages/config/src/index.ts';
import { createMemoryPool, runMigrations, type DbPool } from '../../../packages/db/src/index.ts';
import { getContentFactoryPlayback } from '../../../packages/domain/src/content/content-factory.ts';
import { adoptExistingPrivateVimeo } from '../../../packages/domain/src/content/existing-vimeo-adoption.ts';
import { createDbBackedTestAdultSessionRepository } from '../../support/pgmem-v21-parent-session-repository.ts';

const observedAt = new Date('2026-08-16T12:00:00.000Z');
const durationMs = 91_000;
const factoryDurationMs = 89_000;
let pool: DbPool;
let config: AppConfig;
let server: ReturnType<ReturnType<typeof createApp>['listen']>;
let baseUrl: string;
let lastPgMemQueryFailure = '';

beforeEach(async () => {
  lastPgMemQueryFailure = '';
  config = loadConfig({
    NODE_ENV: 'test',
    PUBLIC_BASE_URL: 'https://join.onetimeonetime.com',
    APP_VERSION: 'parent-protected-content-playback-test',
    COMMIT_SHA: 'parent-protected-content-playback-test',
    OUTBOX_TRANSPORT_MODE: 'sink',
    AUTH_CSRF_SECRET: 'parent-protected-content-playback-test-secret',
    ONE_TIME_LIFECYCLE_DELIVERY_KEY:
      'parent-protected-content-playback-lifecycle-delivery-key-for-tests',
    ONE_TIME_FREE_ACCESS_EXPIRES_AT: '2026-12-31T23:59:59.000Z',
    PARENT_STUDENT_SERVICE_ACCOUNT_VERSION: 'parent-protected-content-test-v1',
    PARENT_STUDENT_SERVICE_ACCOUNT_EVIDENCE_REFERENCE:
      'test-only-evidence/parent-protected-content-v1',
  });
  const memoryPool = createMemoryPool();
  await runMigrations(memoryPool);
  pool = pgMemCompatiblePool(memoryPool);
  await pool.query(
    `INSERT INTO onetime.class_series
       (class_series_key, account_key, product_key, title, timezone, local_start_time,
        reminder_local_time, status, series_state, is_canonical)
     VALUES ('parent_protected_content_class', $1, $2, 'Parent protected content class',
       'Asia/Jerusalem', '19:00', '18:30', 'active', 'active', true)`,
    [config.accountKey, config.productKey],
  );
  const sessions = createV21AdultSessionRuntime({
    repository: createDbBackedTestAdultSessionRepository(pool),
    repositoryFactory: (db) => createDbBackedTestAdultSessionRepository(db as DbPool),
    hmacSecret: config.authCsrfSecret,
    clock: () => new Date(observedAt),
  });
  server = await listenForTest(
    createApp({
      config,
      pool,
      clock: () => new Date(observedAt),
      v21AdultSessionRuntime: sessions,
    }),
  );
  baseUrl = serverBaseUrl(server);
});

afterEach(async () => {
  if (server) await new Promise<void>((resolve) => server.close(() => resolve()));
  if (pool) await pool.end();
});

describe('Parent protected-content list, player, and progress journey', () => {
  it('records exact-version progress and fails closed on cross-household, revocation, and missing participant', async () => {
    const first = await signupFamily('first-parent-playback@example.test', 'First', 'Parent');
    const adopted = await adoptExistingPrivateVimeo({
      pool,
      config,
      actorUserKey: 'parent-protected-content-admin',
      actorRole: 'admin',
      command: {
        provider_video_id: '1234567890',
        title: 'Parent protected lesson',
        source_sha256: 'a'.repeat(64),
        reviewed_source_digest: 'b'.repeat(64),
        rights_attestation: {
          rights_to_process: true,
          rights_to_private_publish: true,
        },
        human_review_attestation: {
          review_completed: true,
          child_private_data_review_completed: true,
          approved_for_student_library: true,
        },
        idempotency_key: 'parent-protected-content-adoption-0001',
      },
      reader: { inspect: async () => protectedReadback() },
      now: observedAt,
    });
    await pool.query(
      `UPDATE onetime.content_item_entitlements
          SET audience = 'household', household_key = $2, learner_key = NULL
        WHERE content_item_key = $1`,
      [adopted.item_key, first.householdId],
    );

    await expect(
      createPostgresParentLearningRepository(pool, {
        accountKey: config.accountKey,
      }).loadOwnedParticipant({
        role: 'parent',
        adult_id: first.adultId,
        human_account_id: first.humanAccountId,
        household_id: first.householdId,
        session_id: first.sessionId,
      }),
    ).resolves.toMatchObject({ participant_id: first.participantId });

    const overview = await loadOverview(first.cookie);
    const item = overview.snapshot.library_items.find(
      (candidate: Record<string, unknown>) => candidate.content_id === adopted.item_key,
    ) as Record<string, unknown> | undefined;
    expect(item).toMatchObject({
      content_id: adopted.item_key,
      item_type: 'video',
      progress: null,
    });
    const contentVersionId = String(item?.content_version_id ?? '');
    expect(contentVersionId).toMatch(/^existing_vimeo_revision_/u);

    const openResponse = await fetch(
      `${baseUrl}/api/v1/portals/parent/learning/content/${encodeURIComponent(adopted.item_key)}/open`,
      { headers: { cookie: first.cookie } },
    );
    expect(openResponse.status).toBe(200);
    const opened = (await openResponse.json()) as {
      data: { action: { href: string; method: string; kind: string } };
    };
    expect(opened.data.action).toEqual(
      expect.objectContaining({
        href: `/app/learning/items/${adopted.item_key}`,
        method: 'GET',
        kind: 'content_open',
      }),
    );

    const playerResponse = await fetch(`${baseUrl}${opened.data.action.href}`, {
      headers: { cookie: first.cookie },
      redirect: 'manual',
    });
    const playerHtml = await playerResponse.text();
    expect(playerResponse.status, playerHtml).toBe(200);
    expect(playerHtml).toContain('data-parent-content-progress="enabled"');
    expect(playerHtml).toContain(`data-content-id="${adopted.item_key}"`);
    expect(playerHtml).toContain(`data-content-version-id="${contentVersionId}"`);
    expect(playerHtml).toContain(`data-content-duration-ms="${durationMs}"`);
    expect(playerHtml).toContain('/assets/app-protected-content-player.js');
    expect(playerHtml).toContain('<meta name="referrer" content="origin">');
    expect(playerHtml).toContain('referrerpolicy="origin"');
    expect(playerHtml).not.toMatch(/1234567890|https?:\/\/player\.vimeo\.com\/video/iu);
    expect(playerResponse.headers.get('referrer-policy')).toBe('origin');
    expect(playerResponse.headers.get('content-security-policy')).toContain("script-src 'self'");
    expect(playerResponse.headers.get('content-security-policy')).toContain(
      "frame-src 'self' https://player.vimeo.com",
    );

    const command = {
      content_id: adopted.item_key,
      content_version_id: contentVersionId,
      position_ms: 15_000,
      duration_ms: durationMs,
      completed: false,
    };
    const forgedDuration = await recordProgress(
      first,
      overview.csrf_token,
      'parent-progress-forged-duration-0001',
      {
        ...command,
        position_ms: 1,
        duration_ms: 1,
        completed: true,
      },
    );
    expect(
      forgedDuration.response.status,
      `${JSON.stringify(forgedDuration.body)}\n${lastPgMemQueryFailure}`,
    ).toBe(400);
    const forgedCompletion = await recordProgress(
      first,
      overview.csrf_token,
      'parent-progress-forged-completion-0001',
      { ...command, position_ms: 1, completed: true },
    );
    expect(
      forgedCompletion.response.status,
      `${JSON.stringify(forgedCompletion.body)}\n${lastPgMemQueryFailure}`,
    ).toBe(400);
    const beforeValidProgress = await pool.query(
      `SELECT count(*)::int AS count
         FROM onetime.parent_learning_content_progress_events
        WHERE participant_id = $1`,
      [first.participantId],
    );
    expect(Number(beforeValidProgress.rows[0]?.count)).toBe(0);
    const committed = await recordProgress(
      first,
      overview.csrf_token,
      'parent-progress-browser-0001',
      command,
    );
    expect(committed.response.status, lastPgMemQueryFailure).toBe(200);
    expect(committed.body).toMatchObject({
      success: true,
      data: { receipt: { disposition: 'committed', operation: 'content_progress_recorded' } },
    });
    const replayed = await recordProgress(
      first,
      overview.csrf_token,
      'parent-progress-browser-0001',
      command,
    );
    expect(replayed.body).toMatchObject({
      success: true,
      data: { receipt: { disposition: 'replayed', operation: 'content_progress_recorded' } },
    });
    const progressReadback = await pool.query(
      `SELECT content_id, content_version_id, position_ms, duration_ms, completed
         FROM onetime.parent_learning_content_progress_events
        WHERE participant_id = $1`,
      [first.participantId],
    );
    expect(progressReadback.rows).toEqual([
      expect.objectContaining({
        content_id: adopted.item_key,
        content_version_id: contentVersionId,
        position_ms: 15_000,
        duration_ms: durationMs,
        completed: false,
      }),
    ]);

    await seedContentFactoryPlaybackProjection(adopted.item_key);
    const factoryPlayerResponse = await fetch(`${baseUrl}${opened.data.action.href}`, {
      headers: { cookie: first.cookie },
      redirect: 'manual',
    });
    const factoryPlayerHtml = await factoryPlayerResponse.text();
    expect(factoryPlayerResponse.status, factoryPlayerHtml).toBe(200);
    expect(factoryPlayerHtml).toContain('data-parent-content-progress="enabled"');
    expect(factoryPlayerHtml).toContain(`/api/v1/content/factory/${adopted.item_key}/embed`);
    expect(factoryPlayerHtml).toContain(`data-content-version-id="${contentVersionId}"`);
    expect(factoryPlayerHtml).toContain(`data-content-duration-ms="${factoryDurationMs}"`);
    expect(factoryPlayerHtml).toContain('/assets/app-protected-content-player.js');
    expect(factoryPlayerHtml).toContain('<meta name="referrer" content="origin">');
    expect(factoryPlayerHtml).toContain('referrerpolicy="origin"');
    expect(factoryPlayerHtml).not.toMatch(/1234567890|https?:\/\/player\.vimeo\.com\/video/iu);
    expect(factoryPlayerResponse.headers.get('referrer-policy')).toBe('origin');
    expect(factoryPlayerResponse.headers.get('content-security-policy')).toContain(
      "script-src 'self'",
    );
    const factoryEmbed = await fetch(
      `${baseUrl}/api/v1/content/factory/${adopted.item_key}/embed`,
      { headers: { cookie: first.cookie }, redirect: 'manual' },
    );
    expect(factoryEmbed.status).toBe(302);
    expect(factoryEmbed.headers.get('referrer-policy')).toBe('origin');

    const health = await fetch(`${baseUrl}/health`);
    expect(health.headers.get('referrer-policy')).toBe('no-referrer');

    const second = await signupFamily('second-parent-playback@example.test', 'Second', 'Parent');
    await expect(
      getContentFactoryPlayback({
        pool,
        config,
        sourceKey: adopted.item_key,
        actor: {
          actor_role: 'parent',
          actor_user_ref: second.humanAccountId,
          student_learner: null,
          authorized_households: [
            {
              household_key: first.householdId,
              relationship_key: 'legacy-parent-same-household',
              relationship_label: 'Parent',
              authority: 'primary_guardian',
            },
          ],
        },
      }),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });

    await pool.query(
      `UPDATE onetime.canonical_aggregate_states
          SET current_state = 'inactive'
        WHERE aggregate_kind = 'access' AND aggregate_key = $1`,
      [first.householdId],
    );
    await expect(
      getContentFactoryPlayback({
        pool,
        config,
        sourceKey: adopted.item_key,
        actor: {
          actor_role: 'parent',
          actor_user_ref: first.humanAccountId,
          student_learner: null,
          authorized_households: [
            {
              household_key: first.householdId,
              relationship_key: 'first-parent-same-household',
              relationship_label: 'Parent',
              authority: 'primary_guardian',
            },
          ],
        },
      }),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });
    await pool.query(
      `UPDATE onetime.canonical_aggregate_states
          SET current_state = 'active'
        WHERE aggregate_kind = 'access' AND aggregate_key = $1`,
      [first.householdId],
    );

    const staleExistingDuration = await recordProgress(
      first,
      overview.csrf_token,
      'parent-progress-stale-existing-duration-0001',
      { ...command, position_ms: 30_000 },
    );
    expect(staleExistingDuration.response.status).toBe(400);
    const factoryCompleted = await recordProgress(
      first,
      overview.csrf_token,
      'parent-progress-factory-completed-0001',
      {
        ...command,
        position_ms: factoryDurationMs,
        duration_ms: factoryDurationMs,
        completed: true,
      },
    );
    expect(
      factoryCompleted.response.status,
      `${JSON.stringify(factoryCompleted.body)}\n${lastPgMemQueryFailure}`,
    ).toBe(200);
    const completionReadback = await pool.query(
      `SELECT position_ms, duration_ms, completed
         FROM onetime.parent_learning_content_progress_events
        WHERE participant_id = $1 AND idempotency_key = $2`,
      [first.participantId, 'parent-progress-factory-completed-0001'],
    );
    expect(completionReadback.rows[0]).toMatchObject({
      position_ms: factoryDurationMs,
      duration_ms: factoryDurationMs,
      completed: true,
    });

    const crossHousehold = await fetch(`${baseUrl}${opened.data.action.href}`, {
      headers: { cookie: second.cookie },
      redirect: 'manual',
    });
    expect(crossHousehold.status).toBe(404);
    expect(await crossHousehold.text()).not.toContain(adopted.item_key);

    await pool.query(
      `UPDATE onetime.parent_learning_class_entitlements
          SET entitlement_state = 'revoked', revoked_at = $2
        WHERE participant_id = $1`,
      [first.participantId, observedAt],
    );
    const revoked = await fetch(`${baseUrl}${opened.data.action.href}`, {
      headers: { cookie: first.cookie },
      redirect: 'manual',
    });
    expect(revoked.status).toBe(404);
    const revokedProgress = await recordProgress(
      first,
      overview.csrf_token,
      'parent-progress-browser-0002',
      { ...command, position_ms: 30_000 },
    );
    expect(revokedProgress.response.status).toBe(404);

    await pool.query(
      `UPDATE onetime.content_item_entitlements
          SET audience = 'all_active_learners', household_key = NULL
        WHERE content_item_key = $1`,
      [adopted.item_key],
    );
    await pool.query(
      `DELETE FROM onetime.parent_learning_class_entitlements WHERE participant_id = $1`,
      [second.participantId],
    );
    await pool.query(`DELETE FROM onetime.parent_learning_participants WHERE participant_id = $1`, [
      second.participantId,
    ]);
    const missingParticipant = await fetch(`${baseUrl}${opened.data.action.href}`, {
      headers: { cookie: second.cookie },
      redirect: 'manual',
    });
    expect(missingParticipant.status).toBe(404);
  });
});

async function signupFamily(email: string, firstName: string, lastName: string) {
  const bootstrapResponse = await fetch(`${baseUrl}/api/v1/signup/family/bootstrap`);
  expect(bootstrapResponse.status).toBe(200);
  const bootstrap = (await bootstrapResponse.json()) as {
    idempotency_key: string;
    csrf_token: string;
    writes_allowed: boolean;
  };
  const csrfCookie = bootstrapResponse.headers
    .getSetCookie()
    .find((value) => value.startsWith('ot_family_signup_csrf='))
    ?.split(';')[0];
  if (!csrfCookie) throw new Error('missing Family signup CSRF cookie');
  const response = await fetch(`${baseUrl}/api/v1/signup/family`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      cookie: csrfCookie,
      origin: config.publicBaseUrl,
      'x-csrf-token': bootstrap.csrf_token,
    },
    body: JSON.stringify({
      classification: 'family',
      idempotency_key: bootstrap.idempotency_key,
      first_name: firstName,
      last_name: lastName,
      email,
      password: 'correct horse battery staple',
      password_confirmation: 'correct horse battery staple',
      timezone: 'Asia/Jerusalem',
      terms_accepted: true,
      privacy_accepted: true,
      general_marketing_consent: true,
      parent_newsletter_consent: true,
    }),
  });
  expect(response.status, await response.clone().text()).toBe(201);
  const cookie = response.headers
    .getSetCookie()
    .find((value) => value.startsWith('__Host-onetime-session='))
    ?.split(';')[0];
  if (!cookie) throw new Error('missing Parent session cookie');
  const projection = await pool.query(
    `SELECT adult.adult_id, account.human_account_id, household.household_id,
            participant.participant_id, session.session_id
       FROM onetime.v21_adult_identities AS adult
       JOIN onetime.v21_human_accounts AS account ON account.adult_id = adult.adult_id
       JOIN onetime.v21_households AS household
         ON household.owner_adult_id = adult.adult_id
        AND household.owner_human_account_id = account.human_account_id
       JOIN onetime.parent_learning_participants AS participant
         ON participant.household_id = household.household_id
        AND participant.human_account_id = account.human_account_id
       JOIN onetime.v21_adult_sessions AS session
         ON session.human_account_id = account.human_account_id
        AND session.active_household_id = household.household_id
      WHERE adult.normalized_email = $1`,
    [email],
  );
  const row = projection.rows[0] as Record<string, unknown> | undefined;
  if (!row) throw new Error('missing Parent learning signup projection');
  return {
    cookie,
    adultId: String(row.adult_id),
    humanAccountId: String(row.human_account_id),
    householdId: String(row.household_id),
    participantId: String(row.participant_id),
    sessionId: String(row.session_id),
  };
}

async function loadOverview(cookie: string) {
  const response = await fetch(`${baseUrl}/api/v1/portals/parent/learning`, {
    headers: { cookie },
  });
  const body = (await response.json()) as {
    success: boolean;
    data: {
      csrf_token: string;
      snapshot: {
        library_items: Array<Record<string, unknown>>;
        activity: Record<string, unknown>;
      };
    };
  };
  expect(response.status, JSON.stringify(body)).toBe(200);
  return body.data;
}

async function recordProgress(
  parent: { cookie: string },
  csrfToken: string,
  idempotencyKey: string,
  command: Record<string, unknown>,
) {
  const response = await fetch(`${baseUrl}/api/v1/portals/parent/learning/content-progress`, {
    method: 'POST',
    headers: {
      cookie: parent.cookie,
      'content-type': 'application/json',
      'x-csrf-token': csrfToken,
      'x-idempotency-key': idempotencyKey,
    },
    body: JSON.stringify(command),
  });
  return { response, body: (await response.json()) as Record<string, unknown> };
}

function protectedReadback() {
  return {
    providerVideoId: '1234567890',
    ownerAccountVerified: true,
    ownerAccountIdDigest: 'd'.repeat(64),
    accountTier: 'starter',
    title: 'Parent protected lesson',
    durationMs,
    available: true,
    transcodeComplete: true,
    playable: true,
    coldPrivacyRestricted: false,
    coldStorage: false,
    copyrightRestricted: false,
    privacyView: 'disable',
    privacyOriginalView: null,
    privacyEmbed: 'whitelist',
    downloadsAllowed: false,
    commentsAllowed: false,
    collectionAddsAllowed: false,
    allowedEmbedDomains: ['app.onetimeonetime.com', 'join.onetimeonetime.com'],
    captionsActive: false,
    textTrackMetadataCountState: 'matches_collection' as const,
  };
}

async function seedContentFactoryPlaybackProjection(contentId: string) {
  const occurrenceKey = 'parent-protected-content-occurrence';
  await pool.query(
    `UPDATE onetime.parent_learning_class_entitlements
        SET effective_at = '2026-01-01T00:00:00.000Z'
      WHERE entitlement_state = 'active'`,
  );
  await pool.query(
    `INSERT INTO onetime.class_occurrences
       (occurrence_key, account_key, product_key, class_series_key, local_class_date,
        starts_at, reminder_due_at, joinable_until, occurrence_state, scheduled_ends_at,
        join_opens_at, join_closes_at)
     VALUES ($1,$2,$3,'parent_protected_content_class','2026-08-16',
       '2026-08-16T12:00:00.000Z','2026-08-16T11:30:00.000Z',
       '2026-08-16T14:00:00.000Z','completed','2026-08-16T13:00:00.000Z',
       '2026-08-16T11:50:00.000Z','2026-08-16T14:00:00.000Z')`,
    [occurrenceKey, config.accountKey, config.productKey],
  );
  await pool.query(
    `INSERT INTO onetime.learning_delivery_content_factory_items
       (source_key, account_key, product_key, source_kind, source_ref_digest, source_sha256,
        display_name, mime_type, byte_length, factory_state, original_duration_ms,
        prepared_duration_ms, trim_start_ms, trim_end_ms, trim_confidence,
        normalized_transcript, transcript_sha256, webvtt, webvtt_sha256,
        transcription_model, transcription_language, transcript_review_state, draft_json,
        provider_video_id, provider_embed_url, provider_text_track_id, vimeo_privacy,
        captions_active, approved_by_user_key, approved_at, published_by_user_key,
        published_at, occurrence_key, processing_mode)
     VALUES ($1,$2,$3,'local_drop',$4,$5,'parent-protected-content.mp4','video/mp4',1024,
       'published',$6,$6,0,$6,1,'Approved protected Parent transcript.',$7,
       'WEBVTT',$8,'fixture-transcriber','en','approved',$9::jsonb,
       '1234567890',NULL,'protected-parent-track','private',true,
       'parent-protected-content-test',$10,'parent-protected-content-test',$10,$11,'vimeo')`,
    [
      contentId,
      config.accountKey,
      config.productKey,
      '1'.repeat(64),
      '2'.repeat(64),
      factoryDurationMs,
      '3'.repeat(64),
      '4'.repeat(64),
      JSON.stringify({
        title: 'Parent protected lesson',
        short_description: 'The protected Parent playback branch.',
        class_label: 'One Time Mishnayos',
        class_date: '2026-08-16',
        topics: ['Mishnah'],
        mishnah_terms: ['Mishnah'],
        review_questions: [
          'What was the first point?',
          'What was the second point?',
          'What was the third point?',
          'What was the fourth point?',
          'What was the fifth point?',
        ],
        key_takeaways: [
          'Remember the first point.',
          'Remember the second point.',
          'Remember the third point.',
        ],
        vocabulary: [],
        draft_only: true,
        authoritative_torah_interpretation: false,
      }),
      observedAt,
      occurrenceKey,
    ],
  );
}

function pgMemCompatiblePool(memoryPool: DbPool): DbPool {
  const observedProgressIdempotencyKeys = new Set<string>();
  const wrapQuery = <T extends DbPool['query']>(query: T, receiver: object): T => {
    const invoke = query.bind(receiver) as unknown as (...args: unknown[]) => unknown;
    return ((...args: unknown[]) => {
      const [statement, ...rest] = args;
      const rewritten =
        typeof statement === 'string'
          ? rewritePgMemLockClause(statement)
          : statement &&
              typeof statement === 'object' &&
              'text' in statement &&
              typeof statement.text === 'string'
            ? { ...statement, text: rewritePgMemLockClause(statement.text) }
            : statement;
      const rewrittenText =
        typeof rewritten === 'string'
          ? rewritten
          : rewritten && typeof rewritten === 'object' && 'text' in rewritten
            ? String(rewritten.text)
            : '';
      if (rewrittenText.includes('INSERT INTO onetime.parent_learning_content_progress_events')) {
        const parameters = Array.isArray(rest[0]) ? rest[0] : [];
        const conflictKey = `${String(parameters[1])}\u0000${String(parameters[11])}`;
        if (observedProgressIdempotencyKeys.has(conflictKey)) {
          return Promise.resolve({ rows: [], rowCount: 0 });
        }
        observedProgressIdempotencyKeys.add(conflictKey);
      }
      try {
        const output = invoke(rewritten, ...rest);
        if (output && typeof (output as PromiseLike<unknown>).then === 'function') {
          return Promise.resolve(output).catch((error: unknown) => {
            lastPgMemQueryFailure = `${error instanceof Error ? error.stack : String(error)}\n${rewrittenText}`;
            throw error;
          });
        }
        return output;
      } catch (error) {
        lastPgMemQueryFailure = `${error instanceof Error ? error.stack : String(error)}\n${rewrittenText}`;
        throw error;
      }
    }) as T;
  };
  return {
    query: wrapQuery(memoryPool.query, memoryPool),
    connect: (async () => {
      const client = await memoryPool.connect();
      return new Proxy(client, {
        get(target, property, receiver) {
          if (property === 'query') return wrapQuery(target.query, target);
          const value = Reflect.get(target, property, receiver) as unknown;
          return typeof value === 'function' ? value.bind(target) : value;
        },
      });
    }) as DbPool['connect'],
    end: memoryPool.end.bind(memoryPool) as DbPool['end'],
  };
}

function rewritePgMemLockClause(statement: string) {
  if (statement.includes('AS governed_content_id')) {
    return `SELECT item.content_item_key AS governed_content_id,
                   item.published_revision_key AS governed_content_version_id,
                   COALESCE(
                     CASE WHEN factory.prepared_duration_ms BETWEEN 1 AND 9007199254740991
                       THEN factory.prepared_duration_ms::bigint ELSE NULL END,
                     CASE WHEN source.duration_ms BETWEEN 1 AND 9007199254740991
                       THEN source.duration_ms::bigint ELSE NULL END
                   ) AS governed_duration_ms
              FROM onetime.parent_learning_participants AS participant
              JOIN onetime.v21_households AS household
                ON household.household_id = participant.household_id
               AND household.owner_adult_id = participant.adult_id
               AND household.owner_human_account_id = participant.human_account_id
               AND household.product_key = participant.product_key
               AND household.runtime_tier = participant.runtime_tier
               AND household.verification_environment_id = participant.verification_environment_id
               AND household.classification = 'family'
               AND household.state = 'active'
               AND household.archived_at IS NULL
              JOIN onetime.canonical_aggregate_states AS access
                ON access.aggregate_kind = 'access'
               AND access.aggregate_key = participant.household_id
               AND access.product_key = participant.product_key
               AND access.runtime_tier = participant.runtime_tier
               AND access.verification_environment_id = participant.verification_environment_id
               AND access.current_state IN ('free', 'active', 'grace')
               AND access.archived_at IS NULL
              JOIN onetime.parent_learning_class_entitlements AS entitlement
                ON entitlement.participant_id = participant.participant_id
               AND entitlement.household_id = participant.household_id
               AND entitlement.product_key = participant.product_key
               AND entitlement.runtime_tier = participant.runtime_tier
               AND entitlement.verification_environment_id = participant.verification_environment_id
               AND entitlement.account_key = $1
               AND entitlement.entitlement_state = 'active'
               AND entitlement.effective_at <= $7::timestamptz
               AND entitlement.revoked_at IS NULL
              JOIN onetime.class_series AS series
                ON series.account_key = entitlement.account_key
               AND series.product_key = entitlement.product_key
               AND series.class_series_key = entitlement.class_series_key
               AND series.is_canonical = true
               AND series.status = 'active'
               AND series.series_state = 'active'
              JOIN onetime.v21_adult_sessions AS session
                ON session.session_id = $6
               AND session.human_account_id = participant.human_account_id
               AND session.active_role = 'parent'
               AND session.active_household_id = participant.household_id
               AND session.product_key = participant.product_key
               AND session.runtime_tier = participant.runtime_tier
               AND session.verification_environment_id = participant.verification_environment_id
               AND session.revoked_at IS NULL
               AND session.idle_expires_at > $7::timestamptz
               AND session.absolute_expires_at > $7::timestamptz
              JOIN onetime.content_items AS item
                ON item.account_key = entitlement.account_key
               AND item.product_key = entitlement.product_key
               AND item.content_item_key = $8
               AND item.published_revision_key = $9
               AND item.lifecycle_state = 'published'
               AND item.retention_state = 'active'
               AND item.item_type = 'video'
               AND item.published_at IS NOT NULL
              JOIN onetime.content_revisions AS revision
                ON revision.account_key = item.account_key
               AND revision.product_key = item.product_key
               AND revision.content_item_key = item.content_item_key
               AND revision.revision_key = item.published_revision_key
               AND revision.lifecycle_state = 'published'
              LEFT JOIN onetime.learning_delivery_content_factory_items AS factory
                ON factory.account_key = item.account_key
               AND factory.product_key = item.product_key
               AND factory.source_key = item.content_item_key
               AND factory.factory_state = 'published'
               AND factory.processing_mode = 'vimeo'
               AND factory.provider_video_id IS NOT NULL
               AND factory.captions_active = true
              LEFT JOIN onetime.ot104r_vimeo_sources AS source
                ON source.source_key = item.content_item_key
               AND source.processing_state IN ('available', 'transcript_ready')
               AND source.privacy_state = 'private'
              JOIN onetime.content_item_entitlements AS content_entitlement
                ON content_entitlement.account_key = item.account_key
               AND content_entitlement.product_key = item.product_key
               AND content_entitlement.content_item_key = item.content_item_key
               AND content_entitlement.entitlement_state = 'active'
               AND content_entitlement.revoked_at IS NULL
               AND (
                 content_entitlement.audience = 'all_active_learners'
                 OR (
                   content_entitlement.audience = 'household'
                   AND content_entitlement.household_key = participant.household_id
                 )
               )
              LEFT JOIN onetime.class_occurrences AS occurrence
                ON occurrence.account_key = item.account_key
               AND occurrence.product_key = item.product_key
               AND occurrence.occurrence_key = item.occurrence_key
               AND occurrence.class_series_key = entitlement.class_series_key
             WHERE participant.participant_id = $2
               AND participant.adult_id = $3
               AND participant.human_account_id = $4
               AND participant.household_id = $5
               AND participant.participant_kind = 'parent'
               AND participant.learner_ordinal = 1
               AND participant.state = 'active'
               AND participant.archived_at IS NULL
               AND (item.occurrence_key IS NULL OR occurrence.occurrence_key IS NOT NULL)
               AND COALESCE(factory.prepared_duration_ms, source.duration_ms)
                   BETWEEN 1 AND 9007199254740991
             LIMIT 2`;
  }
  if (statement.includes('INSERT INTO onetime.parent_learning_content_progress_events')) {
    // pg-mem cannot execute the production governed-target CTE. This HTTP fixture has already
    // exercised the service target/policy checks; the native PostgreSQL suite executes the exact
    // atomic production statement and its authorization rechecks without this test-only rewrite.
    return `INSERT INTO onetime.parent_learning_content_progress_events
       (progress_event_id, participant_id, household_id, actor_kind,
        account_key, product_key, runtime_tier, verification_environment_id,
        class_series_key, content_id, content_version_id, position_ms,
        duration_ms, completed, completed_at, idempotency_key, request_hash,
        observed_at)
     VALUES ($1,$2,$5,'parent',$7,'one_time_mishnayos','isolated_staging','ci',
             'parent_protected_content_class',$8,$9,$10::bigint,$11::bigint,
             ($10::bigint = $11::bigint),
             CASE WHEN $10::bigint = $11::bigint THEN $14::timestamptz ELSE NULL END,
             $12,$13,$14::timestamptz)
     ON CONFLICT (participant_id, idempotency_key) DO NOTHING
     RETURNING progress_event_id AS entity_id`;
  }
  if (statement.includes('SELECT item.content_item_key AS content_id')) {
    return `SELECT item.content_item_key AS content_id,
                   item.published_revision_key AS content_version_id,
                   item.title,
                   item.item_type,
                   item.published_at,
                   NULL::bigint AS position_ms,
                   NULL::bigint AS duration_ms,
                   NULL::boolean AS completed,
                   NULL::timestamptz AS progress_updated_at
              FROM onetime.parent_learning_participants AS participant
              JOIN onetime.canonical_aggregate_states AS access
                ON access.aggregate_kind = 'access'
               AND access.aggregate_key = participant.household_id
               AND access.product_key = participant.product_key
               AND access.runtime_tier = participant.runtime_tier
               AND access.verification_environment_id = participant.verification_environment_id
               AND access.current_state IN ('free', 'active', 'grace')
               AND access.archived_at IS NULL
              JOIN onetime.parent_learning_class_entitlements AS parent_entitlement
                ON parent_entitlement.participant_id = participant.participant_id
               AND parent_entitlement.household_id = participant.household_id
               AND parent_entitlement.product_key = participant.product_key
               AND parent_entitlement.runtime_tier = participant.runtime_tier
               AND parent_entitlement.verification_environment_id = participant.verification_environment_id
               AND parent_entitlement.account_key = $1
               AND parent_entitlement.entitlement_state = 'active'
              JOIN onetime.v21_adult_sessions AS session
                ON session.session_id = $6
               AND session.human_account_id = participant.human_account_id
               AND session.active_role = 'parent'
               AND session.active_household_id = participant.household_id
               AND session.product_key = participant.product_key
               AND session.runtime_tier = participant.runtime_tier
               AND session.verification_environment_id = participant.verification_environment_id
               AND session.revoked_at IS NULL
               AND session.idle_expires_at > $7::timestamptz
               AND session.absolute_expires_at > $7::timestamptz
              JOIN onetime.content_items AS item
                ON item.account_key = parent_entitlement.account_key
               AND item.product_key = parent_entitlement.product_key
               AND item.lifecycle_state = 'published'
               AND item.retention_state = 'active'
               AND item.item_type = 'video'
               AND item.published_revision_key IS NOT NULL
               AND item.published_at IS NOT NULL
              JOIN onetime.content_item_entitlements AS content_entitlement
                ON content_entitlement.account_key = item.account_key
               AND content_entitlement.product_key = item.product_key
               AND content_entitlement.content_item_key = item.content_item_key
               AND content_entitlement.entitlement_state = 'active'
               AND (
                 content_entitlement.audience = 'all_active_learners'
                 OR (
                   content_entitlement.audience = 'household'
                   AND content_entitlement.household_key = participant.household_id
                 )
               )
             WHERE participant.participant_id = $2
               AND participant.adult_id = $3
               AND participant.human_account_id = $4
               AND participant.household_id = $5
               AND participant.participant_kind = 'parent'
               AND participant.learner_ordinal = 1
               AND participant.state = 'active'
               AND ($8::text IS NULL OR item.content_item_key = $8)
             ORDER BY item.published_at DESC, item.content_item_key
             LIMIT 25`;
  }
  return statement
    .replace('FOR SHARE OF request, receipt', 'FOR SHARE')
    .replace('FOR UPDATE OF household', 'FOR UPDATE')
    .replace(
      /LEFT JOIN LATERAL \([\s\S]*?\n\s*\) AS next_occurrence ON true/u,
      'LEFT JOIN onetime.class_occurrences AS next_occurrence ON false',
    )
    .replace(
      /LEFT JOIN LATERAL \([\s\S]*?\n\s*\) AS progress ON true/u,
      'LEFT JOIN onetime.parent_learning_content_progress_events AS progress ON false',
    )
    .replace(
      /\(SELECT count\(DISTINCT attendance\.occurrence_id\)::int[\s\S]*?\) AS attended_occurrence_count/u,
      '0::int AS attended_occurrence_count',
    )
    .replace(
      /\(SELECT count\(DISTINCT progress\.content_id\)::int[\s\S]*?\) AS started_content_count/u,
      '0::int AS started_content_count',
    )
    .replace(
      /\(SELECT count\(DISTINCT progress\.content_id\)::int[\s\S]*?\) AS completed_content_count/u,
      '0::int AS completed_content_count',
    )
    .replace(
      /\(SELECT count\(\*\)::int[\s\S]*?\) AS submitted_question_count/u,
      '0::int AS submitted_question_count',
    );
}

async function listenForTest(app: ReturnType<typeof createApp>) {
  return new Promise<ReturnType<typeof app.listen>>((resolve, reject) => {
    const listening = app.listen(0, '127.0.0.1', (error?: Error) => {
      if (error) reject(error);
      else resolve(listening);
    });
  });
}

function serverBaseUrl(listening: ReturnType<ReturnType<typeof createApp>['listen']>) {
  const address = listening.address();
  if (!address || typeof address === 'string') throw new Error('missing test server address');
  return `http://127.0.0.1:${address.port}`;
}
