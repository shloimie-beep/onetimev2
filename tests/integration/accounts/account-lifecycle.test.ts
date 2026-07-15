import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { loadConfig, type AppConfig } from '../../../packages/config/src/index.ts';
import { createMemoryPool, runMigrations, type DbPool } from '../../../packages/db/src/index.ts';
import {
  acceptOwnerAdminInvitation,
  acceptParentActivation,
  acceptStudentSetup,
  authenticateUser,
  completePasswordReset,
  completeStudentReset,
  createAccountUser,
  createOwnerAdminInvitation,
  createParentActivation,
  createSession,
  createStudentReset,
  createStudentSetup,
  getSessionByToken,
  requestPasswordReset,
  restoreStudentIdentity,
  revokeStudentIdentitySessions,
  suspendStudentIdentity,
} from '../../../packages/domain/src/index.ts';

let pool: DbPool;
let config: AppConfig;
let ownerUserKey: string;

const ownerActor = () => ({ userKey: ownerUserKey, role: 'owner' });
const householdKey = 'household_alpha';
const learnerKey = 'learner_alpha';

beforeEach(async () => {
  config = loadConfig({
    NODE_ENV: 'test',
    PUBLIC_BASE_URL: 'https://join.onetimeonetime.com',
    APP_VERSION: 'test',
    COMMIT_SHA: 'test',
    OUTBOX_TRANSPORT_MODE: 'sink',
  });
  pool = createMemoryPool();
  await runMigrations(pool);
  ownerUserKey = await createAccountUser({
    pool,
    config,
    email: 'owner@example.test',
    password: 'OwnerPass!234',
    displayName: 'Owner User',
    role: 'owner',
    mfaCapable: true,
  });
  await seedPortalRecords();
});

afterEach(async () => {
  await pool.end();
});

