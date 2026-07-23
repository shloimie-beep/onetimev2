import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../../../apps/web/src/server/app.ts';
import { loadConfig, type AppConfig } from '../../../packages/config/src/index.ts';
import { createMemoryPool, runMigrations, type DbPool } from '../../../packages/db/src/index.ts';
import {
  acceptOwnerAdminInvitation,
  acceptParentActivation,
  acceptStudentSetup,
  authenticateUser,
  completePasswordReset,
  createSession,
  decryptAuthEmailChallengeDeliveryPayloadForTests,
  decryptLifecycleDeliveryPayloadForTests,
  getSessionByToken,
  requestPasswordReset,
  revokeSession,
  verifyEmailChallengeCode,
} from '../../../packages/domain/src/index.ts';
import {
  buildDefaultSyntheticIdentitySet,
  provisionOneTimeIdentitySet,
  serializeIdentityProvisioningReport,
  validateIdentityProvisioningSafety,
  type OneTimeIdentitySetManifest,
} from '../../../scripts/w12-100/identity/provision-first-identity-set.ts';

let pool: DbPool;
let config: AppConfig;
let distDir: string;
let manifest: OneTimeIdentitySetManifest;

const safety = {
  apply: true,
  provisioningEnabled: true,
  confirmIsolatedEnvironment: true,
};

const identityProvisionedAt = new Date('2026-07-17T12:00:00.000Z');
const identityReplayAt = new Date('2026-07-17T12:05:00.000Z');
const identityConflictAt = new Date('2026-07-17T12:10:00.000Z');
const lifecycleAcceptanceAt = new Date('2026-07-17T12:15:00.000Z');
const studentSetupProvisionedAt = new Date('2026-07-17T12:20:00.000Z');
const studentSetupAcceptedAt = new Date('2026-07-17T12:25:00.000Z');

beforeEach(async () => {
  config = loadConfig({
    NODE_ENV: 'test',
    PUBLIC_BASE_URL: 'https://join.onetimeonetime.com',
    APP_VERSION: 'test',
    COMMIT_SHA: 'test',
    OUTBOX_TRANSPORT_MODE: 'sink',
    ONE_TIME_ACCOUNT_KEY: 'one_time_w12_100',
    ONE_TIME_PRODUCT_KEY: 'one_time_mishnah_class_w12_100',
  });
  pool = createMemoryPool();
  await runMigrations(pool);
  distDir = await mkdtemp(path.join(tmpdir(), 'w12-100-portals-'));
  await writePortalShells(distDir);
  manifest = buildDefaultSyntheticIdentitySet('w12_100_identity_readiness');
});

afterEach(async () => {
  await pool.end();
  await rm(distDir, { recursive: true, force: true });
});

