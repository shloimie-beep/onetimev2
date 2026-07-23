import { createHash } from 'node:crypto';
import { loadConfig } from '../../packages/config/src/index.ts';
import { createMemoryPool, runMigrations } from '../../packages/db/src/index.ts';
import { createApp } from '../../apps/web/src/server/app.ts';
import {
  createAccountUser,
  generateContentFactoryDraftFromTranscript,
  grantFreePilotAccess,
  ingestContentFactoryItem,
  performContentFactoryAction,
} from '../../packages/domain/src/index.ts';
import {
  W12_PORTAL_TEST_LAB,
  seedPortalTestLab,
} from '../../apps/web/src/server/features/portal-test-lab/router.ts';
import { W12_E2E_ADMIN_SESSION_TOKEN } from './w12-portal-test-lab-session.ts';

const config = loadConfig({
  ...process.env,
  NODE_ENV: 'test',
  PORT: process.env.PORT ?? '3100',
  OT89_SUPPORT_ENABLED: process.env.OT89_SUPPORT_ENABLED ?? 'true',
  OT89_SUPPORT_DELIVERY_MODE: process.env.OT89_SUPPORT_DELIVERY_MODE ?? 'mock',
  OT89_SUPPORT_BNA_BASE_URL:
    process.env.OT89_SUPPORT_BNA_BASE_URL ?? `http://127.0.0.1:${process.env.PORT ?? '3100'}`,
  OT89_MOCK_BNA_ENABLED: process.env.OT89_MOCK_BNA_ENABLED ?? 'true',
  OT89_SUPPORT_HMAC_KEY_ID: process.env.OT89_SUPPORT_HMAC_KEY_ID ?? 'ot89-onetime-e2e',
  OT89_SUPPORT_HMAC_SECRET:
    process.env.OT89_SUPPORT_HMAC_SECRET ?? 'ot89-e2e-producer-secret-do-not-use',
  OT89_BNA_TO_ONETIME_HMAC_KEY_ID: process.env.OT89_BNA_TO_ONETIME_HMAC_KEY_ID ?? 'ot89-bna-e2e',
  OT89_BNA_TO_ONETIME_HMAC_SECRET:
    process.env.OT89_BNA_TO_ONETIME_HMAC_SECRET ?? 'ot89-e2e-consumer-secret-do-not-use',
});
const pool = createMemoryPool();
await runMigrations(pool);
await createAccountUser({
  pool,
  config,
  email: process.env.OT_TEST_ADMIN_EMAIL ?? 'ot-admin@example.test',
  password: process.env.OT_TEST_ADMIN_PASSWORD ?? 'TestPassword!234',
  displayName: 'Test Admin',
  role: 'crm_agent',
  mfaCapable: true,
});
const ownerUserKey = await createAccountUser({
  pool,
  config,
  email: process.env.OT_TEST_OWNER_EMAIL ?? 'ot-owner@example.test',
  password: process.env.OT_TEST_OWNER_PASSWORD ?? 'OwnerPassword!234',
  displayName: 'Test Owner',
  role: 'owner',
  mfaCapable: false,
});
const parentUserKey = await createAccountUser({
  pool,
  config,
  email: process.env.OT_TEST_PARENT_EMAIL ?? 'ot-parent@example.test',
  password: process.env.OT_TEST_PARENT_PASSWORD ?? 'ParentPassword!234',
  displayName: 'Test Parent',
  role: 'parent',
  mfaCapable: false,
});
const studentUserKey = await createAccountUser({
  pool,
  config,
  email: process.env.OT_TEST_STUDENT_EMAIL ?? 'ot-student@example.test',
  password: process.env.OT_TEST_STUDENT_PASSWORD ?? 'StudentPassword!234',
  displayName: 'Test Student',
  role: 'student',
  mfaCapable: false,
});
const zoomStudentUserKey = await createAccountUser({
  pool,
  config,
  email: process.env.OT_TEST_ZOOM_STUDENT_EMAIL ?? 'ot-zoom-student@example.test',
  password: process.env.OT_TEST_ZOOM_STUDENT_PASSWORD ?? 'ZoomStudentPassword!234',
  displayName: 'Zoom Test Student',
  role: 'student',
  mfaCapable: false,
});
await createAccountUser({
  pool,
  config,
  email: process.env.OT_TEST_VIEWER_EMAIL ?? 'viewer@example.test',
  password: process.env.OT_TEST_VIEWER_PASSWORD ?? 'ViewerPass!234',
  displayName: 'Viewer User',
  role: 'viewer',
  mfaCapable: false,
});
await seedDayOneBrowserRecords();
await seedContentFactoryBrowserSample();
await seedPortalTestLab({ pool, config });
await seedW12AdminSession();
const testClock = process.env.OT_TEST_CLOCK
  ? () => new Date(String(process.env.OT_TEST_CLOCK))
  : undefined;