describe('OT-71 account lifecycle', () => {
  it('issues and accepts owner/admin invitations without persisting raw token material', async () => {
    const issued = await createOwnerAdminInvitation({
      pool,
      config,
      actor: ownerActor(),
      includeLocalProofToken: true,
      payload: {
        idempotency_key: 'invite-admin-001',
        email: 'admin.invited@example.test',
        display_name: 'Invited Admin',
        role: 'admin',
      },
      now: new Date('2026-07-15T10:00:00.000Z'),
    });
    const token = issued.token_for_local_proof;
    if (!token) throw new Error('Expected local proof token.');

    expect(issued).toMatchObject({
      token_type: 'owner_admin_invitation',
      target_role: 'admin',
      raw_token_included: false,
      delivery: {
        delivery_state: 'sink_queued',
        external_send_performed: false,
        raw_token_included: false,
      },
    });
    expect(await serializedLifecycleRows()).not.toContain(token);

    const replay = await createOwnerAdminInvitation({
      pool,
      config,
      actor: ownerActor(),
      includeLocalProofToken: true,
      payload: {
        idempotency_key: 'invite-admin-001',
        email: 'admin.invited@example.test',
        display_name: 'Invited Admin',
        role: 'admin',
      },
    });
    expect(replay.token_key).toBe(issued.token_key);
    expect(replay.token_for_local_proof).toBeUndefined();

    await expect(
      createOwnerAdminInvitation({
        pool,
        config,
        actor: ownerActor(),
        payload: {
          idempotency_key: 'invite-admin-001',
          email: 'changed@example.test',
          display_name: 'Changed Admin',
          role: 'admin',
        },
      }),
    ).rejects.toMatchObject({ code: 'IDEMPOTENCY_CONFLICT' });

    const accepted = await acceptOwnerAdminInvitation({
      pool,
      config,
      payload: { token, password: 'AdminPass!234' },
      now: new Date('2026-07-15T10:05:00.000Z'),
    });
    expect(accepted).toMatchObject({ role: 'admin', status: 'active', mfa_required: true });

    const passwordOnly = await authenticateUser({
      pool,
      config,
      email: 'admin.invited@example.test',
      password: 'AdminPass!234',
    });
    expect(passwordOnly).toMatchObject({ ok: false, code: 'MFA_REQUIRED' });
    await expect(
      acceptOwnerAdminInvitation({
        pool,
        config,
        payload: { token, password: 'AnotherPass!234' },
      }),
    ).rejects.toMatchObject({ code: 'TOKEN_CONSUMED' });
  });

  it('activates parent identity and manages student setup, reset, suspend, and restore', async () => {
    const parentIssue = await createParentActivation({
      pool,
      config,
      actor: ownerActor(),
      includeLocalProofToken: true,
      payload: {
        idempotency_key: 'parent-activation-001',
        email: 'parent@example.test',
        display_name: 'Parent User',
        household_key: householdKey,
        relationship_key: 'relationship_alpha',
        relationship_label: 'Parent',
        authority: 'primary_guardian',
      },
    });
    const parentToken = requiredProof(parentIssue);
    const parent = await acceptParentActivation({
      pool,
      config,
      payload: { token: parentToken, password: 'ParentPass!234' },
    });
    expect(parent).toMatchObject({ role: 'parent', status: 'active', mfa_required: false });

    const relationship = await pool.query(
      `SELECT guardian_user_ref
         FROM onetime.portal_guardian_relationships
        WHERE relationship_key = 'relationship_alpha'`,
    );
    expect(relationship.rows[0].guardian_user_ref).toBe(parent.user_key);

    const parentActor = { userKey: parent.user_key, role: 'parent' };
    const studentIssue = await createStudentSetup({
      pool,
      config,
      actor: parentActor,
      includeLocalProofToken: true,
      payload: {
        idempotency_key: 'student-setup-001',
        email: 'student@example.test',
        display_name: 'Student User',
        household_key: householdKey,
        learner_key: learnerKey,
      },
    });
    const student = await acceptStudentSetup({
      pool,
      config,
      payload: { token: requiredProof(studentIssue), password: 'StudentPass!234' },
    });
    expect(student).toMatchObject({ role: 'student', status: 'active', mfa_required: false });

    const login = await authenticateUser({
      pool,
      config,
      email: 'student@example.test',
      password: 'StudentPass!234',
    });
    if (!login.ok) throw new Error(`Expected student login, got ${login.code}`);
    const session = await createSession({ pool, config, user: login.user });
    expect(await getSessionByToken({ pool, config, sessionToken: session.session_token })).not.toBe(
      null,
    );

    const suspended = await suspendStudentIdentity({
      pool,
      config,
      actor: parentActor,
      learnerKey,
    });
    expect(suspended).toMatchObject({ access_status: 'suspended', sessions_invalidated: 1 });
    expect(
      await getSessionByToken({ pool, config, sessionToken: session.session_token }),
    ).toBeNull();

    const restored = await restoreStudentIdentity({
      pool,
      config,
      actor: parentActor,
      learnerKey,
    });
    expect(restored).toMatchObject({ access_status: 'active' });

    const postRestoreLogin = await authenticateUser({
      pool,
      config,
      email: 'student@example.test',
      password: 'StudentPass!234',
    });
    if (!postRestoreLogin.ok)
      throw new Error(`Expected student login, got ${postRestoreLogin.code}`);
    const postRestoreSession = await createSession({ pool, config, user: postRestoreLogin.user });
    const revoked = await revokeStudentIdentitySessions({
      pool,
      config,
      actor: parentActor,
      learnerKey,
    });
    expect(revoked).toMatchObject({ access_status: 'active', sessions_invalidated: 1 });
    expect(
      await getSessionByToken({ pool, config, sessionToken: postRestoreSession.session_token }),
    ).toBeNull();

    const resetIssue = await createStudentReset({
      pool,
      config,
      actor: parentActor,
      includeLocalProofToken: true,
      payload: {
        idempotency_key: 'student-reset-001',
        learner_key: learnerKey,
      },
    });
    const reset = await completeStudentReset({
      pool,
      config,
      payload: { token: requiredProof(resetIssue), password: 'StudentPass!999' },
    });
    expect(reset.sessions_invalidated).toBe(0);
    const oldPassword = await authenticateUser({
      pool,
      config,
      email: 'student@example.test',
      password: 'StudentPass!234',
    });
    expect(oldPassword).toMatchObject({ ok: false, code: 'INVALID_CREDENTIALS' });
    const newPassword = await authenticateUser({
      pool,
      config,
      email: 'student@example.test',
      password: 'StudentPass!999',
    });
    expect(newPassword).toMatchObject({ ok: true });
    expect(await serializedLifecycleRows()).not.toMatch(/StudentPass|ParentPass|token_for_local/i);
  });

  it('completes password reset with single-use tokens and session-family invalidation', async () => {
    const parent = await createParentWithPassword('parent-reset@example.test', 'ParentPass!234');
    const login = await authenticateUser({
      pool,
      config,
      email: 'parent-reset@example.test',
      password: 'ParentPass!234',
    });
    if (!login.ok) throw new Error(`Expected parent login, got ${login.code}`);
    const session = await createSession({ pool, config, user: login.user });

    const resetIssue = await requestPasswordReset({
      pool,
      config,
      includeLocalProofToken: true,
      payload: {
        idempotency_key: 'password-reset-001',
        email: 'parent-reset@example.test',
      },
    });
    if (!('token_for_local_proof' in resetIssue) || !resetIssue.token_for_local_proof) {
      throw new Error('Expected password reset local proof token.');
    }
    expect(resetIssue.raw_token_included).toBe(false);

    const completed = await completePasswordReset({
      pool,
      config,
      payload: { token: resetIssue.token_for_local_proof, password: 'ParentPass!999' },
    });
    expect(completed).toMatchObject({
      user_key: parent.user_key,
      role: 'parent',
      sessions_invalidated: 1,
    });
    expect(
      await getSessionByToken({ pool, config, sessionToken: session.session_token }),
    ).toBeNull();
    await expect(
      completePasswordReset({
        pool,
        config,
        payload: { token: resetIssue.token_for_local_proof, password: 'ParentPass!000' },
      }),
    ).rejects.toMatchObject({ code: 'TOKEN_CONSUMED' });
  });
});

