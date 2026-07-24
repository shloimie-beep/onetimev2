import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { loadConfig, type AppConfig } from '../../../packages/config/src/index.ts';
import { createMemoryPool, runMigrations, type DbPool } from '../../../packages/db/src/index.ts';
import {
  applyHouseholdAccessState,
  createAccountUser,
  DeterministicFakeHighLevelAdapter,
  enrollParentHousehold,
  readAdultContactLink,
  readHouseholdAccess,
  reconcileAdultContactLink,
  requestParentResetForHousehold,
  runHighLevelProjectionBatch,
  setContactOperationsAccess,
} from '../../../packages/domain/src/index.ts';

let pool: DbPool;
let config: AppConfig;
let ownerUserKey: string;

const now = new Date('2026-07-24T08:00:00.000Z');
const enrollmentPayload = {
  idempotency_key: 'contact-ops-enrollment-0001',
  adult: {
    display_name: 'Operations Parent',
    email: 'operations.parent@example.test',
    phone: '+972501234567',
    classification: 'family' as const,
    family_or_school: 'Operations Family',
    location: 'Jerusalem',
    timezone: 'Asia/Jerusalem',
  },
  household: {
    household_key: 'household_contact_operations',
    display_name: 'Operations Family',
  },
  students: [
    { display_name: 'Student One', username: 'operations.one' },
    { display_name: 'Student Two', username: 'operations.two' },
    { display_name: 'Student Three', username: 'operations.three' },
    { display_name: 'Student Four', username: 'operations.four' },
  ],
  complimentary: {
    expires_at: '2026-09-01T00:00:00.000Z',
    policy_version: 'contact-ops-test-v1',
    opaque_source_reference: 'complimentary_contact_ops_0001',
  },
};

beforeEach(async () => {
  config = loadConfig({
    NODE_ENV: 'test',
    PUBLIC_BASE_URL: 'https://join.onetimeonetime.com',
    ONE_TIME_ACCOUNT_KEY: 'contact_operations_account',
    ONE_TIME_PRODUCT_KEY: 'contact_operations_product',
    HIGHLEVEL_EVENT_SYNC_MODE: 'mock',
  });
  pool = createMemoryPool();
  await runMigrations(pool);
  ownerUserKey = await createAccountUser({
    pool,
    config,
    email: 'contact.ops.owner@example.test',
    password: 'ContactOpsOwner!234',
    displayName: 'Contact Ops Owner',
    role: 'owner',
  });
});

afterEach(async () => {
  await pool.end();
});

