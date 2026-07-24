import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { loadConfig, type AppConfig } from '../../../packages/config/src/index.ts';
import {
  HIGHLEVEL_CONTRACT_VERSION,
  highLevelInboundActionSchema,
} from '../../../packages/contracts/src/highlevel/index.ts';
import { createMemoryPool, runMigrations, type DbPool } from '../../../packages/db/src/index.ts';
import {
  createAccountUser,
  createSession,
  getSessionUserByKey,
} from '../../../packages/domain/src/auth/service.ts';
import {
  handleHighLevelAction,
  signHighLevelActionRequest,
} from '../../../packages/domain/src/highlevel/actions.ts';
import { applyHouseholdAccessState } from '../../../packages/domain/src/access/service.ts';
import { captureLead } from '../../../packages/domain/src/lead/service.ts';

const now = new Date('2026-07-23T10:00:00.000Z');
const contactEmail = 'access.parent@example.test';
const botActionSecret = 'test-only-highlevel-bot-secret-0001';
const accessActionSecret = 'test-only-highlevel-access-secret-0001';
const botActionKeyId = 'test-highlevel-bot-key';
const accessActionKeyId = 'test-highlevel-access-key';

let pool: DbPool;
let config: AppConfig;
let nonceSequence = 0;

beforeEach(async () => {
  config = loadConfig({
    NODE_ENV: 'test',
    PUBLIC_BASE_URL: 'https://join.onetimeonetime.com',
    HIGHLEVEL_ACTIONS_MODE: 'enabled',
    HIGHLEVEL_ACTION_KEY_ID: botActionKeyId,
    HIGHLEVEL_ACTION_SECRET: botActionSecret,
    HIGHLEVEL_ACCESS_ACTION_KEY_ID: accessActionKeyId,
    HIGHLEVEL_ACCESS_ACTION_SECRET: accessActionSecret,
    HIGHLEVEL_ACTION_RATE_LIMIT_MAX: '50',
  });
  pool = createMemoryPool();
  await runMigrations(pool);
  nonceSequence = 0;
});

afterEach(async () => {
  await pool.end();
});