describe('W12-100 account and portal identity provisioning', () => {
  it('rejects production, missing gates, and production Portal Test Lab configuration', () => {
    const productionConfig = loadConfig({
      NODE_ENV: 'production',
      PUBLIC_BASE_URL: 'https://join.onetimeonetime.com',
      APP_VERSION: 'test',
      COMMIT_SHA: 'test',
      OUTBOX_TRANSPORT_MODE: 'sink',
      AUTH_CSRF_SECRET: 'production-csrf-secret-for-test-only-32',
      MFA_SECRET_ENCRYPTION_KEY: 'production-mfa-secret-for-test-only-32',
      ONE_TIME_LIFECYCLE_DELIVERY_KEY: 'production-delivery-key-for-test-only-32',
    });

    expect(() =>
      validateIdentityProvisioningSafety({
        config: productionConfig,
        environment: 'production',
        requestedAccountKey: productionConfig.accountKey,
        requestedProductKey: productionConfig.productKey,
        safety,
      }),
    ).toThrow('refuses production');

    expect(() =>
      validateIdentityProvisioningSafety({
        config,
        environment: 'test',
        requestedAccountKey: undefined,
        requestedProductKey: config.productKey,
        safety,
      }),
    ).toThrow('explicit account and product scope');

    expect(() =>
      validateIdentityProvisioningSafety({
        config,
        environment: 'test',
        requestedAccountKey: config.accountKey,
        requestedProductKey: config.productKey,
        safety: { ...safety, provisioningEnabled: false },
      }),
    ).toThrow('ONE_TIME_IDENTITY_PROVISIONING_ENABLED=true');

    expect(() =>
      loadConfig({
        NODE_ENV: 'production',
        PUBLIC_BASE_URL: 'https://join.onetimeonetime.com',
        APP_VERSION: 'test',
        COMMIT_SHA: 'test',
        OUTBOX_TRANSPORT_MODE: 'sink',
        AUTH_CSRF_SECRET: 'production-csrf-secret-for-test-only-32',
        MFA_SECRET_ENCRYPTION_KEY: 'production-mfa-secret-for-test-only-32',
        ONE_TIME_LIFECYCLE_DELIVERY_KEY: 'production-delivery-key-for-test-only-32',
        PORTAL_TEST_LAB_ENABLED: 'true',
      }),
    ).toThrow('Portal Test Lab requires explicit test or isolated_staging runtime classification.');
  });

  it('emits redacted idempotent outcomes and blocks student setup until parent activation', async () => {
    const first = await provisionOneTimeIdentitySet({
      pool,
      config,
      environment: 'test',
      requestedAccountKey: config.accountKey,
      requestedProductKey: config.productKey,
      manifest,
      safety,
      now: identityProvisionedAt,
    });

    const serialized = serializeIdentityProvisioningReport(first);
    expect(serialized).not.toContain('@example.test');
    expect(serialized).not.toMatch(/token_for_local_proof|activate#|reset-password#|password/i);
    expect(first.counts.external_actions).toBe(0);
    expect(first.counts.production_mutations).toBe(0);
    expect(first.counts.update_blocked).toBe(3);
    expect(first.outcomes.filter((entry) => entry.resource === 'student_setup')).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          status: 'update_blocked',
          reason_code: 'parent_activation_required',
        }),
      ]),
    );

    const replay = await provisionOneTimeIdentitySet({
      pool,
      config,
      environment: 'test',
      requestedAccountKey: config.accountKey,
      requestedProductKey: config.productKey,
      manifest,
      safety,
      now: identityReplayAt,
    });
    expect(replay.counts.already_exists).toBeGreaterThan(0);
    expect(replay.counts.update_blocked).toBe(3);

    const changedOwner = {
      ...manifest,
      owner: { ...manifest.owner, email: 'changed-owner@example.test' },
    };
    const conflict = await provisionOneTimeIdentitySet({
      pool,
      config,
      environment: 'test',
      requestedAccountKey: config.accountKey,
      requestedProductKey: config.productKey,
      manifest: changedOwner,
      safety,
      now: identityConflictAt,
    });
    expect(conflict.counts.conflict).toBeGreaterThan(0);

    const audits = await pool.query(
      `SELECT count(*)::int AS count
         FROM onetime.account_lifecycle_audit_events
        WHERE account_key = $1
          AND product_key = $2
          AND action_type = 'w12_100_identity_provisioning_run'`,
      [config.accountKey, config.productKey],
    );
    expect(Number(audits.rows[0]?.count ?? 0)).toBe(3);
  });

  it('completes synthetic owner, parent, and separate student portal journeys', async () => {
    await provisionOneTimeIdentitySet({
      pool,
      config,
      environment: 'test',
      requestedAccountKey: config.accountKey,
      requestedProductKey: config.productKey,
      manifest,
      safety,
      now: identityProvisionedAt,
    });

    await activateOwnerAdminAndExerciseAssurance();

    const parentToken = await lifecycleProof('parent_activation', manifest.parent.idempotency_key);
    const parent = await acceptParentActivation({
      pool,
      config,
      payload: { token: parentToken, password: 'W12ParentPass!234' },
      now: lifecycleAcceptanceAt,
    });
    expect(parent).toMatchObject({ role: 'parent', status: 'active' });

    const second = await provisionOneTimeIdentitySet({
      pool,
      config,
      environment: 'test',
      requestedAccountKey: config.accountKey,
      requestedProductKey: config.productKey,
      manifest,
      safety,
      now: studentSetupProvisionedAt,
    });
    const studentSetupOutcomes = second.outcomes.filter(
      (entry) => entry.resource === 'student_setup',
    );
    expect(studentSetupOutcomes).toHaveLength(3);
    expect(studentSetupOutcomes.every((entry) => entry.actor_role === 'parent')).toBe(true);
    expect(studentSetupOutcomes.every((entry) => entry.status === 'created')).toBe(true);

    for (const [index, learner] of manifest.learners.entries()) {
      const token = await lifecycleProof('student_setup', learner.idempotency_key);
      const student = await acceptStudentSetup({
        pool,
        config,
        payload: { token, password: `W12Student${index + 1}!234` },
        now: studentSetupAcceptedAt,
      });
      expect(student).toMatchObject({ role: 'student', status: 'active' });
    }

    await seedVisibilityFixtures();
    await exercisePortalJourneys();
  });
});

