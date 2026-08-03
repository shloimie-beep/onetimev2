import { scryptSync } from 'node:crypto';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { loadConfig, type AppConfig } from '../../../packages/config/src/index.ts';
import { createMemoryPool, runMigrations, type DbPool } from '../../../packages/db/src/index.ts';
import {
  authenticateUser,
  changeOwnPassword,
  createAccountUser,
  createSession,
  getSessionByToken,
} from '../../../packages/domain/src/auth/service.ts';
import { hasActiveSupportEntitlement } from '../../../packages/domain/src/support/service.ts';

let pool: DbPool;
let config: AppConfig;
let parentUserKey: string;
let studentUserKey: string;

const parentPassword = 'ParentPass!234';
const studentPassword = 'StudentPass!234';
const studentUsername = 'student-alpha';

beforeEach(async () => {
  config = loadConfig({
    NODE_ENV: 'test',
    PUBLIC_BASE_URL: 'https://join.onetimeonetime.com',
    APP_VERSION: 'test',
    COMMIT_SHA: 'test',
    OUTBOX_TRANSPORT_MODE: 'sink',
    ONE_TIME_ACCOUNT_KEY: 'current_access_auth_account',
    ONE_TIME_PRODUCT_KEY: 'current_access_auth_product',
  });
  pool = createMemoryPool();
  await runMigrations(pool);
  parentUserKey = await createAccountUser({
    pool,
    config,
    email: 'parent@example.test',
    password: parentPassword,
    displayName: 'Parent Example',
    role: 'parent',
  });
  studentUserKey = await createAccountUser({
    pool,
    config,
    email: 'student@example.test',
    password: studentPassword,
    displayName: 'Student Example',
    role: 'student',
  });
  await seedIdentityGraph();
});

afterEach(async () => {
  await pool.end();
});