describe('HighLevel current-access action', () => {
  it.each([
    ['key ID', botActionKeyId, 'test-only-distinct-access-secret-0001'],
    ['secret', 'test-highlevel-distinct-access-key', botActionSecret],
  ])('rejects an access credential that shares the bot %s', (_label, keyId, secret) => {
    expect(() =>
      loadConfig({
        NODE_ENV: 'test',
        PUBLIC_BASE_URL: 'https://join.onetimeonetime.com',
        HIGHLEVEL_ACTIONS_MODE: 'enabled',
        HIGHLEVEL_ACTION_KEY_ID: botActionKeyId,
        HIGHLEVEL_ACTION_SECRET: botActionSecret,
        HIGHLEVEL_ACCESS_ACTION_KEY_ID: keyId,
        HIGHLEVEL_ACCESS_ACTION_SECRET: secret,
      }),
    ).toThrow(/cryptographically separate/u);
  });

  it('requires the dedicated actor and rejects payment data at the contract boundary', async () => {
    const valid = accessPayload('contact_access_contract', 'household_access_contract', 1);
    expect(highLevelInboundActionSchema.safeParse(valid).success).toBe(true);
    expect(
      highLevelInboundActionSchema.safeParse({
        ...valid,
        actor: { kind: 'highlevel_bot', bot_key: 'OT-A1' },
      }).success,
    ).toBe(false);
    const withPaymentData = {
      ...valid,
      data: { ...valid.data, amount: 6700 },
    };
    expect(highLevelInboundActionSchema.safeParse(withPaymentData).success).toBe(false);
    await expect(invoke(withPaymentData)).resolves.toMatchObject({
      status: 400,
      body: { ok: false, code: 'HIGHLEVEL_CONTACT_INELIGIBLE', retryable: false },
    });
    const receipts = await pool.query(
      `SELECT count(*)::int AS count FROM onetime.highlevel_action_receipts`,
    );
    expect(Number(receipts.rows[0]?.count ?? 0)).toBe(0);
  });

  it('cryptographically denies OT-A1 bot credentials that self-declare the access actor', async () => {
    const contactKey = await seedAdultContact();
    await seedExactParentHousehold('household_access_primary');
    const payload = accessPayload(contactKey, 'household_access_primary', 1);

    const denied = await invoke(payload, {
      keyId: botActionKeyId,
      secret: botActionSecret,
    });
    expect(denied).toMatchObject({
      status: 401,
      body: { ok: false, code: 'HIGHLEVEL_ACTION_AUTH_FAILED', retryable: false },
    });
    const state = await pool.query(
      `SELECT
         (SELECT count(*)::int FROM onetime.highlevel_action_nonces) AS nonces,
         (SELECT count(*)::int FROM onetime.highlevel_action_receipts) AS receipts,
         (SELECT count(*)::int FROM onetime.account_access_projections) AS projections`,
    );
    expect({
      nonces: scalarCount(state.rows[0]?.nonces),
      receipts: scalarCount(state.rows[0]?.receipts),
      projections: scalarCount(state.rows[0]?.projections),
    }).toEqual({ nonces: 0, receipts: 0, projections: 0 });
  });

  it('applies and replays exact current access without consulting consent or writing payment history', async () => {
    const contactKey = await seedAdultContact();
    await seedExactParentHousehold('household_access_primary');
    await pool.query(
      `UPDATE onetime.contacts
          SET suppression_state = 'suppressed', consent_recorded_at = NULL
        WHERE account_key = $1 AND product_key = $2 AND contact_key = $3`,
      [config.accountKey, config.productKey, contactKey],
    );
    const payload = accessPayload(contactKey, 'household_access_primary', 1);

    const applied = await invoke(payload);
    const replayed = await invoke(payload);

    expect(applied).toMatchObject({
      status: 200,
      body: {
        ok: true,
        action_name: 'access.apply_current_state',
        replayed: false,
        protected_reference: null,
        result: {
          access_state: 'active',
          application_state: 'applied',
          payment_history_written: false,
        },
      },
    });
    expect(replayed).toMatchObject({ status: 200, body: { ok: true, replayed: true } });
    const projection = await pool.query(
      `SELECT household_key, state, source_kind, source_revision
         FROM onetime.account_access_projections
        WHERE account_key = $1 AND product_key = $2`,
      [config.accountKey, config.productKey],
    );
    expect(projection.rows).toEqual([
      expect.objectContaining({
        household_key: 'household_access_primary',
        state: 'active',
        source_kind: 'highlevel_payment_state',
        source_revision: 1,
      }),
    ]);
    const legacyBilling = await pool.query(
      `SELECT count(*)::int AS count FROM onetime.billing_entitlement_projections`,
    );
    expect(Number(legacyBilling.rows[0]?.count ?? 0)).toBe(0);
    expect(JSON.stringify([applied.body, replayed.body])).not.toMatch(
      /access\.parent|household_access_primary|provider-state-reference|amount|invoice|card|subscription/i,
    );
  });

  it('fails closed for missing and mismatched durable adult-household identity', async () => {
    const contactKey = await seedAdultContact();
    const missing = await invoke(
      accessPayload(contactKey, 'household_access_missing', 1, 'access-missing-0001'),
    );
    expect(missing).toMatchObject({
      status: 404,
      body: { ok: false, code: 'HIGHLEVEL_ACCESS_IDENTITY_NOT_FOUND' },
    });

    await seedExactParentHousehold('household_access_primary');
    const mismatch = await invoke(
      accessPayload(contactKey, 'household_access_other', 2, 'access-mismatch-0001'),
    );
    expect(mismatch).toMatchObject({
      status: 409,
      body: { ok: false, code: 'HIGHLEVEL_ACCESS_IDENTITY_MISMATCH' },
    });

    const projection = await pool.query(
      `SELECT count(*)::int AS count FROM onetime.account_access_projections`,
    );
    expect(Number(projection.rows[0]?.count ?? 0)).toBe(0);
  });

  it('accepts the exact durable adult link before Parent activation exists', async () => {
    const contactKey = await seedAdultContact();
    await pool.query(
      `INSERT INTO onetime.portal_households
         (household_key, account_key, product_key, display_name)
       VALUES ('household_access_unactivated',$1,$2,'Unactivated Parent Household')`,
      [config.accountKey, config.productKey],
    );
    await pool.query(
      `INSERT INTO onetime.adult_household_contact_links
         (link_key, account_key, product_key, contact_key, household_key,
          highlevel_location_id, sync_state)
       VALUES ('adult_link_unactivated',$1,$2,$3,'household_access_unactivated',$4,'sync_pending')`,
      [config.accountKey, config.productKey, contactKey, config.highLevelLocationId],
    );

    await expect(
      invoke(
        accessPayload(contactKey, 'household_access_unactivated', 1, 'access-unactivated-0001'),
      ),
    ).resolves.toMatchObject({
      status: 200,
      body: {
        ok: true,
        result: { access_state: 'active', payment_history_written: false },
      },
    });

    const parentState = await pool.query(
      `SELECT
         (SELECT count(*)::int FROM onetime.account_users WHERE role = 'parent') AS parents,
         (SELECT count(*)::int FROM onetime.portal_guardian_relationships) AS relationships`,
    );
    expect({
      parents: scalarCount(parentState.rows[0]?.parents),
      relationships: scalarCount(parentState.rows[0]?.relationships),
    }).toEqual({ parents: 0, relationships: 0 });
  });

  it('denies a missing durable link and an archived linked household before access mutation', async () => {
    const contactKey = await seedAdultContact();
    await seedExactParentHousehold('household_access_primary', 'support_only');

    await expect(
      invoke(accessPayload(contactKey, 'household_access_primary', 1, 'access-support-only-0001')),
    ).resolves.toMatchObject({
      status: 404,
      body: { ok: false, code: 'HIGHLEVEL_ACCESS_IDENTITY_NOT_FOUND' },
    });

    await pool.query(
      `UPDATE onetime.portal_guardian_relationships
          SET authority = 'primary_guardian'
        WHERE account_key = $1
          AND product_key = $2
          AND household_key = 'household_access_primary'`,
      [config.accountKey, config.productKey],
    );
    const parent = await pool.query(
      `SELECT user_key
         FROM onetime.account_users
        WHERE account_key = $1 AND product_key = $2 AND email_normalized = $3`,
      [config.accountKey, config.productKey, contactEmail],
    );
    await pool.query(
      `INSERT INTO onetime.adult_household_contact_links
         (link_key, account_key, product_key, contact_key, household_key,
          guardian_user_ref, highlevel_location_id, sync_state)
       VALUES ('adult_link_archived',$1,$2,$3,'household_access_primary',$4,$5,'sync_pending')`,
      [
        config.accountKey,
        config.productKey,
        contactKey,
        String(parent.rows[0]?.user_key),
        config.highLevelLocationId,
      ],
    );
    await pool.query(
      `UPDATE onetime.portal_households
          SET status = 'archived'
        WHERE account_key = $1
          AND product_key = $2
          AND household_key = 'household_access_primary'`,
      [config.accountKey, config.productKey],
    );
    await expect(
      invoke(accessPayload(contactKey, 'household_access_primary', 2, 'access-archived-0001')),
    ).resolves.toMatchObject({
      status: 404,
      body: { ok: false, code: 'HIGHLEVEL_ACCESS_IDENTITY_NOT_FOUND' },
    });

    const projection = await pool.query(
      `SELECT count(*)::int AS count FROM onetime.account_access_projections`,
    );
    expect(Number(projection.rows[0]?.count ?? 0)).toBe(0);
  });

  it('returns stable sanitized blockers for stale and conflicting source updates', async () => {
    const contactKey = await seedAdultContact();
    await seedExactParentHousehold('household_access_primary');
    await expect(
      invoke(accessPayload(contactKey, 'household_access_primary', 2, 'access-base-0001')),
    ).resolves.toMatchObject({ status: 200, body: { ok: true } });

    const stalePayload = accessPayload(
      contactKey,
      'household_access_primary',
      1,
      'access-stale-0001',
    );
    const stale = await invoke({
      ...stalePayload,
      data: {
        ...stalePayload.data,
        source_updated_at: new Date(now.getTime() - 60_000).toISOString(),
      },
    });
    expect(stale).toMatchObject({
      status: 409,
      body: { ok: false, code: 'HIGHLEVEL_ACCESS_STATE_STALE', retryable: false },
    });

    const conflictPayload = accessPayload(
      contactKey,
      'household_access_primary',
      2,
      'access-conflict-0001',
    );
    const conflict = await invoke({
      ...conflictPayload,
      data: {
        ...conflictPayload.data,
        state: 'revoked',
        revocation_reason: 'provider_state_revoked',
      },
    });
    expect(conflict).toMatchObject({
      status: 409,
      body: { ok: false, code: 'HIGHLEVEL_ACCESS_STATE_CONFLICT', retryable: false },
    });
    expect(JSON.stringify([stale.body, conflict.body])).not.toMatch(
      /access\.parent|household_access_primary|provider-state-reference/i,
    );
  });

  it('keeps paid and complimentary sources independent instead of using precedence', async () => {
    const contactKey = await seedAdultContact();
    await seedExactParentHousehold('household_access_primary');
    const payload = accessPayload(
      contactKey,
      'household_access_primary',
      1,
      'access-precedence-highlevel-0001',
    );
    await applyHouseholdAccessState({
      pool,
      accountKey: config.accountKey,
      productKey: config.productKey,
      sourceKind: 'admin_override',
      actorKind: 'admin',
      idempotencyKey: 'access-precedence-admin-0001',
      command: {
        ...payload.data,
        opaque_source_reference: 'admin-access-reference-0001',
      },
      now,
    });

    const applied = await invoke(payload);
    expect(applied).toMatchObject({
      status: 200,
      body: { ok: true, result: { access_state: 'active' } },
    });
    const projection = await pool.query(
      `SELECT source_kind, opaque_source_reference
         FROM onetime.account_access_projections
        WHERE account_key = $1 AND product_key = $2 AND household_key = $3`,
      [config.accountKey, config.productKey, 'household_access_primary'],
    );
    expect(projection.rows[0]).toMatchObject({
      source_kind: 'highlevel_payment_state',
      opaque_source_reference: payload.data.opaque_source_reference,
    });
  });

  it('applies active, grace, and revoked paid transitions and revokes only Student sessions', async () => {
    const contactKey = await seedAdultContact();
    const parentUserKey = await seedExactParentHousehold('household_access_primary');
    const studentUserKey = await createAccountUser({
      pool,
      config,
      email: 'access.action.student@example.test',
      password: 'AccessActionStudent!234',
      displayName: 'Access Action Student',
      role: 'student',
      mfaCapable: false,
    });
    await pool.query(
      `INSERT INTO onetime.portal_learners
         (learner_key, account_key, product_key, household_key, display_name)
       VALUES ('access_action_learner',$1,$2,'household_access_primary','Access Student')`,
      [config.accountKey, config.productKey],
    );
    await pool.query(
      `INSERT INTO onetime.portal_student_access_state
         (access_state_key, account_key, product_key, household_key, learner_key,
          student_user_ref, status, credential_status)
       VALUES ('access_action_student_state',$1,$2,'household_access_primary',
          'access_action_learner',$3,'active','parent_managed')`,
      [config.accountKey, config.productKey, studentUserKey],
    );

    await expect(
      invoke(accessPayload(contactKey, 'household_access_primary', 1, 'access-active-0001')),
    ).resolves.toMatchObject({
      status: 200,
      body: { ok: true, result: { access_state: 'active', sessions_revoked: 0 } },
    });
    const parentSession = await sessionForUser(parentUserKey);
    const studentSession = await sessionForUser(studentUserKey);

    const gracePayload = accessPayload(
      contactKey,
      'household_access_primary',
      2,
      'access-grace-0001',
    );
    await expect(
      invoke({
        ...gracePayload,
        data: {
          ...gracePayload.data,
          state: 'grace',
          expires_at: '2026-08-23T10:00:00.000Z',
        },
      }),
    ).resolves.toMatchObject({
      status: 200,
      body: { ok: true, result: { access_state: 'grace', sessions_revoked: 0 } },
    });

    const revokedPayload = accessPayload(
      contactKey,
      'household_access_primary',
      3,
      'access-revoked-0001',
    );
    await expect(
      invoke({
        ...revokedPayload,
        data: {
          ...revokedPayload.data,
          state: 'revoked',
          revocation_reason: 'provider_state_revoked',
        },
      }),
    ).resolves.toMatchObject({
      status: 200,
      body: {
        ok: true,
        result: {
          access_state: 'paused',
          sessions_revoked: 1,
          payment_history_written: false,
        },
      },
    });
    const sessions = await pool.query(
      `SELECT session_key, revoked_at
         FROM onetime.user_sessions
        WHERE session_key IN ($1,$2)
        ORDER BY session_key`,
      [parentSession.session_key, studentSession.session_key],
    );
    expect(sessions.rows).toHaveLength(2);
    expect(
      sessions.rows.find((row) => row.session_key === parentSession.session_key)?.revoked_at,
    ).toBeFalsy();
    expect(
      sessions.rows.find((row) => row.session_key === studentSession.session_key)?.revoked_at,
    ).toBeTruthy();
  });
});