async function activateOwnerAdminAndExerciseAssurance() {
  const ownerToken = await lifecycleProof('owner_admin_invitation', manifest.owner.idempotency_key);
  const owner = await acceptOwnerAdminInvitation({
    pool,
    config,
    payload: { token: ownerToken, password: 'W12OwnerPass!234' },
    now: lifecycleAcceptanceAt,
  });
  expect(owner).toMatchObject({ role: 'owner', status: 'active' });

  const adminToken = await lifecycleProof('owner_admin_invitation', manifest.admin.idempotency_key);
  const admin = await acceptOwnerAdminInvitation({
    pool,
    config,
    payload: { token: adminToken, password: 'W12AdminPass!234' },
    now: lifecycleAcceptanceAt,
  });
  expect(admin).toMatchObject({ role: 'admin', status: 'active' });

  const passwordOnly = await authenticateUser({
    pool,
    config,
    email: manifest.admin.email,
    password: 'W12AdminPass!234',
    userAgent: 'w12-100-browser',
  });
  expect(passwordOnly).toMatchObject({ ok: false, code: 'EMAIL_CHALLENGE_REQUIRED' });
  if (passwordOnly.ok || !passwordOnly.challenge_token) {
    throw new Error('Expected admin email challenge.');
  }

  const challengePayload = await latestEmailChallengePayload();
  const verified = await verifyEmailChallengeCode({
    pool,
    config,
    challengeToken: passwordOnly.challenge_token,
    code: requiredPayloadString(challengePayload, 'code'),
    trustDevice: true,
    userAgent: 'w12-100-browser',
  });
  expect(verified).toMatchObject({ ok: true });
  if (!verified.ok || !verified.trustedDeviceToken) {
    throw new Error('Expected trusted device challenge verification.');
  }

  const trusted = await authenticateUser({
    pool,
    config,
    email: manifest.admin.email,
    password: 'W12AdminPass!234',
    trustedDeviceToken: verified.trustedDeviceToken,
    userAgent: 'w12-100-browser',
  });
  expect(trusted).toMatchObject({ ok: true, assuranceMethod: 'trusted_device' });

  await pool.query(
    `UPDATE onetime.auth_trusted_devices
        SET trusted_until = $1
      WHERE account_key = $2
        AND product_key = $3`,
    [new Date('2026-07-16T12:00:00.000Z'), config.accountKey, config.productKey],
  );
  const expiredTrusted = await authenticateUser({
    pool,
    config,
    email: manifest.admin.email,
    password: 'W12AdminPass!234',
    trustedDeviceToken: verified.trustedDeviceToken,
    userAgent: 'w12-100-browser',
  });
  expect(expiredTrusted).toMatchObject({ ok: false, code: 'EMAIL_CHALLENGE_REQUIRED' });

  const session = await createSession({
    pool,
    config,
    user: verified.user,
    assuranceMethod: 'email_challenge',
    userAgent: 'w12-100-browser',
  });
  expect(
    await getSessionByToken({
      pool,
      config,
      sessionToken: session.session_token,
      userAgent: 'w12-100-browser',
    }),
  ).not.toBeNull();
  await revokeSession({
    pool,
    config,
    sessionToken: session.session_token,
    reason: 'w12_100_logout',
    userAgent: 'w12-100-browser',
  });
  expect(
    await getSessionByToken({
      pool,
      config,
      sessionToken: session.session_token,
      userAgent: 'w12-100-browser',
    }),
  ).toBeNull();

  await requestPasswordReset({
    pool,
    config,
    payload: {
      idempotency_key: 'w12-100-admin-recovery',
      email: manifest.admin.email,
    },
    now: lifecycleAcceptanceAt,
  });
  const resetToken = await lifecycleProof('password_reset', 'w12-100-admin-recovery');
  const reset = await completePasswordReset({
    pool,
    config,
    payload: { token: resetToken, password: 'W12AdminPass!999' },
    now: lifecycleAcceptanceAt,
  });
  expect(reset).toMatchObject({ role: 'admin' });

  const oldPassword = await authenticateUser({
    pool,
    config,
    email: manifest.admin.email,
    password: 'W12AdminPass!234',
  });
  expect(oldPassword).toMatchObject({ ok: false, code: 'INVALID_CREDENTIALS' });
}

