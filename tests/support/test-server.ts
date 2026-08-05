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
  grantFreePilotAccess,
  performContentFactoryAction,
  runContentFactoryWorkerOnce,
} from '../../packages/domain/src/index.ts';
import {
  W12_PORTAL_TEST_LAB,
  seedPortalTestLab,
} from '../../apps/web/src/server/features/portal-test-lab/router.ts';
import {
  CONTACT_OPERATIONS_E2E_OWNER_SESSION_TOKEN,
  CONTACT_OPERATIONS_MOBILE_E2E_OWNER_SESSION_TOKEN,
  CRM_CORE_E2E_OWNER_SESSION_TOKEN,
} from './contact-operations-session.ts';
import {
  W12_E2E_ADMIN_CSRF_TOKEN,
  W12_E2E_ADMIN_SESSION_TOKEN,
} from './w12-portal-test-lab-session.ts';
import {
  VIMEO_CATALOG_E2E_STUDENT_CSRF_TOKEN,
  VIMEO_CATALOG_E2E_STUDENT_SESSION_TOKEN,
} from './vimeo-mishnayos-catalog-session.ts';

const config = loadConfig({
  ...process.env,
  NODE_ENV: 'test',
  LOGIN_IDENTIFIER_RATE_LIMIT_MAX: '500',
  LOGIN_IP_RATE_LIMIT_MAX: '500',
  LOGIN_ACCOUNT_RATE_LIMIT_MAX: '5000',
  LOGIN_GLOBAL_RATE_LIMIT_MAX: '5000',
  PORT: process.env.PORT ?? '3100',
  PUBLIC_BASE_URL: `http://127.0.0.1:${process.env.PORT ?? '3100'}`,
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
// pg-mem skips migration 2258's PostgreSQL-catalog block, leaving its generated fixed-date check.
await pool.query(
  'ALTER TABLE onetime.family_signup_access_projections DROP CONSTRAINT IF EXISTS family_signup_access_projections_constraint_7',
);
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
  role: 'admin',
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
const pausedParentUserKey = await createAccountUser({
  pool,
  config,
  email: process.env.OT_TEST_PAUSED_PARENT_EMAIL ?? 'ot-paused-parent@example.test',
  password: process.env.OT_TEST_PAUSED_PARENT_PASSWORD ?? 'PausedParentPassword!234',
  displayName: 'Test Paused Parent',
  role: 'parent',
  mfaCapable: false,
});
const contactOperationsParentUserKey = await createAccountUser({
  pool,
  config,
  email: 'contact-operations-parent@example.test',
  password: 'ContactOperationsParent!234',
  displayName: 'Contact Operations Parent',
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
const contactOperationsStudentUserKey = await createAccountUser({
  pool,
  config,
  email: 'contact-operations-student@example.test',
  password: 'ContactOperationsStudent!234',
  displayName: 'Contact Operations Student',
  role: 'student',
  mfaCapable: false,
});
const contentFactoryStudentUserKey = await createAccountUser({
  pool,
  config,
  email: 'content-factory-student@example.test',
  password: 'ContentFactoryStudent!234',
  displayName: 'Content Factory Student',
  role: 'student',
  mfaCapable: false,
});
const vimeoCatalogStudentUserKey = await createAccountUser({
  pool,
  config,
  email: 'vimeo-catalog-student@example.test',
  password: 'VimeoCatalogStudent!234',
  displayName: 'Vimeo Catalog Student',
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
await seedPortalTestLab({ pool, config: { ...config, portalTestLabEnabled: true } });
await seedW12AdminSession();
await seedContactOperationsOwnerSession();
await seedVimeoCatalogStudentSession();
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
        ('e2e_household_zoom', $1, $2, 'E2E Zoom Family'),
        ('e2e_household_paused', $1, $2, 'E2E Paused Family'),
        ('content_factory_household', $1, $2, 'Content Factory Family'),
        ('vimeo_catalog_household', $1, $2, 'Vimeo Catalog Family'),
        ('contact_operations_household', $1, $2, 'Contact Operations Family')`,
    [config.accountKey, config.productKey],
  );
  await pool.query(
    `INSERT INTO onetime.portal_guardian_relationships
       (relationship_key, account_key, product_key, household_key, guardian_user_ref,
        relationship_label, authority)
     VALUES
       ('e2e_relationship_alpha', $1, $2, 'e2e_household_alpha', $3, 'Parent',
        'primary_guardian'),
       ('e2e_relationship_paused', $1, $2, 'e2e_household_paused', $4, 'Parent',
        'primary_guardian'),
       ('contact_operations_relationship', $1, $2, 'contact_operations_household', $5,
        'Parent', 'primary_guardian')`,
    [
      config.accountKey,
      config.productKey,
      parentUserKey,
      pausedParentUserKey,
      contactOperationsParentUserKey,
    ],
  );
  await pool.query(
    `INSERT INTO onetime.contacts
       (contact_key, public_contact_id, account_key, product_key, display_name,
        family_school_classification, family_or_school, location_text, timezone,
        email_normalized, reminder_preference, suppression_state, source)
     VALUES
       ('e2e_contact_parent','e2e-public-parent',$1,$2,'Test Parent',
        'family','E2E Alpha Family','Jerusalem','Asia/Jerusalem',
        'ot-parent@example.test','none','active','e2e_fixture'),
       ('e2e_contact_paused_parent','e2e-public-paused-parent',$1,$2,'Test Paused Parent',
        'family','E2E Paused Family','Jerusalem','Asia/Jerusalem',
        'ot-paused-parent@example.test','none','active','e2e_fixture'),
       ('contact_operations_parent','contact-operations-public-parent',$1,$2,
        'Contact Operations Parent','family','Contact Operations Family','Jerusalem',
        'Asia/Jerusalem','contact-operations-parent@example.test','none','active',
        'contact_operations_e2e_fixture')`,
    [config.accountKey, config.productKey],
  );
  await pool.query(
    `INSERT INTO onetime.adult_household_contact_links
       (link_key, account_key, product_key, contact_key, household_key,
        guardian_user_ref, highlevel_location_id, highlevel_contact_id, sync_state)
     VALUES
       ('e2e_adult_link_parent',$1,$2,'e2e_contact_parent','e2e_household_alpha',
        $5,$4,NULL,'sync_pending'),
       ('e2e_adult_link_paused',$1,$2,'e2e_contact_paused_parent','e2e_household_paused',
        $3,$4,NULL,'sync_pending'),
       ('contact_operations_adult_link',$1,$2,'contact_operations_parent',
        'contact_operations_household',$6,$4,'contact_operations_highlevel_parent','synced')`,
    [
      config.accountKey,
      config.productKey,
      pausedParentUserKey,
      config.highLevelLocationId,
      parentUserKey,
      contactOperationsParentUserKey,
    ],
  );
  await pool.query(
    `INSERT INTO onetime.portal_learners
       (learner_key, account_key, product_key, household_key, display_name, grade_label)
      VALUES
        ('e2e_learner_alpha', $1, $2, 'e2e_household_alpha', 'E2E Alpha Learner', '6'),
        ('e2e_learner_beta', $1, $2, 'e2e_household_alpha', 'E2E Beta Learner', '5'),
        ('e2e_learner_zoom', $1, $2, 'e2e_household_zoom', 'E2E Zoom Learner', '6'),
        ('content_factory_learner', $1, $2, 'content_factory_household',
         'Content Factory Student', '6'),
        ('vimeo_catalog_learner', $1, $2, 'vimeo_catalog_household',
         'Vimeo Catalog Student', '6'),
        ('contact_operations_learner', $1, $2, 'contact_operations_household',
         'Contact Operations Student', '6')`,
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
        ('e2e_access_zoom', $1, $2, 'e2e_household_zoom', 'e2e_learner_zoom', $4, 'active'),
        ('contact_operations_access', $1, $2, 'contact_operations_household',
         'contact_operations_learner', $5, 'active'),
        ('content_factory_access', $1, $2, 'content_factory_household',
          'content_factory_learner', $6, 'active'),
        ('vimeo_catalog_access', $1, $2, 'vimeo_catalog_household',
          'vimeo_catalog_learner', $7, 'active')`,
    [
      config.accountKey,
      config.productKey,
      studentUserKey,
      zoomStudentUserKey,
      contactOperationsStudentUserKey,
      contentFactoryStudentUserKey,
      vimeoCatalogStudentUserKey,
    ],
  );
  await pool.query(
    `INSERT INTO onetime.account_learner_identity_links
        (link_key, account_key, product_key, household_key, learner_key, user_key)
       VALUES
        ('e2e_link_alpha_student', $1, $2, 'e2e_household_alpha', 'e2e_learner_alpha', $3),
        ('e2e_link_zoom_student', $1, $2, 'e2e_household_zoom', 'e2e_learner_zoom', $4),
        ('contact_operations_student_link', $1, $2, 'contact_operations_household',
         'contact_operations_learner', $5),
        ('content_factory_student_link', $1, $2, 'content_factory_household',
          'content_factory_learner', $6),
        ('vimeo_catalog_student_link', $1, $2, 'vimeo_catalog_household',
          'vimeo_catalog_learner', $7)`,
    [
      config.accountKey,
      config.productKey,
      studentUserKey,
      zoomStudentUserKey,
      contactOperationsStudentUserKey,
      contentFactoryStudentUserKey,
      vimeoCatalogStudentUserKey,
    ],
  );
  await pool.query(
    `INSERT INTO onetime.classroom_household_entitlements
       (entitlement_key, account_key, product_key, household_key, entitlement_state)
      VALUES
        ('e2e_entitlement_alpha', $1, $2, 'e2e_household_alpha', 'active'),
        ('e2e_entitlement_zoom', $1, $2, 'e2e_household_zoom', 'active'),
        ('content_factory_entitlement', $1, $2, 'content_factory_household', 'active'),
        ('vimeo_catalog_entitlement', $1, $2, 'vimeo_catalog_household', 'active')`,
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
    {
      householdKey: 'contact_operations_household',
      idempotencyKey: 'contact-operations-free-pilot-v1',
      sourceReference: 'contact_operations_free_pilot',
    },
    {
      householdKey: 'content_factory_household',
      idempotencyKey: 'content-factory-free-pilot-v1',
      sourceReference: 'content_factory_free_pilot',
    },
    {
      householdKey: 'vimeo_catalog_household',
      idempotencyKey: 'vimeo-catalog-free-pilot-v1',
      sourceReference: 'vimeo_catalog_free_pilot',
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
        starts_at, reminder_due_at, joinable_until, occurrence_state, access_state,
        join_opens_at, join_closes_at, scheduled_ends_at)
     VALUES ('e2e_class_occurrence', $1, $2, 'e2e_class_series', '2026-07-16',
        $3, $4, $5, 'scheduled', 'provider_unavailable',
        $3::timestamptz - interval '15 minutes', $5, $5)`,
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

async function runContentFactoryBrowserAcceptance() {
  await pool.query(
    `INSERT INTO onetime.classroom_occurrence_learner_entitlements
       (occurrence_entitlement_key, account_key, product_key, occurrence_key,
        household_key, learner_key, entitlement_state, source)
     VALUES ('browser_occurrence_alpha',$1,$2,'e2e_class_occurrence',
       'e2e_household_alpha','e2e_learner_alpha','active','isolated_acceptance'),
       ('browser_occurrence_content_factory',$1,$2,'e2e_class_occurrence',
       'content_factory_household','content_factory_learner','active','isolated_acceptance')`,
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
      sha256(W12_E2E_ADMIN_CSRF_TOKEN),
      new Date(Date.now() + 60 * 60 * 1000).toISOString(),
      Number(row.security_version ?? 1),
    ],
  );
}

async function seedContactOperationsOwnerSession() {
  const user = await pool.query(
    `SELECT security_version
       FROM onetime.account_users
      WHERE account_key = $1
        AND product_key = $2
        AND user_key = $3
      LIMIT 1`,
    [config.accountKey, config.productKey, ownerUserKey],
  );
  const row = user.rows[0];
  if (!row) throw new Error('missing contact operations owner test user');
  for (const session of [
    {
      sessionKey: 'sess_contact_operations_owner',
      token: CONTACT_OPERATIONS_E2E_OWNER_SESSION_TOKEN,
      csrfToken: 'contact-operations-owner-csrf-local-only',
    },
    {
      sessionKey: 'sess_contact_operations_mobile_owner',
      token: CONTACT_OPERATIONS_MOBILE_E2E_OWNER_SESSION_TOKEN,
      csrfToken: 'contact-operations-mobile-owner-csrf-local-only',
    },
    {
      sessionKey: 'sess_crm_core_owner',
      token: CRM_CORE_E2E_OWNER_SESSION_TOKEN,
      csrfToken: 'crm-core-owner-csrf-local-only',
    },
  ]) {
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
        session.sessionKey,
        config.accountKey,
        config.productKey,
        ownerUserKey,
        sha256(session.token),
        sha256(session.csrfToken),
        new Date(Date.now() + 60 * 60 * 1000).toISOString(),
        Number(row.security_version ?? 1),
      ],
    );
  }
}

async function seedVimeoCatalogStudentSession() {
  const user = await pool.query(
    `SELECT security_version
       FROM onetime.account_users
      WHERE account_key = $1
        AND product_key = $2
        AND user_key = $3
      LIMIT 1`,
    [config.accountKey, config.productKey, vimeoCatalogStudentUserKey],
  );
  const row = user.rows[0];
  if (!row) throw new Error('missing Vimeo catalog browser Student');
  await pool.query(
    `INSERT INTO onetime.user_sessions
       (session_key, account_key, product_key, user_key, token_hash, csrf_token_hash,
        user_agent_hash, ip_hash, expires_at, rotated_from_session_key, security_version,
        assurance_method, assurance_at)
     VALUES ($1,$2,$3,$4,$5,$6,NULL,NULL,$7,NULL,$8,'password',now())
     ON CONFLICT (session_key)
     DO UPDATE SET token_hash = EXCLUDED.token_hash,
                   csrf_token_hash = EXCLUDED.csrf_token_hash,
                   expires_at = EXCLUDED.expires_at,
                   revoked_at = NULL,
                   security_version = EXCLUDED.security_version,
                   assurance_method = 'password',
                   assurance_at = now()`,
    [
      'sess_vimeo_catalog_student',
      config.accountKey,
      config.productKey,
      vimeoCatalogStudentUserKey,
      sha256(VIMEO_CATALOG_E2E_STUDENT_SESSION_TOKEN),
      sha256(VIMEO_CATALOG_E2E_STUDENT_CSRF_TOKEN),
      new Date(Date.now() + 60 * 60 * 1000).toISOString(),
      Number(row.security_version ?? 1),
    ],
  );
}

function sha256(value: string) {
  return createHash('sha256').update(value).digest('hex');
}