const app = createApp({ config, pool, ...(testClock ? { clock: testClock } : {}) });
const server = app.listen(config.port);

process.once('SIGTERM', () => {
  server.close();
  void pool.end().finally(() => process.exit(0));
});

async function seedDayOneBrowserRecords() {
  await pool.query(
    `INSERT INTO onetime.portal_households
       (household_key, account_key, product_key, display_name)
      VALUES
        ('e2e_household_alpha', $1, $2, 'E2E Alpha Family'),
        ('e2e_household_zoom', $1, $2, 'E2E Zoom Family')`,
    [config.accountKey, config.productKey],
  );
  await pool.query(
    `INSERT INTO onetime.portal_guardian_relationships
       (relationship_key, account_key, product_key, household_key, guardian_user_ref,
        relationship_label, authority)
     VALUES ('e2e_relationship_alpha', $1, $2, 'e2e_household_alpha', $3, 'Parent',
        'primary_guardian')`,
    [config.accountKey, config.productKey, parentUserKey],
  );
  await pool.query(
    `INSERT INTO onetime.portal_learners
       (learner_key, account_key, product_key, household_key, display_name, grade_label)
      VALUES
        ('e2e_learner_alpha', $1, $2, 'e2e_household_alpha', 'E2E Alpha Learner', '6'),
        ('e2e_learner_beta', $1, $2, 'e2e_household_alpha', 'E2E Beta Learner', '5'),
        ('e2e_learner_zoom', $1, $2, 'e2e_household_zoom', 'E2E Zoom Learner', '6')`,
    [config.accountKey, config.productKey],
  );
  await pool.query(
    `INSERT INTO onetime.portal_student_access_state
       (access_state_key, account_key, product_key, household_key, learner_key, student_user_ref,
        status)
      VALUES
        ('e2e_access_alpha', $1, $2, 'e2e_household_alpha', 'e2e_learner_alpha', $3, 'active'),
        ('e2e_access_beta', $1, $2, 'e2e_household_alpha', 'e2e_learner_beta', NULL,
         'not_configured'),
        ('e2e_access_zoom', $1, $2, 'e2e_household_zoom', 'e2e_learner_zoom', $4, 'active')`,
    [config.accountKey, config.productKey, studentUserKey, zoomStudentUserKey],
  );
  await pool.query(
    `INSERT INTO onetime.account_learner_identity_links
        (link_key, account_key, product_key, household_key, learner_key, user_key)
       VALUES
        ('e2e_link_alpha_student', $1, $2, 'e2e_household_alpha', 'e2e_learner_alpha', $3),
        ('e2e_link_zoom_student', $1, $2, 'e2e_household_zoom', 'e2e_learner_zoom', $4)`,
    [config.accountKey, config.productKey, studentUserKey, zoomStudentUserKey],
  );
  await pool.query(
    `INSERT INTO onetime.classroom_household_entitlements
       (entitlement_key, account_key, product_key, household_key, entitlement_state)
      VALUES
        ('e2e_entitlement_alpha', $1, $2, 'e2e_household_alpha', 'active'),
        ('e2e_entitlement_zoom', $1, $2, 'e2e_household_zoom', 'active')`,
    [config.accountKey, config.productKey],
  );
  for (const fixture of [
    {
      householdKey: 'e2e_household_alpha',
      idempotencyKey: 'e2e-free-pilot-alpha-v1',
      sourceReference: 'e2e_free_pilot_alpha',
    },
    {
      householdKey: 'e2e_household_zoom',
      idempotencyKey: 'e2e-free-pilot-zoom-v1',
      sourceReference: 'e2e_free_pilot_zoom',
    },
  ]) {
    await grantFreePilotAccess({
      pool,
      accountKey: config.accountKey,
      productKey: config.productKey,
      actorKind: 'provisioner',
      now: new Date('2026-07-15T12:00:01.000Z'),
      command: {
        household_key: fixture.householdKey,
        idempotency_key: fixture.idempotencyKey,
        effective_at: '2026-07-15T12:00:00.000Z',
        expires_at: '2027-07-15T12:00:00.000Z',
        opaque_source_reference: fixture.sourceReference,
        policy_version: 'e2e-current-access-v1',
      },
    });
  }
  await pool.query(
    `INSERT INTO onetime.class_series
       (class_series_key, account_key, product_key, title, timezone, local_start_time,
        reminder_local_time)
     VALUES ('e2e_class_series', $1, $2, 'E2E Daily Mishnah', 'Asia/Jerusalem', '19:00',
        '18:30')`,
    [config.accountKey, config.productKey],
  );
  await pool.query(
    `INSERT INTO onetime.class_occurrences
       (occurrence_key, account_key, product_key, class_series_key, local_class_date,
        starts_at, reminder_due_at, joinable_until, occurrence_state, access_state)
     VALUES ('e2e_class_occurrence', $1, $2, 'e2e_class_series', '2026-07-16',
        $3, $4, $5, 'scheduled', 'provider_unavailable')`,
    [
      config.accountKey,
      config.productKey,
      new Date('2026-07-16T16:00:00.000Z'),
      new Date('2026-07-16T15:30:00.000Z'),
      new Date('2026-07-16T17:30:00.000Z'),
    ],
  );
  await pool.query(
    `INSERT INTO onetime.content_items
       (content_item_key, account_key, product_key, occurrence_key, title, item_type,
        lifecycle_state, latest_revision_number, latest_revision_key, published_revision_key,
        published_at)
     VALUES
       ('e2e_recording_001', $1, $2, 'e2e_class_occurrence', 'E2E Recording', 'video',
        'published', 1, 'e2e_recording_001_rev1', 'e2e_recording_001_rev1', now()),
       ('e2e_review_001', $1, $2, 'e2e_class_occurrence', 'E2E Review Sheet', 'review',
        'published', 1, 'e2e_review_001_rev1', 'e2e_review_001_rev1', now()),
       ('e2e_sibling_private', $1, $2, 'e2e_class_occurrence', 'Sibling Private Recording',
        'video', 'published', 1, 'e2e_sibling_private_rev1', 'e2e_sibling_private_rev1',
        now())`,
    [config.accountKey, config.productKey],
  );
  await pool.query(
    `INSERT INTO onetime.content_revisions
       (revision_key, account_key, product_key, content_item_key, outcome_event_key,
        revision_number, lifecycle_state, published_at)
     VALUES
       ('e2e_recording_001_rev1', $1, $2, 'e2e_recording_001', 'e2e_recording_001_outcome',
        1, 'published', now()),
       ('e2e_review_001_rev1', $1, $2, 'e2e_review_001', 'e2e_review_001_outcome',
        1, 'published', now()),
       ('e2e_sibling_private_rev1', $1, $2, 'e2e_sibling_private',
        'e2e_sibling_private_outcome', 1, 'published', now())`,
    [config.accountKey, config.productKey],
  );
  await pool.query(
    `INSERT INTO onetime.content_item_entitlements
       (entitlement_key, account_key, product_key, content_item_key, audience, household_key,
        learner_key)
     VALUES
       ('e2e_recording_all_active', $1, $2, 'e2e_recording_001', 'all_active_learners', NULL,
        NULL),
       ('e2e_review_all_active', $1, $2, 'e2e_review_001', 'all_active_learners', NULL, NULL),
       ('e2e_sibling_private_beta', $1, $2, 'e2e_sibling_private', 'learner', NULL,
        'e2e_learner_beta')`,
    [config.accountKey, config.productKey],
  );
  await pool.query(
    `INSERT INTO onetime.classroom_lesson_publications
       (lesson_key, account_key, product_key, class_series_key, occurrence_key, content_item_key,
        title, description, publication_state, featured, published_at,
        controlled_by_actor_ref, raw_private_url_present, transcript_state, resource_count,
        resources_json)
     VALUES ('e2e_lesson_recording', $1, $2, 'e2e_class_series', 'e2e_class_occurrence',
             'e2e_recording_001', 'E2E Recording', 'Deterministic approved E2E recording.',
             'published', false, now(), 'e2e_fixture', false, 'not_available', 0, '[]'::jsonb)
     ON CONFLICT (lesson_key)
     DO UPDATE SET publication_state = 'published',
                   published_at = EXCLUDED.published_at,
                   controlled_by_actor_ref = 'e2e_fixture',
                   raw_private_url_present = false,
                   updated_at = now()`,
    [config.accountKey, config.productKey],
  );
  await pool.query(
    `INSERT INTO onetime.billing_provider_accounts
       (provider, mode, provider_account_ref, status)
     VALUES ('stripe', 'test', 'acct_e2e_test', 'active')`,
  );
  await pool.query(
    `INSERT INTO onetime.billing_offer_prices
       (account_key, product_key, offer_key, provider, mode, provider_account_ref,
        provider_price_ref, currency, amount_cents)
     VALUES ($1, $2, 'offer_e2e', 'stripe', 'test', 'acct_e2e_test', 'price_e2e_test', 'usd',
        1800)`,
    [config.accountKey, config.productKey],
  );
  await pool.query(
    `INSERT INTO onetime.outbox_events
       (delivery_key, account_key, product_key, event_type, channel, payload, status,
        transport_mode)
     VALUES ('e2e_delivery_001', $1, $2, 'family_class_reminder_email.v1', 'email',
        '{}'::jsonb, 'pending', 'sink')`,
    [config.accountKey, config.productKey],
  );
  void ownerUserKey;
}