async function exercisePortalJourneys() {
  const server = await listenForTest(createApp({ config, pool, distDir }));
  try {
    const parent = await loginAs(server.baseUrl, manifest.parent.email, 'W12ParentPass!234');
    const parentDashboard = await fetch(`${server.baseUrl}/api/v1/portals/parent/dashboard`, {
      headers: { cookie: parent.cookies },
    });
    const parentJson = await parentDashboard.json();
    expect(parentDashboard.status).toBe(200);
    expect(parentJson.data.learners).toHaveLength(3);
    expect(parentJson.data.household.active_learner_count).toBe(3);
    expect(JSON.stringify(parentJson)).not.toMatch(/https?:\/\/|zoom|vimeo|drive|meet/i);

    const learner = firstLearner();
    const materials = await fetch(
      `${server.baseUrl}/api/v1/portals/parent/households/${manifest.household.household_key}/learners/${learner.learner_key}/materials`,
      { headers: { cookie: parent.cookies } },
    );
    const materialsJson = await materials.json();
    expect(materials.status).toBe(200);
    expect(materialsJson.data.library).toHaveLength(1);
    expect(materialsJson.data.review_sheets).toHaveLength(1);

    const parentSupport = await postJson(
      server.baseUrl,
      `/api/v1/portals/parent/households/${manifest.household.household_key}/support/preview`,
      parent,
      {
        idempotency_key: 'w12-100-parent-support',
        subject: 'Synthetic access question',
        body: 'Please review this synthetic account setup.',
      },
    );
    expect(parentSupport.response.status).toBe(200);
    expect(responseData(parentSupport).external_send_performed).toBe(false);

    for (const [index, current] of manifest.learners.entries()) {
      const student = await loginAs(server.baseUrl, current.email, `W12Student${index + 1}!234`);
      const dashboard = await fetch(`${server.baseUrl}/api/v1/portals/student/dashboard`, {
        headers: { cookie: student.cookies },
      });
      const dashboardJson = await dashboard.json();
      expect(dashboard.status).toBe(200);
      expect(dashboardJson.data.learner.learner_key).toBe(current.learner_key);
      expect(dashboardJson.data.upcoming_classes).toHaveLength(1);
      expect(dashboardJson.data.library_items).toHaveLength(2);
      for (const sibling of manifest.learners) {
        if (sibling.learner_key === current.learner_key) continue;
        expect(JSON.stringify(dashboardJson)).not.toContain(sibling.learner_key);
        expect(JSON.stringify(dashboardJson)).not.toContain(sibling.display_name);
      }

      const classLaunch = await postJson(
        server.baseUrl,
        '/api/v1/portals/student/classes/w12_100_class_occurrence/launch',
        student,
        { idempotency_key: `w12-100-class-${current.learner_key}` },
      );
      expect(classLaunch.response.status).toBe(200);
      expect(responseData(classLaunch).launch_token_ref).toBe('provider_unavailable');

      const contentOpen = await fetch(
        `${server.baseUrl}/api/v1/portals/student/content/w12_100_content_video/open`,
        { headers: { cookie: student.cookies } },
      );
      expect(contentOpen.status).toBe(200);
      expect(JSON.stringify(await contentOpen.json())).not.toMatch(
        /https?:\/\/|zoom|vimeo|drive|meet/i,
      );

      const studentSupport = await postJson(
        server.baseUrl,
        '/api/v1/portals/student/support/preview',
        student,
        {
          idempotency_key: `w12-100-student-support-${index}`,
          subject: 'Synthetic student help',
          body: 'This synthetic student needs help with the class page.',
        },
      );
      expect(studentSupport.response.status).toBe(200);
      expect(responseData(studentSupport).external_send_performed).toBe(false);
    }

    const first = firstLearner();
    const firstStudent = await loginAs(server.baseUrl, first.email, 'W12Student1!234');
    const revoke = await postJson(
      server.baseUrl,
      `/api/v1/portals/parent/households/${manifest.household.household_key}/learners/${first.learner_key}/student-access/revoke_sessions`,
      parent,
      { idempotency_key: 'w12-100-revoke-student-one' },
    );
    expect(revoke.response.status).toBe(200);
    const revokedDashboard = await fetch(`${server.baseUrl}/api/v1/portals/student/dashboard`, {
      headers: { cookie: firstStudent.cookies },
    });
    expect(revokedDashboard.status).toBe(401);

    const firstStudentAfterRevoke = await loginAs(server.baseUrl, first.email, 'W12Student1!234');
    const suspend = await postJson(
      server.baseUrl,
      `/api/v1/portals/parent/households/${manifest.household.household_key}/learners/${first.learner_key}/student-access/suspend`,
      parent,
      { idempotency_key: 'w12-100-suspend-student-one' },
    );
    expect(suspend.response.status).toBe(200);
    const suspendedDashboard = await fetch(`${server.baseUrl}/api/v1/portals/student/dashboard`, {
      headers: { cookie: firstStudentAfterRevoke.cookies },
    });
    expect(suspendedDashboard.status).toBe(401);
    const suspendedLogin = await authenticateUser({
      pool,
      config,
      email: first.email,
      password: 'W12Student1!234',
    });
    expect(suspendedLogin).toMatchObject({ ok: false, code: 'DISABLED' });
  } finally {
    await server.close();
  }
}