describe('Parent and Student current-access authentication', () => {
  it('keeps Parent authentication independent while learning access is paused', async () => {
    await expect(
      hasActiveSupportEntitlement({
        target: pool,
        config,
        userKey: parentUserKey,
        role: 'parent',
      }),
    ).resolves.toBe(true);
    await expectLogin('parent@example.test', parentPassword, {
      ok: true,
      user: { role: 'parent' },
    });

    await grantCurrentAccess();
    const login = await authenticateUser({
      pool,
      config,
      identifier: 'parent@example.test',
      password: parentPassword,
    });
    expect(login).toMatchObject({ ok: true, user: { role: 'parent' } });
    if (!login.ok) throw new Error('Expected Parent login to succeed.');

    const session = await createSession({ pool, config, user: login.user });
    expect(
      await getSessionByToken({
        pool,
        config,
        sessionToken: session.session_token,
      }),
    ).not.toBeNull();

    await pool.query(
      `UPDATE onetime.account_access_projections
          SET state = 'revoked',
              revocation_reason = 'operator_revoked',
              access_version = access_version + 1,
              updated_at = now()
        WHERE account_key = $1
          AND product_key = $2
          AND household_key = 'household_alpha'`,
      [config.accountKey, config.productKey],
    );

    expect(
      await getSessionByToken({
        pool,
        config,
        sessionToken: session.session_token,
      }),
    ).not.toBeNull();
    const revoked = await pool.query(
      `SELECT revoked_at
         FROM onetime.user_sessions
        WHERE session_key = $1`,
      [session.session_key],
    );
    expect(revoked.rows[0]?.revoked_at).toBeFalsy();
    await expectLogin('parent@example.test', parentPassword, {
      ok: true,
      user: { role: 'parent' },
    });
    await expect(
      hasActiveSupportEntitlement({
        target: pool,
        config,
        userKey: parentUserKey,
        role: 'parent',
      }),
    ).resolves.toBe(true);
  });

  it('requires one coherent active Student identity and current household access for email and username login', async () => {
    await expectLogin('student@example.test', studentPassword, {
      ok: false,
      code: 'DISABLED',
    });
    await expectLogin(studentUsername, studentPassword, {
      ok: false,
      code: 'DISABLED',
    });

    await grantCurrentAccess();
    await expectLogin('student@example.test', studentPassword, {
      ok: true,
      user: { role: 'student' },
    });
    const usernameLogin = await expectLogin(studentUsername, studentPassword, {
      ok: true,
      user: { role: 'student' },
    });
    if (!usernameLogin.ok) throw new Error('Expected Student username login to succeed.');
    const studentSession = await createSession({
      pool,
      config,
      user: usernameLogin.user,
    });
    await pool.query(
      `UPDATE onetime.account_access_projections
          SET expires_at = now() - interval '1 second',
              updated_at = now()
        WHERE account_key = $1
          AND product_key = $2
          AND household_key = 'household_alpha'`,
      [config.accountKey, config.productKey],
    );
    expect(
      await getSessionByToken({
        pool,
        config,
        sessionToken: studentSession.session_token,
      }),
    ).toBeNull();
    await pool.query(
      `UPDATE onetime.account_access_projections
          SET expires_at = now() + interval '1 day',
              updated_at = now()
        WHERE account_key = $1
          AND product_key = $2
          AND household_key = 'household_alpha'`,
      [config.accountKey, config.productKey],
    );

    await pool.query(
      `INSERT INTO onetime.portal_student_access_state
         (access_state_key, account_key, product_key, household_key, learner_key,
          student_user_ref, status, normalized_username, password_hash_ref,
          credential_status)
       VALUES
         ('student_access_ambiguous',$1,$2,'household_alpha','learner_alpha',$3,
          'disabled',$4,$5,'disabled')`,
      [
        config.accountKey,
        config.productKey,
        studentUserKey,
        studentUsername,
        studentPasswordHashRef(studentPassword),
      ],
    );

    await expectLogin('student@example.test', studentPassword, {
      ok: false,
      code: 'DISABLED',
    });
    await expectLogin(studentUsername, studentPassword, {
      ok: false,
      code: 'DISABLED',
    });
  });

  it('fails closed when the Student link and learner household scopes disagree', async () => {
    await grantCurrentAccess();
    await pool.query(
      `UPDATE onetime.account_learner_identity_links
          SET household_key = 'household_beta'
        WHERE account_key = $1
          AND product_key = $2
          AND user_key = $3`,
      [config.accountKey, config.productKey, studentUserKey],
    );

    await expectLogin('student@example.test', studentPassword, {
      ok: false,
      code: 'DISABLED',
    });
    await expectLogin(studentUsername, studentPassword, {
      ok: false,
      code: 'INVALID_CREDENTIALS',
    });
  });

  it('changes Parent and Student passwords while preserving only the initiating session', async () => {
    const parentLogin = await authenticateUser({
      pool,
      config,
      identifier: 'parent@example.test',
      password: parentPassword,
    });
    if (!parentLogin.ok) throw new Error('Expected Parent login to succeed.');
    const parentSession = await createSession({ pool, config, user: parentLogin.user });
    const secondParentSession = await createSession({ pool, config, user: parentLogin.user });
    await expect(
      changeOwnPassword({
        pool,
        config,
        session: parentSession,
        currentPassword: parentPassword,
        newPassword: 'too-short',
      }),
    ).resolves.toEqual({ ok: false, code: 'PASSWORD_POLICY_FAILED' });
    const parentChanged = await changeOwnPassword({
      pool,
      config,
      session: parentSession,
      currentPassword: parentPassword,
      newPassword: 'ParentChanged!567',
    });
    expect(parentChanged).toMatchObject({ ok: true, sessions_invalidated: 1 });
    await expectLogin('parent@example.test', parentPassword, {
      ok: false,
      code: 'INVALID_CREDENTIALS',
    });
    await expectLogin('parent@example.test', 'ParentChanged!567', {
      ok: true,
      user: { role: 'parent' },
    });
    await expect(
      getSessionByToken({ pool, config, sessionToken: parentSession.session_token }),
    ).not.toBeNull();
    await expect(
      getSessionByToken({ pool, config, sessionToken: secondParentSession.session_token }),
    ).resolves.toBeNull();

    await grantCurrentAccess();
    const studentLogin = await authenticateUser({
      pool,
      config,
      identifier: studentUsername,
      password: studentPassword,
    });
    if (!studentLogin.ok) throw new Error('Expected Student login to succeed.');
    const studentSession = await createSession({ pool, config, user: studentLogin.user });
    const secondStudentSession = await createSession({ pool, config, user: studentLogin.user });
    const studentChanged = await changeOwnPassword({
      pool,
      config,
      session: studentSession,
      currentPassword: studentPassword,
      newPassword: 'StudentChanged!567',
    });
    expect(studentChanged).toMatchObject({ ok: true, sessions_invalidated: 1 });
    await expectLogin(studentUsername, studentPassword, {
      ok: false,
      code: 'INVALID_CREDENTIALS',
    });
    await expectLogin(studentUsername, 'StudentChanged!567', {
      ok: true,
      user: { role: 'student' },
    });
    await expectLogin('student@example.test', 'StudentChanged!567', {
      ok: true,
      user: { role: 'student' },
    });
    await expect(
      getSessionByToken({ pool, config, sessionToken: studentSession.session_token }),
    ).not.toBeNull();
    await expect(
      getSessionByToken({ pool, config, sessionToken: secondStudentSession.session_token }),
    ).resolves.toBeNull();
  });
});