async function seedContentFactoryBrowserSample() {
  const segments = [
    'The fictional Mishnah review introduces returning a lost object.',
    'Students identify a unique mark as a sign the owner can describe.',
    'The class asks why an ordinary color may not identify the owner.',
    'A bundle with a sign is compared with loose identical objects.',
    'An announcement invites the owner to provide the identifying sign.',
    'The lesson closes by stating that this is classroom review, not a ruling.',
  ].map((text, index) => ({
    segment_id: `browser_segment_${index + 1}`,
    start_ms: index * 10_000,
    end_ms: index * 10_000 + 9_000,
    text,
  }));
  const transcript = segments.map((segment) => segment.text).join(' ');
  const webvtt =
    'WEBVTT\n\n00:00:00.000 --> 00:00:09.000\nThe fictional Mishnah review introduces returning a lost object.\n';
  const sourceKey = 'ot_launch_01_demo_hashavas_aveidah';
  await ingestContentFactoryItem({
    pool,
    config,
    item: {
      sourceKey,
      sourceKind: 'local_drop',
      sourceRefDigest: sha256('factory-browser-source-ref'),
      sourceSha256: sha256('factory-browser-source'),
      displayName: 'ot-launch-01-approved-synthetic-demo.mp4',
      mimeType: 'video/quicktime',
      byteLength: 4_200_000,
      originalDurationMs: 72_000,
      preparedDurationMs: 60_000,
      trimStartMs: 6_000,
      trimEndMs: 66_000,
      removedStartMs: 6_000,
      removedEndMs: 6_000,
      trimConfidence: 0.91,
      transcriptSegments: segments,
      normalizedTranscript: transcript,
      transcriptSha256: sha256(transcript),
      webvtt,
      webvttSha256: sha256(webvtt),
      transcriptionModel: 'synthetic-demo-no-provider',
      transcriptionLanguage: 'en',
      draft: {
        ...generateContentFactoryDraftFromTranscript({
          displayName: 'ot-launch-01-approved-synthetic-demo.mp4',
          segments,
          classLabel: 'OT-LAUNCH-01 Mishnayos',
          classDate: '2026-07-22',
        }),
        title: '[Demo] Hashavas Aveidah: Signs and Announcements',
        short_description:
          'An approved synthetic review lesson about identifying a lost object and the purpose of an announcement.',
      },
      providerVideoId: 'synthetic_demo_no_provider_resource',
      providerEmbedUrl: 'https://player.vimeo.com/video/synthetic_demo_no_provider_resource',
      providerTextTrackId: 'synthetic_demo_caption_track',
      vimeoPrivacy: 'private',
      captionsActive: true,
    },
  });
  await performContentFactoryAction({
    pool,
    config,
    sourceKey,
    actorUserKey: ownerUserKey,
    actorRole: 'owner',
    action: 'approve',
  });
  await performContentFactoryAction({
    pool,
    config,
    sourceKey,
    actorUserKey: ownerUserKey,
    actorRole: 'owner',
    action: 'publish',
  });
}