async function seedVisibilityFixtures() {
  await pool.query(
    `INSERT INTO onetime.account_access_projections
       (access_key, account_key, product_key, household_key, state, source_kind,
        effective_at, expires_at, opaque_source_reference, source_revision,
        source_updated_at, source_request_hash, policy_version, access_version,
        last_event_key)
     VALUES ('w12_100_identity_access',$1,$2,$3,'active','free_pilot',$4,$5,
        'w12_100_identity_free_pilot',1,$4,
        '1111111111111111111111111111111111111111111111111111111111111111',
        'w12-100-current-access-v1',1,'w12_100_identity_access_seed')
     ON CONFLICT (account_key, product_key, household_key)
     DO UPDATE SET state = 'active', source_kind = 'free_pilot',
       effective_at = EXCLUDED.effective_at, expires_at = EXCLUDED.expires_at,
       source_updated_at = EXCLUDED.source_updated_at,
       source_request_hash = EXCLUDED.source_request_hash,
       policy_version = EXCLUDED.policy_version, revocation_reason = NULL,
       access_version = onetime.account_access_projections.access_version + 1,
       last_event_key = EXCLUDED.last_event_key, updated_at = now()`,
    [
      config.accountKey,
      config.productKey,
      manifest.household.household_key,
      new Date('2026-07-17T12:00:00.000Z'),
      new Date('2027-01-17T12:00:00.000Z'),
    ],
  );
  await pool.query(
    `INSERT INTO onetime.class_series
       (class_series_key, account_key, product_key, title, timezone, local_start_time,
        reminder_local_time)
     VALUES ('w12_100_class_series',$1,$2,'W12-100 Synthetic Class','Asia/Jerusalem',
        '19:00','18:30')
     ON CONFLICT (account_key, product_key, class_series_key)
     DO UPDATE SET title = EXCLUDED.title`,
    [config.accountKey, config.productKey],
  );
  await pool.query(
    `INSERT INTO onetime.class_occurrences
       (occurrence_key, account_key, product_key, class_series_key, local_class_date,
        starts_at, reminder_due_at, joinable_until, occurrence_state, reminder_state,
        access_state, join_opens_at, join_closes_at, scheduled_ends_at)
     VALUES ('w12_100_class_occurrence',$1,$2,'w12_100_class_series','2026-07-20',
        $3,$4,$5,'scheduled','pending','provider_unavailable',$6,$5,$5)
     ON CONFLICT (account_key, product_key, class_series_key, local_class_date)
     DO UPDATE SET starts_at = EXCLUDED.starts_at,
                   reminder_due_at = EXCLUDED.reminder_due_at,
                   joinable_until = EXCLUDED.joinable_until`,
    [
      config.accountKey,
      config.productKey,
      new Date('2026-07-20T16:00:00.000Z'),
      new Date('2026-07-20T15:30:00.000Z'),
      new Date('2026-07-20T17:15:00.000Z'),
      new Date('2026-07-20T15:45:00.000Z'),
    ],
  );
  await pool.query(
    `INSERT INTO onetime.content_items
       (content_item_key, account_key, product_key, occurrence_key, title, item_type,
        lifecycle_state, latest_revision_number, latest_revision_key, published_revision_key,
        published_at)
     VALUES
       ('w12_100_content_video',$1,$2,'w12_100_class_occurrence','W12-100 Synthetic Video',
        'video','published',1,'w12_100_content_video_rev','w12_100_content_video_rev',$3),
       ('w12_100_content_review',$1,$2,'w12_100_class_occurrence','W12-100 Synthetic Review',
        'review','published',1,'w12_100_content_review_rev','w12_100_content_review_rev',$3)
     ON CONFLICT (account_key, product_key, content_item_key)
     DO UPDATE SET lifecycle_state = 'published',
                   published_revision_key = EXCLUDED.published_revision_key,
                   published_at = EXCLUDED.published_at`,
    [config.accountKey, config.productKey, new Date('2026-07-17T13:00:00.000Z')],
  );
  await pool.query(
    `INSERT INTO onetime.content_revisions
       (revision_key, account_key, product_key, content_item_key, outcome_event_key,
        revision_number, lifecycle_state, published_at)
     VALUES
       ('w12_100_content_video_rev',$1,$2,'w12_100_content_video','w12_100_video_outcome',
        1,'published',$3),
       ('w12_100_content_review_rev',$1,$2,'w12_100_content_review','w12_100_review_outcome',
        1,'published',$3)
     ON CONFLICT (revision_key)
     DO UPDATE SET lifecycle_state = 'published', published_at = EXCLUDED.published_at`,
    [config.accountKey, config.productKey, new Date('2026-07-17T13:00:00.000Z')],
  );
  await pool.query(
    `INSERT INTO onetime.content_item_entitlements
       (entitlement_key, account_key, product_key, content_item_key, audience, entitlement_state)
     VALUES
       ('w12_100_video_all',$1,$2,'w12_100_content_video','all_active_learners','active'),
       ('w12_100_review_all',$1,$2,'w12_100_content_review','all_active_learners','active')
     ON CONFLICT (account_key, product_key, entitlement_key)
     DO UPDATE SET entitlement_state = 'active', revoked_at = NULL`,
    [config.accountKey, config.productKey],
  );
  await pool.query(
    `INSERT INTO onetime.classroom_lesson_publications
       (lesson_key, account_key, product_key, class_series_key, occurrence_key, content_item_key,
        title, description, publication_state, featured, published_at,
        controlled_by_actor_ref, raw_private_url_present, transcript_state, resource_count,
        resources_json)
     VALUES ('w12_100_lesson_video',$1,$2,'w12_100_class_series','w12_100_class_occurrence',
             'w12_100_content_video','W12-100 Synthetic Video',
             'Deterministic approved W12-100 fixture projection.','published',false,$3,
             'w12_100_fixture',false,'available',0,'[]'::jsonb)
     ON CONFLICT (lesson_key)
     DO UPDATE SET publication_state = 'published',
                   published_at = EXCLUDED.published_at,
                   controlled_by_actor_ref = 'w12_100_fixture',
                   raw_private_url_present = false,
                   updated_at = now()`,
    [config.accountKey, config.productKey, new Date('2026-07-17T13:00:00.000Z')],
  );
}