async function seedPortalRecords() {
  await pool.query(
    `INSERT INTO onetime.portal_households
       (household_key, account_key, product_key, display_name)
     VALUES ($1, $2, $3, 'Alpha Family')`,
    [householdKey, config.accountKey, config.productKey],
  );
  await pool.query(
    `INSERT INTO onetime.portal_learners
       (learner_key, account_key, product_key, household_key, display_name)
     VALUES ($1, $2, $3, $4, 'Alpha Student')`,
    [learnerKey, config.accountKey, config.productKey, householdKey],
  );
  await pool.query(
    `INSERT INTO onetime.portal_student_access_state
       (access_state_key, account_key, product_key, household_key, learner_key, status)
     VALUES ('access_alpha', $1, $2, $3, $4, 'not_configured')`,
    [config.accountKey, config.productKey, householdKey, learnerKey],
  );
}

async function createParentWithPassword(email: string, password: string) {
  const issue = await createParentActivation({
    pool,
    config,
    actor: ownerActor(),
    includeLocalProofToken: true,
    payload: {
      idempotency_key: `parent-${email}`,
      email,
      display_name: 'Reset Parent',
      household_key: householdKey,
      relationship_key: `relationship_${email.replace(/[^a-z0-9]/gi, '_')}`,
      relationship_label: 'Parent',
    },
  });
  return acceptParentActivation({
    pool,
    config,
    payload: { token: requiredProof(issue), password },
  });
}

function requiredProof(issue: { token_for_local_proof?: string }) {
  if (!issue.token_for_local_proof) throw new Error('Expected local proof token.');
  return issue.token_for_local_proof;
}

async function serializedLifecycleRows() {
  const rows = await pool.query(
    `SELECT
       (SELECT json_agg(tokens) FROM onetime.account_lifecycle_tokens AS tokens) AS tokens,
       (SELECT json_agg(intents) FROM onetime.account_lifecycle_delivery_intents AS intents) AS intents,
       (SELECT json_agg(idem) FROM onetime.account_lifecycle_idempotency_records AS idem) AS idempotency`,
  );
  return JSON.stringify(rows.rows);
}