async function seedW12AdminSession() {
  const user = await pool.query(
    `SELECT user_key, security_version
       FROM onetime.account_users
      WHERE account_key = $1
        AND product_key = $2
        AND email_normalized = $3
      LIMIT 1`,
    [config.accountKey, config.productKey, W12_PORTAL_TEST_LAB.admin.email],
  );
  const row = user.rows[0];
  if (!row) throw new Error('missing W12 admin test user');
  await pool.query(
    `INSERT INTO onetime.user_sessions
       (session_key, account_key, product_key, user_key, token_hash, csrf_token_hash,
        user_agent_hash, ip_hash, expires_at, rotated_from_session_key, security_version,
        assurance_method, assurance_at)
     VALUES ($1,$2,$3,$4,$5,$6,NULL,NULL,$7,NULL,$8,'email_challenge',now())
     ON CONFLICT (session_key)
     DO UPDATE SET token_hash = EXCLUDED.token_hash,
                   csrf_token_hash = EXCLUDED.csrf_token_hash,
                   expires_at = EXCLUDED.expires_at,
                   revoked_at = NULL,
                   security_version = EXCLUDED.security_version,
                   assurance_method = 'email_challenge',
                   assurance_at = now()`,
    [
      'sess_w12_portal_test_lab_admin',
      config.accountKey,
      config.productKey,
      String(row.user_key),
      sha256(W12_E2E_ADMIN_SESSION_TOKEN),
      sha256('w12-admin-csrf-local-only'),
      new Date(Date.now() + 60 * 60 * 1000).toISOString(),
      Number(row.security_version ?? 1),
    ],
  );
}

function sha256(value: string) {
  return createHash('sha256').update(value).digest('hex');
}