async function seedAdultContact() {
  const lead = await captureLead({
    pool,
    config,
    now,
    payload: {
      contact_name: 'Access Parent',
      family_or_school: 'Access Family',
      audience_type: 'family',
      location: 'Jerusalem',
      timezone: 'Asia/Jerusalem',
      email: contactEmail,
      phone: '',
      reminder_preference: 'email',
      reminder_consent: true,
      consent_context: {
        policy_version: 'communications-2026-07-23.1',
        purpose: 'optional_class_reminders',
        source: 'public_signup',
        channels: ['email'],
        captured_at: now.toISOString(),
        withdrawal_state: 'not_withdrawn',
        suppression_state: 'active',
      },
      idempotency_key: 'access-parent-lead-0001',
      attribution: { landing_path: '/signup' },
    },
  });
  return lead.contact_key;
}

async function seedExactParentHousehold(
  householdKey: string,
  authority: 'primary_guardian' | 'guardian' | 'support_only' = 'primary_guardian',
) {
  const parentUserKey = await createAccountUser({
    pool,
    config,
    email: contactEmail,
    password: 'AccessParentPass!234',
    displayName: 'Access Parent',
    role: 'parent',
    mfaCapable: false,
  });
  await seedHouseholdRelationship(householdKey, parentUserKey, authority);
  if (authority !== 'support_only') {
    const contact = await pool.query(
      `SELECT contact_key
         FROM onetime.contacts
        WHERE account_key = $1 AND product_key = $2 AND email_normalized = $3`,
      [config.accountKey, config.productKey, contactEmail],
    );
    await pool.query(
      `INSERT INTO onetime.adult_household_contact_links
         (link_key, account_key, product_key, contact_key, household_key,
          guardian_user_ref, highlevel_location_id, sync_state)
       VALUES ($1,$2,$3,$4,$5,$6,$7,'sync_pending')`,
      [
        `adult_link_${householdKey}`,
        config.accountKey,
        config.productKey,
        String(contact.rows[0]?.contact_key),
        householdKey,
        parentUserKey,
        config.highLevelLocationId,
      ],
    );
  }
  return parentUserKey;
}

