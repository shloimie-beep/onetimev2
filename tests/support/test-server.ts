import { createHash } from 'node:crypto';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { Readable } from 'node:stream';
import { loadConfig } from '../../packages/config/src/index.ts';
import { createMemoryPool, runMigrations } from '../../packages/db/src/index.ts';
import { createApp } from '../../apps/web/src/server/app.ts';
import {
  createAccountUser,
  createContentFactoryIntake,
  contentFactoryStorageFromEnv,
  editContentFactoryItem,
  performContentFactoryAction,
  runContentFactoryWorkerOnce,
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
process.env.CONTENT_FACTORY_STORAGE_DRIVER = 'volume';
process.env.CONTENT_FACTORY_STORAGE_ROOT = await mkdtemp(
  path.join(tmpdir(), 'onetime-browser-content-factory-'),
);
process.env.CONTENT_FACTORY_MAX_UPLOAD_BYTES = '10485760';
process.env.CONTENT_FACTORY_PROCESSING_MODE = 'synthetic';
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
await seedActiveSupportEntitlement(parentUserKey);
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
await runContentFactoryBrowserAcceptance();
await seedPortalTestLab({ pool, config });
await seedW12AdminSession();
const testClock = process.env.OT_TEST_CLOCK
  ? () => new Date(String(process.env.OT_TEST_CLOCK))
  : undefined;
const app = createApp({
  config,
  pool,
  ...(testClock ? { clock: testClock } : {}),
  contentFactoryJobNotifier: async () => {
    for (let attempt = 0; attempt < 6; attempt += 1) {
      await runContentFactoryWorkerOnce({
        pool,
        config,
        storage: contentFactoryStorageFromEnv(),
        workerIdentity: 'chromium-content-factory-worker',
        mode: 'synthetic',
      });
    }
  },
});
const server = app.listen(config.port);

let shutdownStarted = false;
async function shutdownTestServer() {
  if (shutdownStarted) return;
  shutdownStarted = true;
  server.close();
  server.closeAllConnections?.();
  await Promise.race([pool.end(), new Promise((resolve) => setTimeout(resolve, 250))]);
  process.exit(0);
}

process.once('SIGTERM', () => void shutdownTestServer());
process.once('SIGINT', () => void shutdownTestServer());

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
  await pool.query(
    `INSERT INTO onetime.billing_entitlement_projections
       (entitlement_key, account_key, product_key, principal_key, principal_type, status,
        policy_version, source, reason, effective_at, evaluated_at, grants_access)
     VALUES (
       'billing_entitlement:' || $1 || ':' || $2 || ':e2e_household_alpha',
       $1,
       $2,
       'e2e_household_alpha',
       'opaque',
       'active',
       '2026-07-15.1',
       'test_fixture_paid_invoice',
       'active_paid_current_invoice',
       '2026-07-15T12:00:00.000Z',
       '2026-07-15T12:00:01.000Z',
       true
     )`,
    [config.accountKey, config.productKey],
  );
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

async function seedActiveSupportEntitlement(userKey: string) {
  await pool.query(
    `INSERT INTO onetime.billing_entitlement_projections
       (entitlement_key, account_key, product_key, principal_key, principal_type, status,
        policy_version, source, reason, effective_at, evaluated_at)
     VALUES ($1,$2,$3,$4,'account_user','active','test-policy','test','active',now(),now())`,
    [`e2e_entitlement_${userKey.slice(0, 16)}`, config.accountKey, config.productKey, userKey],
  );
  await pool.query(
    `INSERT INTO onetime.billing_subscription_projections
       (account_key, product_key, principal_key, principal_type, provider, mode,
        provider_account_ref, provider_customer_ref, provider_subscription_ref, status,
        current_period_end, provider_updated_at, source_event_key)
     VALUES ($1,$2,$3,'account_user','stripe','test','acct_e2e_support',$4,$5,'active',
        $6::timestamptz,now(),$7)`,
    [
      config.accountKey,
      config.productKey,
      userKey,
      `cus_support_${userKey.slice(0, 12)}`,
      `sub_support_${userKey.slice(0, 12)}`,
      new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      `evt_support_${userKey.slice(0, 12)}`,
    ],
  );
}

async function runContentFactoryBrowserAcceptance() {
  await pool.query(
    `INSERT INTO onetime.classroom_occurrence_learner_entitlements
       (occurrence_entitlement_key, account_key, product_key, occurrence_key,
        household_key, learner_key, entitlement_state, source)
     VALUES ('browser_occurrence_alpha',$1,$2,'e2e_class_occurrence',
       'e2e_household_alpha','e2e_learner_alpha','active','isolated_acceptance')`,
    [config.accountKey, config.productKey],
  );
  const media = syntheticMp4('browser-acceptance');
  const staged = await contentFactoryStorageFromEnv().stage({
    stream: Readable.from([media]),
    displayName: 'browser-accepted-occurrence.mp4',
    declaredMimeType: 'video/mp4',
    declaredLength: media.byteLength,
  });
  const intake = await createContentFactoryIntake({
    pool,
    config,
    actorUserKey: ownerUserKey,
    actorRole: 'owner',
    displayName: staged.displayName,
    mimeType: staged.mimeType,
    byteLength: staged.byteLength,
    sourceSha256: staged.sourceSha256,
    privateRefDigest: staged.privateRefDigest,
    storageLocator: staged.storageLocator,
    occurrenceKey: 'e2e_class_occurrence',
    idempotencyKey: 'browser-acceptance-intake-01',
  });
  for (let index = 0; index < 6; index += 1) {
    await runContentFactoryWorkerOnce({
      pool,
      config,
      storage: contentFactoryStorageFromEnv(),
      workerIdentity: `browser-acceptance-worker-${index}`,
      mode: 'synthetic',
    });
  }
  const job = await pool.query(
    `SELECT source_key FROM onetime.learning_delivery_content_factory_jobs
      WHERE intake_key = $1 AND job_state = 'completed' LIMIT 1`,
    [intake.intake_key],
  );
  const sourceKey = String(job.rows[0]?.source_key ?? '');
  if (!sourceKey) throw new Error('browser content factory acceptance did not complete');
  await editContentFactoryItem({
    pool,
    config,
    sourceKey,
    actorUserKey: ownerUserKey,
    actorRole: 'owner',
    payload: {
      title: 'Approved occurrence-scoped synthetic Mishnah review',
      short_description:
        'Approved provider-off acceptance content for the selected class occurrence.',
      occurrence_key: 'e2e_class_occurrence',
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

function syntheticMp4(label: string) {
  const bytes = Buffer.alloc(4_096, 0);
  bytes.writeUInt32BE(24, 0);
  bytes.write('ftyp', 4, 'ascii');
  bytes.write('isom', 8, 'ascii');
  createHash('sha256').update(label).digest().copy(bytes, 32);
  return bytes;
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