describe('Parent and Student contact operations', () => {
  it('atomically enrolls one adult, any positive number of local Students, and one adult-only projection', async () => {
    const enrolled = await enroll();
    expect(enrolled).toMatchObject({
      replayed: false,
      household_key: enrollmentPayload.household.household_key,
      access_state: 'active',
      sync_state: 'sync_pending',
      child_highlevel_operations: 0,
      plaintext_credentials_stored: false,
      payment_history_written: false,
    });
    expect(enrolled.student_setup_token_refs).toHaveLength(4);

    const replayed = await enroll();
    expect(replayed).toMatchObject({
      replayed: true,
      contact_key: enrolled.contact_key,
      household_key: enrolled.household_key,
    });

    const counts = await pool.query(
      `SELECT
         (SELECT count(*)::int FROM onetime.contacts) AS contacts,
         (SELECT count(*)::int FROM onetime.portal_households) AS households,
         (SELECT count(*)::int FROM onetime.portal_learners) AS learners,
         (SELECT count(*)::int FROM onetime.account_lifecycle_tokens
           WHERE token_type = 'parent_activation') AS parent_tokens,
         (SELECT count(*)::int FROM onetime.account_lifecycle_tokens
           WHERE token_type = 'student_setup') AS student_tokens,
         (SELECT count(*)::int FROM onetime.outbox_events
           WHERE channel = 'highlevel') AS highlevel_events`,
    );
    expect(
      Object.fromEntries(
        Object.entries(counts.rows[0] ?? {}).map(([key, value]) => [
          key,
          Number(Array.isArray(value) ? value[0] : value),
        ]),
      ),
    ).toMatchObject({
      contacts: 1,
      households: 1,
      learners: 4,
      parent_tokens: 1,
      student_tokens: 4,
      highlevel_events: 1,
    });

    const projection = await pool.query(
      `SELECT payload
         FROM onetime.outbox_events
        WHERE channel = 'highlevel'`,
    );
    expect(projection.rows[0]?.payload).toMatchObject({
      event_name: 'parent.household.sync_requested',
      adult_contact: { contact_key: enrolled.contact_key, adult_only: true },
      data: { household_key: enrolled.household_key },
    });
    expect(JSON.stringify(projection.rows[0]?.payload)).not.toMatch(
      /student|learner|username|password|amount|invoice|subscription/i,
    );

    await expect(
      enrollParentHousehold({
        pool,
        config,
        actor: { userKey: ownerUserKey, role: 'owner' },
        payload: {
          ...enrollmentPayload,
          adult: { ...enrollmentPayload.adult, display_name: 'Changed Parent' },
        },
        now,
      }),
    ).rejects.toMatchObject({ code: 'IDEMPOTENCY_CONFLICT' });
  });

  it('rejects owner, admin, and Student email collisions before enrollment writes persist', async () => {
    await createAccountUser({
      pool,
      config,
      email: 'collision.admin@example.test',
      password: 'CollisionAdmin!234',
      displayName: 'Collision Admin',
      role: 'admin',
    });
    await createAccountUser({
      pool,
      config,
      email: 'collision.student@example.test',
      password: 'CollisionStudent!234',
      displayName: 'Collision Student',
      role: 'student',
    });

    for (const [index, email] of [
      'contact.ops.owner@example.test',
      'collision.admin@example.test',
      'collision.student@example.test',
    ].entries()) {
      await expect(
        enrollParentHousehold({
          pool,
          config,
          actor: { userKey: ownerUserKey, role: 'owner' },
          payload: {
            ...enrollmentPayload,
            idempotency_key: `contact-ops-collision-${index}-0001`,
            adult: { ...enrollmentPayload.adult, email },
            household: {
              household_key: `household_contact_collision_${index}`,
              display_name: `Collision Family ${index}`,
            },
          },
          now,
        }),
      ).rejects.toMatchObject({ code: 'IDENTITY_CONFLICT' });
    }

    const writes = await pool.query(
      `SELECT
         (SELECT count(*)::int FROM onetime.contacts) AS contacts,
         (SELECT count(*)::int FROM onetime.portal_households) AS households,
         (SELECT count(*)::int FROM onetime.account_lifecycle_tokens) AS lifecycle_tokens`,
    );
    expect(
      Object.fromEntries(
        Object.entries(writes.rows[0] ?? {}).map(([key, value]) => [key, Number(value)]),
      ),
    ).toEqual({ contacts: 0, households: 0, lifecycle_tokens: 0 });
  });

  it('derives paid, complimentary, and suspension truth independently', async () => {
    const enrolled = await enroll();
    await applyHouseholdAccessState({
      pool,
      accountKey: config.accountKey,
      productKey: config.productKey,
      sourceKind: 'highlevel_payment_state',
      actorKind: 'highlevel_action',
      idempotencyKey: 'contact-ops-paid-active-0001',
      now: new Date('2026-07-24T08:01:00.000Z'),
      command: {
        household_key: enrolled.household_key,
        state: 'active',
        effective_at: now.toISOString(),
        expires_at: null,
        opaque_source_reference: 'paid_contact_operations_0001',
        source_revision: 1,
        source_updated_at: '2026-07-24T08:01:00.000Z',
        policy_version: 'paid-contact-ops-v1',
        revocation_reason: null,
      },
    });

    await setContactOperationsAccess({
      pool,
      config,
      actor: { userKey: ownerUserKey, role: 'owner' },
      householdKey: enrolled.household_key,
      operation: 'revoke_complimentary',
      idempotencyKey: 'contact-ops-complimentary-revoke-0001',
      policyVersion: 'contact-ops-test-v1',
      now: new Date('2026-07-24T08:02:00.000Z'),
    });
    expect(await access(enrolled.household_key)).toMatchObject({
      state: 'active',
      source_kind: 'highlevel_payment_state',
      grants_access: true,
    });

    const suspended = await setContactOperationsAccess({
      pool,
      config,
      actor: { userKey: ownerUserKey, role: 'owner' },
      householdKey: enrolled.household_key,
      operation: 'suspend',
      idempotencyKey: 'contact-ops-suspend-0001',
      policyVersion: 'contact-ops-test-v1',
      reason: 'safeguarding_review_billing_unchanged',
      now: new Date('2026-07-24T08:03:00.000Z'),
    });
    expect(suspended).toMatchObject({
      billing_mutated: false,
      payment_history_written: false,
      projection: { state: 'suspended', grants_access: false },
    });

    await setContactOperationsAccess({
      pool,
      config,
      actor: { userKey: ownerUserKey, role: 'owner' },
      householdKey: enrolled.household_key,
      operation: 'release',
      idempotencyKey: 'contact-ops-release-0001',
      policyVersion: 'contact-ops-test-v1',
      now: new Date('2026-07-24T08:04:00.000Z'),
    });
    expect(await access(enrolled.household_key)).toMatchObject({
      state: 'active',
      source_kind: 'highlevel_payment_state',
      grants_access: true,
    });

    const sourceSlots = await pool.query(
      `SELECT source_slot, state
         FROM onetime.account_access_source_states
        WHERE account_key = $1 AND product_key = $2 AND household_key = $3
        ORDER BY source_slot`,
      [config.accountKey, config.productKey, enrolled.household_key],
    );
    expect(sourceSlots.rows).toEqual([
      expect.objectContaining({ source_slot: 'admin_suspension', state: 'revoked' }),
      expect.objectContaining({ source_slot: 'complimentary', state: 'revoked' }),
      expect.objectContaining({ source_slot: 'highlevel_payment_state', state: 'active' }),
    ]);
  });

  it('starts without complimentary access in a paused projection and keeps GHL links operator-only', async () => {
    const enrolled = await enrollParentHousehold({
      pool,
      config,
      actor: { userKey: ownerUserKey, role: 'owner' },
      payload: {
        ...enrollmentPayload,
        idempotency_key: 'contact-ops-enrollment-paused-0001',
        complimentary: undefined,
      },
      now,
    });
    expect(enrolled.access_state).toBe('paused');
    expect(await access(enrolled.household_key)).toMatchObject({
      state: 'paused',
      grants_access: false,
    });
    const source = await pool.query(
      `SELECT source_slot, state, revocation_reason
         FROM onetime.account_access_source_states
        WHERE account_key = $1
          AND product_key = $2
          AND household_key = $3
          AND source_slot = 'complimentary'`,
      [config.accountKey, config.productKey, enrolled.household_key],
    );
    expect(source.rows[0]).toMatchObject({
      source_slot: 'complimentary',
      state: 'revoked',
      revocation_reason: 'complimentary_not_granted',
    });
    await expect(
      readAdultContactLink({
        pool,
        config,
        actor: {
          userKey: 'parent_contact_operations',
          role: 'parent',
          authorizedHouseholds: [enrolled.household_key],
        },
        householdKey: enrolled.household_key,
      }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });

  it('succeeds locally while GHL is unavailable and later delivers the same adult once', async () => {
    const enrolled = await enroll();
    const queued = await pool.query(
      `SELECT delivery_key FROM onetime.outbox_events
        WHERE channel = 'highlevel' AND contact_key = $1`,
      [enrolled.contact_key],
    );
    const deliveryKey = String(queued.rows[0]?.delivery_key);
    const canaryConfig = loadConfig({
      NODE_ENV: 'test',
      PUBLIC_BASE_URL: 'https://join.onetimeonetime.com',
      ONE_TIME_ACCOUNT_KEY: config.accountKey,
      ONE_TIME_PRODUCT_KEY: config.productKey,
      HIGHLEVEL_EVENT_SYNC_MODE: 'mock',
      HIGHLEVEL_CANARY_RUN_ID: 'contact-ops-canary-0001',
      HIGHLEVEL_CANARY_DELIVERY_KEYS: deliveryKey,
      HIGHLEVEL_CANARY_BUDGET: '1',
    });
    const adapter = new DeterministicFakeHighLevelAdapter();
    await expect(
      runHighLevelProjectionBatch({
        pool,
        config: canaryConfig,
        adapter,
        now: new Date('2026-07-24T08:05:00.000Z'),
      }),
    ).resolves.toMatchObject({ enabled: true, claimed: 1, delivered: 1 });
    await expect(
      runHighLevelProjectionBatch({
        pool,
        config: canaryConfig,
        adapter,
        now: new Date('2026-07-24T08:06:00.000Z'),
      }),
    ).resolves.toMatchObject({ enabled: true, claimed: 0, delivered: 0 });
    expect(adapter.calls).toHaveLength(1);
    expect(adapter.calls[0]).toMatchObject({
      contactKey: enrolled.contact_key,
      customFieldIds: expect.arrayContaining(['PIuJBPvZGI3FTp4ZRpay']),
    });

    const link = await readAdultContactLink({
      pool,
      config: canaryConfig,
      actor: { userKey: ownerUserKey, role: 'owner' },
      householdKey: enrolled.household_key,
    });
    expect(link).toMatchObject({
      sync_state: 'synced',
      highlevel_contact_linked: true,
      payment_data_present: false,
    });
    expect(link.open_in_highlevel_url).toContain(canaryConfig.highLevelLocationId);
  });

  it('coalesces an idempotent single-Parent reconcile to exactly one new projection', async () => {
    const enrolled = await enroll();
    const first = await reconcileAdultContactLink({
      pool,
      config,
      actor: { userKey: ownerUserKey, role: 'owner' },
      householdKey: enrolled.household_key,
      idempotencyKey: 'contact-ops-reconcile-0001',
      now: new Date('2026-07-24T08:07:00.000Z'),
    });
    const replay = await reconcileAdultContactLink({
      pool,
      config,
      actor: { userKey: ownerUserKey, role: 'owner' },
      householdKey: enrolled.household_key,
      idempotencyKey: 'contact-ops-reconcile-0001',
      now: new Date('2026-07-24T08:08:00.000Z'),
    });
    expect(first).toMatchObject({
      duplicate: false,
      projection_revision: 2,
      child_highlevel_operations: 0,
    });
    expect(replay).toMatchObject({
      duplicate: true,
      projection_revision: 2,
      child_highlevel_operations: 0,
    });

    const events = await pool.query(
      `SELECT payload
         FROM onetime.outbox_events
        WHERE channel = 'highlevel' AND contact_key = $1
        ORDER BY created_at, delivery_key`,
      [enrolled.contact_key],
    );
    expect(events.rows).toHaveLength(2);
    expect(JSON.stringify(events.rows)).not.toMatch(
      /student|learner|username|password|amount|invoice|subscription/i,
    );
  });

  it('binds Parent recovery to one exact active Parent guardian and replays without a second token', async () => {
    const enrolled = await enroll();
    await expect(
      requestParentResetForHousehold({
        pool,
        config,
        actor: { userKey: ownerUserKey, role: 'owner' },
        householdKey: enrolled.household_key,
        idempotencyKey: 'contact-ops-parent-reset-unactivated',
        now,
      }),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });

    await activateAdultGuardian(enrolled);
    const first = await requestParentResetForHousehold({
      pool,
      config,
      actor: { userKey: ownerUserKey, role: 'owner' },
      householdKey: enrolled.household_key,
      idempotencyKey: 'contact-ops-parent-reset-exact-0001',
      now,
    });
    const replay = await requestParentResetForHousehold({
      pool,
      config,
      actor: { userKey: ownerUserKey, role: 'owner' },
      householdKey: enrolled.household_key,
      idempotencyKey: 'contact-ops-parent-reset-exact-0001',
      now: new Date('2026-07-24T08:01:00.000Z'),
    });
    expect(first).toEqual({ request_accepted: true, password_exposed: false });
    expect(replay).toEqual(first);

    const resetRows = await pool.query(
      `SELECT count(*)::int AS count
         FROM onetime.account_lifecycle_tokens
        WHERE token_type = 'password_reset'`,
    );
    expect(Number(resetRows.rows[0]?.count)).toBe(1);
  });

  it('rejects mismatched and cross-scope guardian recovery without issuing a reset', async () => {
    const enrolled = await enroll();
    const guardianUserKey = await activateAdultGuardian(enrolled);
    const otherParentKey = await createAccountUser({
      pool,
      config,
      email: 'other.parent@example.test',
      password: 'OtherParent!234',
      displayName: 'Other Parent',
      role: 'parent',
    });
    await pool.query(
      `INSERT INTO onetime.portal_households
         (household_key, account_key, product_key, display_name)
       VALUES ('household_cross_scope_guardian',$1,$2,'Cross Scope Guardian Family')`,
      [config.accountKey, config.productKey],
    );
    await pool.query(
      `INSERT INTO onetime.portal_guardian_relationships
         (relationship_key, account_key, product_key, household_key, guardian_user_ref,
          relationship_label, authority)
       VALUES ('relationship_cross_scope_guardian',$1,$2,'household_cross_scope_guardian',$3,
          'Parent','primary_guardian')`,
      [config.accountKey, config.productKey, guardianUserKey],
    );

    await pool.query(
      `UPDATE onetime.portal_guardian_relationships
          SET guardian_user_ref = $1
        WHERE relationship_key = $2`,
      [otherParentKey, enrolled.relationship_key],
    );
    await expectParentResetConflict(enrolled.household_key, 'guardian-mismatch');

    await pool.query(
      `UPDATE onetime.portal_guardian_relationships
          SET guardian_user_ref = $1
        WHERE relationship_key = $2`,
      [guardianUserKey, enrolled.relationship_key],
    );
    await pool.query(
      `UPDATE onetime.contacts
          SET email_normalized = 'mismatched.parent@example.test'
        WHERE contact_key = $1`,
      [enrolled.contact_key],
    );
    await expectParentResetConflict(enrolled.household_key, 'email-mismatch');

    const crossConfig = loadConfig({
      NODE_ENV: 'test',
      PUBLIC_BASE_URL: 'https://join.onetimeonetime.com',
      ONE_TIME_ACCOUNT_KEY: 'other_contact_operations_account',
      ONE_TIME_PRODUCT_KEY: config.productKey,
      HIGHLEVEL_EVENT_SYNC_MODE: 'mock',
    });
    const crossAccountParentKey = await createAccountUser({
      pool,
      config: crossConfig,
      email: 'mismatched.parent@example.test',
      password: 'CrossAccountParent!234',
      displayName: 'Cross Account Parent',
      role: 'parent',
    });
    await pool.query(
      `UPDATE onetime.adult_household_contact_links
          SET guardian_user_ref = $1
        WHERE household_key = $2`,
      [crossAccountParentKey, enrolled.household_key],
    );
    await pool.query(
      `UPDATE onetime.portal_guardian_relationships
          SET guardian_user_ref = $1
        WHERE relationship_key = $2`,
      [crossAccountParentKey, enrolled.relationship_key],
    );
    await expectParentResetConflict(enrolled.household_key, 'cross-account');

    const resets = await pool.query(
      `SELECT count(*)::int AS count
         FROM onetime.account_lifecycle_tokens
        WHERE token_type = 'password_reset'`,
    );
    expect(Number(resets.rows[0]?.count)).toBe(0);
  });
});

function enroll() {
  return enrollParentHousehold({
    pool,
    config,
    actor: { userKey: ownerUserKey, role: 'owner' },
    payload: enrollmentPayload,
    now,
  });
}

function access(householdKey: string) {
  return readHouseholdAccess({
    db: pool,
    accountKey: config.accountKey,
    productKey: config.productKey,
    householdKey,
    now: new Date('2026-07-24T08:04:00.000Z'),
  });
}

async function activateAdultGuardian(enrolled: Awaited<ReturnType<typeof enroll>>) {
  const guardianUserKey = await createAccountUser({
    pool,
    config,
    email: enrollmentPayload.adult.email,
    password: 'OperationsParent!234',
    displayName: enrollmentPayload.adult.display_name,
    role: 'parent',
  });
  await pool.query(
    `UPDATE onetime.portal_guardian_relationships
        SET guardian_user_ref = $1
      WHERE relationship_key = $2`,
    [guardianUserKey, enrolled.relationship_key],
  );
  await pool.query(
    `UPDATE onetime.adult_household_contact_links
        SET guardian_user_ref = $1
      WHERE household_key = $2`,
    [guardianUserKey, enrolled.household_key],
  );
  return guardianUserKey;
}

async function expectParentResetConflict(householdKey: string, suffix: string) {
  await expect(
    requestParentResetForHousehold({
      pool,
      config,
      actor: { userKey: ownerUserKey, role: 'owner' },
      householdKey,
      idempotencyKey: `contact-ops-parent-reset-${suffix}`,
      now,
    }),
  ).rejects.toMatchObject({ code: 'IDENTITY_CONFLICT' });
}