async function seedHouseholdRelationship(
  householdKey: string,
  parentUserKey?: string,
  authority: 'primary_guardian' | 'guardian' | 'support_only' = 'primary_guardian',
) {
  const resolvedParentUserKey =
    parentUserKey ??
    String(
      (
        await pool.query(
          `SELECT user_key FROM onetime.account_users
            WHERE account_key = $1 AND product_key = $2
              AND email_normalized = $3 AND role = 'parent' AND status = 'active'`,
          [config.accountKey, config.productKey, contactEmail],
        )
      ).rows[0]?.user_key,
    );
  await pool.query(
    `INSERT INTO onetime.portal_households
       (household_key, account_key, product_key, display_name)
     VALUES ($1, $2, $3, 'Access Household')`,
    [householdKey, config.accountKey, config.productKey],
  );
  await pool.query(
    `INSERT INTO onetime.portal_guardian_relationships
       (relationship_key, account_key, product_key, household_key, guardian_user_ref,
        relationship_label, authority, status)
     VALUES ($1, $2, $3, $4, $5, 'Parent', $6, 'active')`,
    [
      `relationship_${householdKey}`,
      config.accountKey,
      config.productKey,
      householdKey,
      resolvedParentUserKey,
      authority,
    ],
  );
}

function accessPayload(
  contactKey: string,
  householdKey: string,
  revision: number,
  idempotencyKey = 'access-current-state-0001',
) {
  return {
    contract_version: HIGHLEVEL_CONTRACT_VERSION,
    action_name: 'access.apply_current_state' as const,
    request_id: `request-${idempotencyKey}`,
    idempotency_key: idempotencyKey,
    requested_at: now.toISOString(),
    actor: { kind: 'highlevel_system' as const, integration_key: 'OT-ACCESS' as const },
    scope: {
      account_key: config.accountKey,
      product_key: config.productKey,
      location_id: config.highLevelLocationId,
    },
    adult_contact: { contact_key: contactKey, adult_only: true as const },
    data: {
      household_key: householdKey,
      state: 'active' as const,
      effective_at: now.toISOString(),
      expires_at: null,
      opaque_source_reference: 'provider-state-reference-0001',
      source_revision: revision,
      source_updated_at: now.toISOString(),
      policy_version: 'access-current-state-2026-07-23.1',
      revocation_reason: null,
    },
  };
}

async function invoke(
  payload: unknown,
  credential: { keyId: string; secret: string } = {
    keyId: accessActionKeyId,
    secret: accessActionSecret,
  },
) {
  const rawBody = Buffer.from(JSON.stringify(payload));
  const timestamp = String(Math.floor(now.getTime() / 1000));
  const nonce = `highlevel-access-nonce-${String(++nonceSequence).padStart(6, '0')}`;
  const keyId = credential.keyId;
  const idempotencyKey = String((payload as { idempotency_key?: unknown }).idempotency_key ?? '');
  return handleHighLevelAction({
    pool,
    config,
    now,
    headers: {
      keyId,
      timestamp,
      nonce,
      idempotencyKey,
      signature: signHighLevelActionRequest({
        secret: credential.secret,
        keyId,
        timestamp,
        nonce,
        idempotencyKey,
        rawBody,
      }),
    },
    rawBody,
  });
}

async function sessionForUser(userKey: string) {
  const user = await getSessionUserByKey({ pool, config, userKey });
  if (!user) throw new Error(`Missing test user ${userKey}.`);
  return createSession({ pool, config, user, assuranceMethod: 'password' });
}

function scalarCount(value: unknown) {
  return Number(Array.isArray(value) ? value[0] : (value ?? 0));
}