async function lifecycleProof(purpose: string, idempotencyKey: string) {
  const result = await pool.query(
    `SELECT nonce, ciphertext, auth_tag
       FROM onetime.account_lifecycle_delivery_outbox
      WHERE account_key = $1
        AND product_key = $2
        AND purpose = $3
        AND idempotency_key = $4
      ORDER BY created_at DESC
      LIMIT 1`,
    [config.accountKey, config.productKey, purpose, idempotencyKey],
  );
  const row = result.rows[0] as Record<string, unknown> | undefined;
  if (!row) throw new Error(`Missing lifecycle delivery for ${purpose}.`);
  const payload = decryptLifecycleDeliveryPayloadForTests(config, {
    nonce: requiredRowString(row, 'nonce'),
    ciphertext: requiredRowString(row, 'ciphertext'),
    auth_tag: requiredRowString(row, 'auth_tag'),
  });
  return requiredPayloadString(payload, 'token');
}

async function latestEmailChallengePayload() {
  const result = await pool.query(
    `SELECT nonce, ciphertext, auth_tag
       FROM onetime.auth_email_challenge_delivery_outbox
      WHERE account_key = $1
        AND product_key = $2
        AND nonce IS NOT NULL
        AND ciphertext IS NOT NULL
        AND auth_tag IS NOT NULL
      ORDER BY created_at DESC
      LIMIT 1`,
    [config.accountKey, config.productKey],
  );
  const row = result.rows[0] as Record<string, unknown> | undefined;
  if (!row) throw new Error('Missing email challenge delivery.');
  return decryptAuthEmailChallengeDeliveryPayloadForTests(config, {
    nonce: requiredRowString(row, 'nonce'),
    ciphertext: requiredRowString(row, 'ciphertext'),
    auth_tag: requiredRowString(row, 'auth_tag'),
  });
}

