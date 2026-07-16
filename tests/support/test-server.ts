import { loadConfig } from '../../packages/config/src/index.ts';
import { createMemoryPool, runMigrations } from '../../packages/db/src/index.ts';
import { createApp } from '../../apps/web/src/server/app.ts';
import { createAccountUser } from '../../packages/domain/src/index.ts';

const config = loadConfig({
  ...process.env,
  NODE_ENV: 'test',
  PORT: process.env.PORT ?? '3100',
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
const app = createApp({ config, pool });
const server = app.listen(config.port);

process.on('SIGTERM', async () => {
  server.close();
  await pool.end();
});

async function seedDayOneBrowserRecords() {
  await pool.query(
    `INSERT INTO onetime.portal_households
       (household_key, account_key, product_key, display_name)
     VALUES ('e2e_household_alpha', $1, $2, 'E2E Alpha Family')`,
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
       ('e2e_learner_beta', $1, $2, 'e2e_household_alpha', 'E2E Beta Learner', '5')`,
    [config.accountKey, config.productKey],
  );
  await pool.query(
    `INSERT INTO onetime.portal_student_access_state
       (access_state_key, account_key, product_key, household_key, learner_key, student_user_ref,
        status)
     VALUES
       ('e2e_access_alpha', $1, $2, 'e2e_household_alpha', 'e2e_learner_alpha', $3, 'active'),
       ('e2e_access_beta', $1, $2, 'e2e_household_alpha', 'e2e_learner_beta', NULL,
        'not_configured')`,
    [config.accountKey, config.productKey, studentUserKey],
  );
  await pool.query(
    `INSERT INTO onetime.account_learner_identity_links
       (link_key, account_key, product_key, household_key, learner_key, user_key)
     VALUES ('e2e_link_alpha_student', $1, $2, 'e2e_household_alpha', 'e2e_learner_alpha', $3)`,
    [config.accountKey, config.productKey, studentUserKey],
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