async function expectLogin(
  identifier: string,
  password: string,
  expected: Record<string, unknown>,
) {
  const result = await authenticateUser({ pool, config, identifier, password });
  expect(result).toMatchObject(expected);
  return result;
}

async function seedIdentityGraph() {
  await pool.query(
    `INSERT INTO onetime.portal_households
       (household_key, account_key, product_key, display_name)
     VALUES
       ('household_alpha',$1,$2,'Alpha Family'),
       ('household_beta',$1,$2,'Beta Family')`,
    [config.accountKey, config.productKey],
  );
  await pool.query(
    `INSERT INTO onetime.portal_guardian_relationships
       (relationship_key, account_key, product_key, household_key, guardian_user_ref,
        relationship_label, authority)
     VALUES
       ('relationship_alpha',$1,$2,'household_alpha',$3,'Parent','primary_guardian'),
       ('relationship_beta',$1,$2,'household_beta',$3,'Parent','guardian')`,
    [config.accountKey, config.productKey, parentUserKey],
  );
  await pool.query(
    `INSERT INTO onetime.portal_learners
       (learner_key, account_key, product_key, household_key, display_name)
     VALUES ('learner_alpha',$1,$2,'household_alpha','Student Example')`,
    [config.accountKey, config.productKey],
  );
  await pool.query(
    `INSERT INTO onetime.portal_student_access_state
       (access_state_key, account_key, product_key, household_key, learner_key,
        student_user_ref, status, normalized_username, password_hash_ref,
        credential_status)
     VALUES
       ('student_access_alpha',$1,$2,'household_alpha','learner_alpha',$3,
        'active',$4,$5,'parent_managed')`,
    [
      config.accountKey,
      config.productKey,
      studentUserKey,
      studentUsername,
      studentPasswordHashRef(studentPassword),
    ],
  );
  await pool.query(
    `INSERT INTO onetime.account_learner_identity_links
       (link_key, account_key, product_key, household_key, learner_key, user_key, link_state)
     VALUES
       ('student_link_alpha',$1,$2,'household_alpha','learner_alpha',$3,'active')`,
    [config.accountKey, config.productKey, studentUserKey],
  );
}

async function grantCurrentAccess() {
  await pool.query(
    `INSERT INTO onetime.account_access_projections
       (access_key, account_key, product_key, household_key, state, source_kind,
        effective_at, expires_at, opaque_source_reference, source_revision,
        source_updated_at, source_request_hash, policy_version, last_event_key)
     VALUES
       ('access_alpha',$1,$2,'household_alpha','active','free_pilot',
        now() - interval '1 hour', now() + interval '1 day', 'pilot-auth-test', 1,
        now(), $3, 'access-auth-test-v1', 'access_event_alpha')`,
    [config.accountKey, config.productKey, 'a'.repeat(64)],
  );
}

function studentPasswordHashRef(password: string) {
  const salt = 'student-access-auth-test-salt-v1';
  return `scrypt:v1:${salt}:${scryptSync(password, salt, 32).toString('base64url')}`;
}