async function writePortalShells(targetDir: string) {
  await mkdir(path.join(targetDir, 'app'), { recursive: true });
  await mkdir(path.join(targetDir, 'assets'), { recursive: true });
  await writeFile(path.join(targetDir, 'app', 'parent.html'), '<div id="portal-root"></div>');
  await writeFile(path.join(targetDir, 'app', 'student.html'), '<div id="portal-root"></div>');
  await writeFile(path.join(targetDir, 'app', 'crm.html'), '<div id="crm-root"></div>');
  await writeFile(path.join(targetDir, '404.html'), '<h1>Not found</h1>');
  await writeFile(path.join(targetDir, 'assets', 'app-crm.css'), '');
}

async function listenForTest(app: ReturnType<typeof createApp>) {
  const server = await new Promise<ReturnType<typeof app.listen>>((resolve, reject) => {
    const instance = app.listen(0, (error?: Error) => {
      if (error) reject(error);
      else resolve(instance);
    });
  });
  const address = server.address();
  if (typeof address !== 'object' || !address) throw new Error('missing test server address');
  return {
    baseUrl: `http://127.0.0.1:${address.port}`,
    close: () => new Promise<void>((resolve) => server.close(() => resolve())),
  };
}

async function loginAs(baseUrl: string, email: string, password: string) {
  const csrf = await getLoginCsrf(baseUrl);
  const response = await fetch(`${baseUrl}/api/v1/auth/login`, {
    method: 'POST',
    headers: {
      cookie: csrf.cookies,
      'content-type': 'application/json',
      'x-csrf-token': csrf.token,
    },
    body: JSON.stringify({ email, password, csrf_token: csrf.token }),
  });
  const text = await response.text();
  expect(response.status, text).toBe(200);
  return {
    cookies: mergeCookies(csrf.cookies, cookieHeader(response.headers)),
    json: JSON.parse(text) as { csrf_token: string },
  };
}

async function postJson(
  baseUrl: string,
  route: string,
  session: Awaited<ReturnType<typeof loginAs>>,
  body: Record<string, unknown>,
) {
  const response = await fetch(`${baseUrl}${route}`, {
    method: 'POST',
    headers: {
      cookie: session.cookies,
      'content-type': 'application/json',
      'x-csrf-token': session.json.csrf_token,
    },
    body: JSON.stringify(body),
  });
  const json = (await response.json()) as Record<string, { [key: string]: unknown }>;
  return { response, json };
}

function responseData(result: Awaited<ReturnType<typeof postJson>>) {
  const data = result.json.data;
  if (!data || typeof data !== 'object') {
    throw new Error('Expected API response data.');
  }
  return data;
}

function firstLearner() {
  const learner = manifest.learners[0];
  if (!learner) throw new Error('Expected first W12-100 learner.');
  return learner;
}

async function getLoginCsrf(baseUrl: string) {
  const page = await fetch(`${baseUrl}/login`);
  const html = await page.text();
  const token = html.match(/name="csrf_token" value="([^"]+)"/)?.[1];
  if (!token) throw new Error('missing csrf token');
  return { token, cookies: cookieHeader(page.headers) };
}

function cookieHeader(headers: Headers) {
  return headers
    .getSetCookie()
    .map((cookie) => cookie.split(';')[0])
    .join('; ');
}

function mergeCookies(...headers: string[]) {
  const cookies = new Map<string, string>();
  for (const header of headers) {
    for (const part of header.split(';')) {
      const [key, value] = part.trim().split('=');
      if (key && value) cookies.set(key, value);
    }
  }
  return [...cookies.entries()].map(([key, value]) => `${key}=${value}`).join('; ');
}

function requiredPayloadString(payload: Record<string, unknown>, key: string) {
  const value = payload[key];
  if (typeof value !== 'string' || value.length === 0) {
    throw new Error(`Missing payload ${key}.`);
  }
  return value;
}

function requiredRowString(row: Record<string, unknown>, key: string) {
  const value = row[key];
  if (typeof value !== 'string' || value.length === 0) {
    throw new Error(`Missing row ${key}.`);
  }
  return value;
}
