import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import pg from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { loadConfig } from '../../../../../../../packages/config/src/index.ts';
import type {
  ParentHouseholdMutationContext,
  ParentHouseholdPrincipal,
} from '../../../../../../../packages/contracts/src/portals/parent-household/index.ts';
import {
  createMemoryPool,
  type DbPool,
  type Queryable,
} from '../../../../../../../packages/db/src/index.ts';
import {
  authenticateUser,
  createSession,
} from '../../../../../../../packages/domain/src/auth/service.ts';
import { hashAuthPassword } from '../../../../../../../packages/domain/src/auth/policy.ts';
import { createPostgresParentHouseholdRepository } from './postgres-repository.ts';
import {
  executeFamilySignupAccessSourceCorrection,
  FAMILY_SIGNUP_ACCESS_CORRECTION_EXPIRES_AT,
  FAMILY_SIGNUP_ACCESS_CORRECTION_SOURCE_EFFECTIVE_AT,
  inspectFamilySignupAccessSourceCorrection,
} from './family-signup-access-source-correction.ts';
import { createParentHouseholdService } from './service.ts';

const now = new Date('2026-07-31T14:00:00.000Z');
const familySignupCutoverAt = new Date('2026-08-01T00:00:00.000Z');
const passwordHash = `argon2id-v1$v=19$m=19456,t=2,p=1$${'a'.repeat(22)}$${'b'.repeat(43)}`;
const migrationFiles = [
  '0001_onetime_lead_slice.sql',
  '0002_crm_auth_core.sql',
  '0003_ot27_security_crm_repair.sql',
  '1000_ot42_crm_module_v1.sql',
  '1300_ot46_billing_foundation.sql',
  '1500_ot52_portal_households_learners.sql',
  '1700_ot71_account_lifecycle.sql',
  '1900_ot83_household_portal_foundation.sql',
  '2206_student_non_email_credentials.sql',
  '2223_account_product_access_projection.sql',
  '2225_parent_student_contact_operations.sql',
  '2234_canonical_state_machines.sql',
  '2235_v21_household_identity.sql',
  '2241_v21_admin_directory.sql',
  '2248_v21_family_signup.sql',
  '2251_v21_embedded_classroom.sql',
  '2255_v21_student_actual_name.sql',
  '2277_family_signup_access_source_correction.sql',
] as const;

const nativeMigrationFiles = (await readdir(path.resolve(process.cwd(), 'packages/db/migrations')))
  .filter((name) => name.endsWith('.sql'))
  .sort();

describe('P12 concrete PostgreSQL Parent household repository', () => {
  let pool: DbPool;

  beforeAll(async () => {
    pool = createMemoryPool();
    await applyMigrations(pool, true);
    await installFamilySignupCutover(pool);
    await installClassEnrollmentFixture(pool);
  }, 30_000);

  afterAll(async () => {
    await pool.end();
  });

  it('persists actual/display names, hash, acceptance, enrollment, audit and receipt atomically', async () => {
    const fixture = await seedParent(pool, 'create', 0);
    let hashCount = 0;
    const service = concreteService(pool, 'student-create', async () => {
      hashCount += 1;
      return passwordHash;
    });
    const context = mutationContext('create', 'a');
    const command = {
      expected_revision: 1,
      actual_name: 'Actual Student',
      display_name: null,
      username: 'actual.student',
      relationship: 'dependent' as const,
      new_password: '000123',
      password_confirmation: '000123',
    };

    const result = await service.createStudent(fixture.principal, command, context);
    expect(result.snapshot).toMatchObject({ revision: 2, active_student_count: 1 });
    expect(result.credential_handoff?.new_password).toBe('000123');
    expect(hashCount).toBe(1);

    const persisted = await pool.query(
      `SELECT actual_name, display_name, normalized_username, credential_hash
         FROM onetime.v21_student_profiles
        WHERE student_id = 'student-create'`,
    );
    expect(persisted.rows[0]).toEqual({
      actual_name: 'Actual Student',
      display_name: null,
      normalized_username: 'actual.student',
      credential_hash: passwordHash,
    });
    expect(JSON.stringify(persisted.rows[0])).not.toContain('000123');
    await expect(count(pool, 'admin_service_account_acceptances')).resolves.toBe(1);
    await expect(count(pool, 'admin_canonical_student_enrollments')).resolves.toBe(1);
    await expect(count(pool, 'class_series_enrollments')).resolves.toBe(1);
    await expect(count(pool, 'admin_directory_audit_events')).resolves.toBe(1);
    await expect(count(pool, 'admin_directory_receipts')).resolves.toBe(1);
    await expect(count(pool, 'admin_student_credential_resets')).resolves.toBe(1);
    await expect(
      countWhere(pool, 'portal_households', 'household_key', fixture.householdId),
    ).resolves.toBe(1);
    await expect(
      countWhere(pool, 'portal_learners', 'learner_key', 'student-create'),
    ).resolves.toBe(1);
    await expect(
      countWhere(pool, 'account_learner_identity_links', 'learner_key', 'student-create'),
    ).resolves.toBe(1);
    await expect(
      countWhere(pool, 'portal_student_access_state', 'learner_key', 'student-create'),
    ).resolves.toBe(1);
    await expect(
      countWhere(pool, 'account_access_projections', 'household_key', fixture.householdId),
    ).resolves.toBe(1);
    const projectedIdentity = await pool.query(
      `SELECT users.email_normalized, users.status AS user_status,
              access.normalized_username, access.credential_status,
              access.password_hash_ref, links.link_state
         FROM onetime.portal_student_access_state AS access
         JOIN onetime.account_learner_identity_links AS links
           ON links.account_key = access.account_key
          AND links.product_key = access.product_key
          AND links.learner_key = access.learner_key
          AND links.user_key = access.student_user_ref
         JOIN onetime.account_users AS users
           ON users.account_key = access.account_key
          AND users.product_key = access.product_key
          AND users.user_key = access.student_user_ref
        WHERE access.learner_key = 'student-create'`,
    );
    expect(projectedIdentity.rows[0]).toEqual({
      email_normalized: 'student:actual.student',
      user_status: 'active',
      normalized_username: 'actual.student',
      credential_status: 'parent_managed',
      password_hash_ref: passwordHash,
      link_state: 'active',
    });

    const replay = await service.createStudent(fixture.principal, command, context);
    expect(replay.snapshot.revision).toBe(2);
    expect(replay.credential_handoff).toBeNull();
    expect(hashCount).toBe(1);
    await expect(count(pool, 'v21_student_profiles')).resolves.toBe(1);
    await expect(count(pool, 'admin_directory_audit_events')).resolves.toBe(1);

    const reset = await service.resetStudentCredential(
      fixture.principal,
      {
        expected_revision: 2,
        student_id: 'student-create',
        new_password: '123456',
        password_confirmation: '123456',
      },
      mutationContext('create-reset', 'c'),
    );
    expect(reset.snapshot.revision).toBe(3);
    expect(reset.credential_handoff?.new_password).toBe('123456');
    expect(hashCount).toBe(2);

    const replayAfterLaterMutation = await service.createStudent(
      fixture.principal,
      command,
      context,
    );
    expect(replayAfterLaterMutation.snapshot.revision).toBe(3);
    expect(replayAfterLaterMutation.credential_handoff).toBeNull();
    expect(hashCount).toBe(2);
    await expect(count(pool, 'v21_student_profiles')).resolves.toBe(1);
    await expect(count(pool, 'admin_directory_audit_events')).resolves.toBe(2);

    await expect(
      service.createStudent(fixture.principal, command, {
        ...context,
        canonical_request_hash: 'b'.repeat(64),
      }),
    ).rejects.toMatchObject({ code: 'parent_household_idempotency_conflict' });
  });

  it('conceals wrong-household update targets before global username availability', async () => {
    const owner = await seedParent(pool, 'conceal-owner', 1);
    const hidden = await seedParent(pool, 'conceal-hidden', 1);
    const service = concreteService(pool, 'student-unused');

    for (const [suffix, username] of [
      ['taken', 'conceal.hidden.student.1'],
      ['available', 'unused.global.username'],
    ] as const) {
      await expect(
        service.updateStudent(
          owner.principal,
          {
            expected_revision: 1,
            student_id: 'student-conceal-hidden-1',
            actual_name: 'Hidden Student',
            display_name: null,
            username,
          },
          mutationContext(`conceal-${suffix}`, suffix === 'taken' ? '8' : '9'),
        ),
      ).rejects.toMatchObject({ code: 'parent_student_missing' });
    }
    await expect(
      countWhere(pool, 'v21_student_profiles', 'household_id', owner.householdId),
    ).resolves.toBe(1);
    await expect(
      countWhere(pool, 'v21_student_profiles', 'household_id', hidden.householdId),
    ).resolves.toBe(1);
    await expect(
      countWhere(pool, 'admin_directory_receipts', 'result_ref', 'student-conceal-hidden-1'),
    ).resolves.toBe(0);
  });

  it('conceals a sibling household and rejects a stale fourth-seat write', async () => {
    const fixture = await seedParent(pool, 'cap', 3);
    const repository = concreteRepository(pool);
    await expect(
      repository.loadOwnedHousehold({
        ...fixture.principal,
        adult_id: 'adult-sibling',
      }),
    ).resolves.toBeNull();

    await expect(
      concreteService(pool, 'student-four').createStudent(
        fixture.principal,
        {
          expected_revision: 1,
          actual_name: 'Fourth Student',
          username: 'fourth.student',
          relationship: 'dependent',
          new_password: '000123',
          password_confirmation: '000123',
        },
        mutationContext('fourth', 'c'),
      ),
    ).rejects.toMatchObject({ code: 'parent_student_seat_limit' });
    await expect(
      countWhere(pool, 'v21_student_profiles', 'household_id', fixture.householdId),
    ).resolves.toBe(3);
  });

  it('rolls the Student and every evidence row back when enrollment persistence fails', async () => {
    const fixture = await seedParent(pool, 'rollback', 0);
    const transactionLog: string[] = [];
    const faultPool = failOn(
      pool,
      'INSERT INTO onetime.admin_canonical_student_enrollments',
      transactionLog,
    );
    await expect(
      concreteService(faultPool, 'student-rollback').createStudent(
        fixture.principal,
        {
          expected_revision: 1,
          actual_name: 'Rollback Student',
          username: 'rollback.student',
          relationship: 'dependent',
          new_password: '000123',
          password_confirmation: '000123',
        },
        mutationContext('rollback', 'd'),
      ),
    ).rejects.toThrow(/injected enrollment failure/);
    expect(transactionLog[0]).toBe('BEGIN');
    expect(transactionLog.at(-1)).toBe('ROLLBACK');
    expect(transactionLog).not.toContain('COMMIT');
  });

  it('archives atomically with enrollment and session/grant revocation readback', async () => {
    const fixture = await seedParent(pool, 'archive', 0);
    const service = concreteService(pool, 'student-archive');
    const created = await service.createStudent(
      fixture.principal,
      {
        expected_revision: 1,
        actual_name: 'Archive Student',
        username: 'archive.student',
        relationship: 'dependent',
        new_password: '000123',
        password_confirmation: '000123',
      },
      mutationContext('archive-create', 'e'),
    );
    await seedStudentAccess(pool, fixture, 'student-archive');
    const archived = await service.archiveStudent(
      fixture.principal,
      { expected_revision: created.snapshot.revision, student_id: 'student-archive' },
      mutationContext('archive-action', 'f'),
    );
    expect(archived.snapshot.students[0]?.state).toBe('archived');
    const readback = await pool.query(
      `SELECT active_session_ids_revoked, classroom_grant_ids_revoked, enrollment_ids_revoked
         FROM onetime.admin_access_revocation_readbacks
        WHERE subject_id = 'student-archive'`,
    );
    expect(readback.rowCount).toBe(1);
    expect(String(readback.rows[0]?.active_session_ids_revoked)).toContain('live-archive');
    expect(String(readback.rows[0]?.classroom_grant_ids_revoked)).toContain('grant-archive');
    const enrollment = await pool.query(
      `SELECT state FROM onetime.admin_canonical_student_enrollments
        WHERE student_id = 'student-archive'`,
    );
    expect(enrollment.rows[0]?.state).toBe('revoked');
    const classEnrollment = await pool.query(
      `SELECT enrollment_state FROM onetime.class_series_enrollments
        WHERE learner_key = 'student-archive'`,
    );
    expect(classEnrollment.rows[0]?.enrollment_state).toBe('revoked');
    const disabledProjection = await pool.query(
      `SELECT users.status AS user_status, links.link_state,
              access.status AS access_status, access.credential_status
         FROM onetime.portal_student_access_state AS access
         JOIN onetime.account_learner_identity_links AS links
           ON links.account_key = access.account_key
          AND links.product_key = access.product_key
          AND links.learner_key = access.learner_key
         JOIN onetime.account_users AS users
           ON users.account_key = access.account_key
          AND users.product_key = access.product_key
          AND users.user_key = access.student_user_ref
        WHERE access.learner_key = 'student-archive'`,
    );
    expect(disabledProjection.rows[0]).toEqual({
      user_status: 'disabled',
      link_state: 'disabled',
      access_status: 'disabled',
      credential_status: 'disabled',
    });

    const restored = await service.restoreStudent(
      fixture.principal,
      { expected_revision: archived.snapshot.revision, student_id: 'student-archive' },
      mutationContext('archive-restore', '0'),
    );
    expect(restored.snapshot.students[0]?.state).toBe('active');
    const restoredClassEnrollment = await pool.query(
      `SELECT enrollment_state FROM onetime.class_series_enrollments
        WHERE learner_key = 'student-archive'`,
    );
    expect(restoredClassEnrollment.rows[0]?.enrollment_state).toBe('active');
    const restoredProjection = await pool.query(
      `SELECT users.status AS user_status, links.link_state,
              access.status AS access_status, access.credential_status
         FROM onetime.portal_student_access_state AS access
         JOIN onetime.account_learner_identity_links AS links
           ON links.account_key = access.account_key
          AND links.product_key = access.product_key
          AND links.learner_key = access.learner_key
         JOIN onetime.account_users AS users
           ON users.account_key = access.account_key
          AND users.product_key = access.product_key
          AND users.user_key = access.student_user_ref
        WHERE access.learner_key = 'student-archive'`,
    );
    expect(restoredProjection.rows[0]).toEqual({
      user_status: 'active',
      link_state: 'active',
      access_status: 'active',
      credential_status: 'parent_managed',
    });
  });

  it('projects a v2.1 Parent-created Student into working login, session, and reset state', async () => {
    const fixture = await seedParent(pool, 'login-projection', 0);
    const service = concreteService(pool, 'student-login-projection', async (password) =>
      hashAuthPassword(password),
    );
    const initialPassword = '000123';
    const replacementPassword = '123456';
    const created = await service.createStudent(
      fixture.principal,
      {
        expected_revision: 1,
        actual_name: 'Login Projection Student',
        username: 'login.projection.student',
        relationship: 'dependent',
        new_password: initialPassword,
        password_confirmation: initialPassword,
      },
      mutationContext('login-projection-create', '6'),
    );
    const config = loadConfig({
      NODE_ENV: 'test',
      PUBLIC_BASE_URL: 'https://join.onetimeonetime.com',
      APP_VERSION: 'test',
      COMMIT_SHA: 'test',
      OUTBOX_TRANSPORT_MODE: 'sink',
      ONE_TIME_ACCOUNT_KEY: 'account-test',
      ONE_TIME_PRODUCT_KEY: 'one_time_mishnayos',
    });
    const login = await authenticateUser({
      pool,
      config,
      identifier: 'login.projection.student',
      password: initialPassword,
    });
    expect(login).toMatchObject({ ok: true, user: { role: 'student' } });
    if (!login.ok) throw new Error(`Expected Student login, got ${login.code}`);
    await createSession({ pool, config, user: login.user });

    const reset = await service.resetStudentCredential(
      fixture.principal,
      {
        expected_revision: created.snapshot.revision,
        student_id: 'student-login-projection',
        new_password: replacementPassword,
        password_confirmation: replacementPassword,
      },
      mutationContext('login-projection-reset', '7'),
    );
    expect(reset.snapshot.revision).toBe(3);
    await expect(
      authenticateUser({
        pool,
        config,
        identifier: 'login.projection.student',
        password: initialPassword,
      }),
    ).resolves.toMatchObject({ ok: false, code: 'INVALID_CREDENTIALS' });
    await expect(
      authenticateUser({
        pool,
        config,
        identifier: 'login.projection.student',
        password: replacementPassword,
      }),
    ).resolves.toMatchObject({ ok: true, user: { role: 'student' } });
    const sessionReadback = await pool.query(
      `SELECT revoked_at
         FROM onetime.user_sessions
        WHERE user_key = (
          SELECT student_user_ref
            FROM onetime.portal_student_access_state
           WHERE learner_key = 'student-login-projection'
        )`,
    );
    expect(sessionReadback.rows).toHaveLength(1);
    expect(sessionReadback.rows[0]?.revoked_at).not.toBeNull();
  });

  it('preserves the exact unexpired family-signup window in the portal access projection', async () => {
    const fixture = await seedParent(pool, 'free-access-projection', 0, 'free');
    await concreteService(pool, 'student-free-access-projection').createStudent(
      fixture.principal,
      {
        expected_revision: 1,
        actual_name: 'Free Access Student',
        username: 'free.access.student',
        relationship: 'dependent',
        new_password: '000123',
        password_confirmation: '000123',
      },
      mutationContext('free-access-projection', '5'),
    );
    const projection = await pool.query(
      `SELECT state, source_kind, effective_at, expires_at
         FROM onetime.account_access_projections
        WHERE household_key = $1`,
      [fixture.householdId],
    );
    expect(projection.rows[0]).toMatchObject({
      state: 'active',
      source_kind: 'free_pilot',
      effective_at: now,
      expires_at: new Date('2026-09-13T16:24:00.000Z'),
    });
  });

  it('projects a pre-Family-signup legacy free household only from durable canonical provenance', async () => {
    const fixture = await seedParent(pool, 'legacy-free-access-projection', 0, 'free', false);
    await concreteService(pool, 'student-legacy-free-access').createStudent(
      fixture.principal,
      {
        expected_revision: 1,
        actual_name: 'Legacy Free Access Student',
        username: 'legacy.free.access.student',
        relationship: 'dependent',
        new_password: '000123',
        password_confirmation: '000123',
      },
      mutationContext('legacy-free-access-projection', '4'),
    );
    const projection = await pool.query(
      `SELECT state, source_kind, effective_at, expires_at
         FROM onetime.account_access_projections
        WHERE household_key = $1`,
      [fixture.householdId],
    );
    expect(projection.rows[0]).toMatchObject({
      state: 'active',
      source_kind: 'legacy_preview',
      effective_at: now,
      expires_at: null,
    });
  });

  it('fails closed with zero effects for a post-cutover free record missing its Family-signup source', async () => {
    const fixture = await seedParent(
      pool,
      'missing-family-signup-source',
      0,
      'free',
      false,
      'post_cutover_family_signup',
      FAMILY_SIGNUP_ACCESS_CORRECTION_SOURCE_EFFECTIVE_AT,
    );
    await expect(
      concreteService(pool, 'student-missing-family-signup-source').createStudent(
        fixture.principal,
        {
          expected_revision: 1,
          actual_name: 'Rejected Student',
          username: 'rejected.student',
          relationship: 'dependent',
          new_password: '000123',
          password_confirmation: '000123',
        },
        mutationContext('missing-family-signup-source', '5'),
      ),
    ).rejects.toThrow(/household access source is unavailable/i);
    await expect(
      countWhere(pool, 'v21_student_profiles', 'household_id', fixture.householdId),
    ).resolves.toBe(0);
    await expect(
      countWhere(pool, 'account_access_projections', 'household_key', fixture.householdId),
    ).resolves.toBe(0);
    await expect(
      countWhere(pool, 'admin_canonical_student_enrollments', 'household_id', fixture.householdId),
    ).resolves.toBe(0);
  });

  it('fails closed when a pre-cutover null-cause event is no longer the current initial free state', async () => {
    const fixture = await seedParent(pool, 'legacy-free-state-changed', 0, 'free', false);
    const laterTransition = `transition-${fixture.householdId}-later-free`;
    await pool.query(
      `INSERT INTO onetime.canonical_state_transition_events
         (transition_key, aggregate_kind, aggregate_key, previous_state, next_state,
          expected_version, resulting_version, product_key, runtime_tier,
          verification_environment_id, actor_kind, actor_key, idempotency_key,
          canonical_request_hash, access_cause, created_at)
       VALUES ($1,'access',$2,'active','free',1,2,'one_time_mishnayos','isolated_staging','ci',
               'system','P12-test',$3,$4,NULL,$5)`,
      [
        laterTransition,
        fixture.householdId,
        `idempotency-${fixture.householdId}-later-free`,
        'f'.repeat(64),
        new Date(now.getTime() + 60_000).toISOString(),
      ],
    );
    await pool.query(
      `UPDATE onetime.canonical_aggregate_states
          SET version = 2,
              current_state = 'free',
              last_transition_key = $1,
              updated_at = $2
        WHERE aggregate_kind = 'access'
          AND aggregate_key = $3
          AND product_key = 'one_time_mishnayos'
          AND runtime_tier = 'isolated_staging'
          AND verification_environment_id = 'ci'`,
      [laterTransition, new Date(now.getTime() + 60_000).toISOString(), fixture.householdId],
    );
    await expect(
      concreteService(pool, 'student-legacy-free-state-changed').createStudent(
        fixture.principal,
        {
          expected_revision: 1,
          actual_name: 'Rejected State Changed Student',
          username: 'rejected.state.changed',
          relationship: 'dependent',
          new_password: '000123',
          password_confirmation: '000123',
        },
        mutationContext('legacy-free-state-changed', '7'),
      ),
    ).rejects.toThrow(/household access source is unavailable/i);
    await expect(
      countWhere(pool, 'v21_student_profiles', 'household_id', fixture.householdId),
    ).resolves.toBe(0);
    await expect(
      countWhere(pool, 'account_access_projections', 'household_key', fixture.householdId),
    ).resolves.toBe(0);
    await expect(
      countWhere(pool, 'admin_canonical_student_enrollments', 'household_id', fixture.householdId),
    ).resolves.toBe(0);
  });

  it('inspects an exact historical free-period correction candidate read-only and refuses it at cutoff', async () => {
    const fixture = await seedParent(
      pool,
      'correction-candidate',
      0,
      'free',
      false,
      'post_cutover_family_signup',
      FAMILY_SIGNUP_ACCESS_CORRECTION_SOURCE_EFFECTIVE_AT,
    );
    const sourceEffectiveAt = FAMILY_SIGNUP_ACCESS_CORRECTION_SOURCE_EFFECTIVE_AT;
    const candidate = {
      correction_receipt_key: 'test-family-signup-source-correction',
      controller_authorization_reference: 'not-an-execution-gate',
      household_id: fixture.householdId,
      product: 'one_time_mishnayos' as const,
      runtime_tier: 'isolated_staging' as const,
      verification_environment_id: 'ci' as const,
      source_effective_at: sourceEffectiveAt,
      expires_at: FAMILY_SIGNUP_ACCESS_CORRECTION_EXPIRES_AT,
      observed_at: '2026-08-05T12:06:00.000Z',
    };
    await expect(inspectFamilySignupAccessSourceCorrection(pool, candidate)).resolves.toMatchObject(
      {
        disposition: 'eligible',
        source_transition_key: `transition-${fixture.householdId}`,
      },
    );
    await expect(count(pool, 'family_signup_access_source_correction_receipts')).resolves.toBe(0);
    await expect(
      countWhere(pool, 'family_signup_requests', 'household_id', fixture.householdId),
    ).resolves.toBe(0);
    await expect(
      countWhere(pool, 'family_signup_receipts', 'household_id', fixture.householdId),
    ).resolves.toBe(0);
    await expect(
      countWhere(pool, 'family_signup_outbox', 'household_id', fixture.householdId),
    ).resolves.toBe(0);
    await expect(
      inspectFamilySignupAccessSourceCorrection(pool, {
        ...candidate,
        observed_at: FAMILY_SIGNUP_ACCESS_CORRECTION_EXPIRES_AT,
      }),
    ).resolves.toEqual({ disposition: 'ineligible', reason: 'free_period_cutoff_reached' });
    await expect(count(pool, 'family_signup_access_source_correction_receipts')).resolves.toBe(0);
  });

  it('accepts only an exact active, unexpired correction receipt and keeps the free window bounded', async () => {
    const fixture = await seedParent(
      pool,
      'correction-receipt',
      0,
      'free',
      false,
      'post_cutover_family_signup',
      FAMILY_SIGNUP_ACCESS_CORRECTION_SOURCE_EFFECTIVE_AT,
    );
    const sourceEffectiveAt = FAMILY_SIGNUP_ACCESS_CORRECTION_SOURCE_EFFECTIVE_AT;
    const expiresAt = FAMILY_SIGNUP_ACCESS_CORRECTION_EXPIRES_AT;
    await pool.query(
      `INSERT INTO onetime.family_signup_access_source_correction_receipts
         (correction_receipt_key, household_id, product, runtime_tier,
          verification_environment_id, source_transition_key, source_effective_at,
          expires_at, correction_state, controller_authorization_reference, request_digest)
       VALUES ('test-active-correction',$1,'one_time_mishnayos','isolated_staging','ci',$2,$3,$4,
               'active','test-controller-authorization',$5)`,
      [
        fixture.householdId,
        `transition-${fixture.householdId}`,
        sourceEffectiveAt,
        expiresAt,
        'a'.repeat(64),
      ],
    );
    await expect(
      concreteService(pool, 'student-correction-receipt').createStudent(
        fixture.principal,
        {
          expected_revision: 1,
          actual_name: 'Corrected Access Student',
          username: 'corrected.access.student',
          relationship: 'dependent',
          new_password: '000123',
          password_confirmation: '000123',
        },
        mutationContext('correction-receipt', '8'),
      ),
    ).resolves.toMatchObject({ snapshot: { active_student_count: 1 } });
    const projection = await pool.query(
      `SELECT state, source_kind, effective_at, expires_at
         FROM onetime.account_access_projections
        WHERE household_key = $1`,
      [fixture.householdId],
    );
    expect(projection.rows[0]).toMatchObject({
      state: 'active',
      source_kind: 'admin_override',
      effective_at: new Date(sourceEffectiveAt),
      expires_at: new Date(expiresAt),
    });

    const mismatched = await seedParent(
      pool,
      'correction-receipt-mismatched-window',
      0,
      'free',
      false,
      'post_cutover_family_signup',
      FAMILY_SIGNUP_ACCESS_CORRECTION_SOURCE_EFFECTIVE_AT,
    );
    await expect(
      pool.query(
        `INSERT INTO onetime.family_signup_access_source_correction_receipts
           (correction_receipt_key, household_id, product, runtime_tier,
            verification_environment_id, source_transition_key, source_effective_at,
            expires_at, correction_state, controller_authorization_reference, request_digest)
         VALUES ('test-mismatched-correction',$1,'one_time_mishnayos','isolated_staging','ci',$2,$3,
                 '2026-09-12T18:00:00+03:00','active','test-controller-authorization',$4)`,
        [
          mismatched.householdId,
          `transition-${mismatched.householdId}`,
          sourceEffectiveAt,
          'c'.repeat(64),
        ],
      ),
    ).rejects.toThrow();
    await expect(
      concreteService(pool, 'student-mismatched-correction').createStudent(
        mismatched.principal,
        {
          expected_revision: 1,
          actual_name: 'Mismatched Correction Student',
          username: 'mismatched.correction.student',
          relationship: 'dependent',
          new_password: '000123',
          password_confirmation: '000123',
        },
        mutationContext('correction-receipt-mismatched-window', 'a'),
      ),
    ).rejects.toThrow(/household access source is unavailable/i);
    await expect(
      countWhere(pool, 'v21_student_profiles', 'household_id', mismatched.householdId),
    ).resolves.toBe(0);
    await expect(
      countWhere(pool, 'account_access_projections', 'household_key', mismatched.householdId),
    ).resolves.toBe(0);

    const expired = await seedParent(
      pool,
      'correction-receipt-expired',
      0,
      'free',
      false,
      'post_cutover_family_signup',
      FAMILY_SIGNUP_ACCESS_CORRECTION_SOURCE_EFFECTIVE_AT,
    );
    await pool.query(
      `INSERT INTO onetime.family_signup_access_source_correction_receipts
         (correction_receipt_key, household_id, product, runtime_tier,
          verification_environment_id, source_transition_key, source_effective_at,
          expires_at, correction_state, controller_authorization_reference, request_digest)
       VALUES ('test-expired-correction',$1,'one_time_mishnayos','isolated_staging','ci',$2,$3,$4,
               'active','test-controller-authorization',$5)`,
      [
        expired.householdId,
        `transition-${expired.householdId}`,
        sourceEffectiveAt,
        expiresAt,
        'b'.repeat(64),
      ],
    );
    await expect(
      concreteService(pool, 'student-expired-correction').createStudent(
        expired.principal,
        {
          expected_revision: 1,
          actual_name: 'Expired Correction Student',
          username: 'expired.correction.student',
          relationship: 'dependent',
          new_password: '000123',
          password_confirmation: '000123',
        },
        {
          ...mutationContext('correction-receipt-expired', '9'),
          occurred_at: expiresAt,
        },
      ),
    ).rejects.toThrow(/household access source is unavailable/i);
    await expect(
      countWhere(pool, 'v21_student_profiles', 'household_id', expired.householdId),
    ).resolves.toBe(0);
    await expect(
      countWhere(pool, 'account_access_projections', 'household_key', expired.householdId),
    ).resolves.toBe(0);
    await expect(
      countWhere(pool, 'admin_canonical_student_enrollments', 'household_id', expired.householdId),
    ).resolves.toBe(0);
  });

  it('fails closed with zero effects for grace without a Family-signup source', async () => {
    const fixture = await seedParent(pool, 'grace-without-signup-source', 0, 'grace', false);
    await expect(
      concreteService(pool, 'student-grace-without-signup-source').createStudent(
        fixture.principal,
        {
          expected_revision: 1,
          actual_name: 'Rejected Grace Student',
          username: 'rejected.grace.student',
          relationship: 'dependent',
          new_password: '000123',
          password_confirmation: '000123',
        },
        mutationContext('grace-without-signup-source', '6'),
      ),
    ).rejects.toThrow(/time-bounded household access source is unavailable/i);
    await expect(
      countWhere(pool, 'v21_student_profiles', 'household_id', fixture.householdId),
    ).resolves.toBe(0);
    await expect(
      countWhere(pool, 'account_access_projections', 'household_key', fixture.householdId),
    ).resolves.toBe(0);
    await expect(
      countWhere(pool, 'admin_canonical_student_enrollments', 'household_id', fixture.householdId),
    ).resolves.toBe(0);
  });
});

const nativeUrl = process.env.P12_NATIVE_DATABASE_URL;
const nativeEnabled = process.env.P12_NATIVE_POSTGRES_DISPOSABLE === 'true' && Boolean(nativeUrl);

describe.runIf(nativeEnabled)('P12 native PostgreSQL through migration 2255', () => {
  let pool: pg.Pool;

  beforeAll(async () => {
    pool = new pg.Pool({ connectionString: nativeUrl!, max: 4 });
    await pool.query('CREATE EXTENSION IF NOT EXISTS pgcrypto');
    await pool.query('CREATE SCHEMA onetime');
    await applyMigrations(pool as DbPool, false);
    await installFamilySignupCutover(pool as DbPool);
    await installClassEnrollmentFixture(pool as DbPool, true);
  }, 30_000);

  afterAll(async () => {
    await pool.query('DROP SCHEMA onetime CASCADE');
    await pool.end();
  }, 30_000);

  it('allows one concurrent final-seat winner and leaves complete canonical evidence', async () => {
    const fixture = await seedParent(
      pool as DbPool,
      'native',
      2,
      'active',
      true,
      'legacy',
      undefined,
      true,
    );
    const first = concreteService(pool as DbPool, 'student-native-a');
    const second = concreteService(pool as DbPool, 'student-native-b');
    const command = {
      expected_revision: 1,
      actual_name: 'Native Student',
      display_name: null,
      relationship: 'dependent' as const,
      new_password: '000123',
      password_confirmation: '000123',
    };
    const results = await Promise.allSettled([
      first.createStudent(
        fixture.principal,
        { ...command, username: 'native.student.a' },
        mutationContext('native-a', '1'),
      ),
      second.createStudent(
        fixture.principal,
        { ...command, username: 'native.student.b' },
        mutationContext('native-b', '2'),
      ),
    ]);
    expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
    expect(results.filter((result) => result.status === 'rejected')).toHaveLength(1);
    await expect(
      countWhere(pool as DbPool, 'v21_student_profiles', 'household_id', fixture.householdId),
    ).resolves.toBe(3);
    await expect(
      countWhere(pool as DbPool, 'admin_directory_receipts', 'operation', 'student_upsert'),
    ).resolves.toBe(1);
  });

  it('serializes same-key create and reset races before lazy credential hashing', async () => {
    const fixture = await seedParent(
      pool as DbPool,
      'native-replay-race',
      0,
      'active',
      true,
      'legacy',
      undefined,
      true,
    );
    let createHashCount = 0;
    const createService = concreteService(
      pool as DbPool,
      'student-native-replay-race',
      async () => {
        createHashCount += 1;
        await new Promise((resolve) => setTimeout(resolve, 25));
        return passwordHash;
      },
    );
    const createCommand = {
      expected_revision: 1,
      actual_name: 'Native Replay Student',
      display_name: null,
      username: 'native.replay.student',
      relationship: 'dependent' as const,
      new_password: '000123',
      password_confirmation: '000123',
    };
    const createContext = mutationContext('native-replay-create', '4');
    const createResults = await Promise.all([
      createService.createStudent(fixture.principal, createCommand, createContext),
      createService.createStudent(fixture.principal, createCommand, createContext),
    ]);
    expect(createHashCount).toBe(1);
    expect(createResults.filter((result) => result.credential_handoff !== null)).toHaveLength(1);
    expect(createResults.filter((result) => result.credential_handoff === null)).toHaveLength(1);
    expect(createResults.every((result) => result.snapshot.revision === 2)).toBe(true);
    await expect(
      countWhere(pool as DbPool, 'v21_student_profiles', 'household_id', fixture.householdId),
    ).resolves.toBe(1);
    await expect(
      countWhere(
        pool as DbPool,
        'admin_directory_receipts',
        'result_ref',
        'student_created:student-native-replay-race',
      ),
    ).resolves.toBe(1);

    let resetHashCount = 0;
    const resetService = concreteService(pool as DbPool, 'student-native-replay-race', async () => {
      resetHashCount += 1;
      await new Promise((resolve) => setTimeout(resolve, 25));
      return passwordHash;
    });
    const resetCommand = {
      expected_revision: 2,
      student_id: 'student-native-replay-race',
      new_password: '123456',
      password_confirmation: '123456',
    };
    const resetContext = mutationContext('native-replay-reset', '5');
    const resetResults = await Promise.all([
      resetService.resetStudentCredential(fixture.principal, resetCommand, resetContext),
      resetService.resetStudentCredential(fixture.principal, resetCommand, resetContext),
    ]);
    expect(resetHashCount).toBe(1);
    expect(resetResults.filter((result) => result.credential_handoff !== null)).toHaveLength(1);
    expect(resetResults.filter((result) => result.credential_handoff === null)).toHaveLength(1);
    expect(resetResults.every((result) => result.snapshot.revision === 3)).toBe(true);
    await expect(
      countWhere(
        pool as DbPool,
        'admin_directory_receipts',
        'result_ref',
        'student_credential_reset:student-native-replay-race',
      ),
    ).resolves.toBe(1);
    const canonical = await pool.query(
      `SELECT credential_version, version
         FROM onetime.v21_student_profiles
        WHERE student_id = 'student-native-replay-race'`,
    );
    expect(canonical.rows).toHaveLength(1);
    expect(Number(canonical.rows[0]?.credential_version)).toBe(2);
    expect(Number(canonical.rows[0]?.version)).toBe(2);
  });

  it('rolls every staged row back on an injected mid-transaction failure', async () => {
    const fixture = await seedParent(
      pool as DbPool,
      'native-rollback',
      0,
      'active',
      true,
      'legacy',
      undefined,
      true,
    );
    const faultPool = failOn(
      pool as DbPool,
      'INSERT INTO onetime.admin_canonical_student_enrollments',
    );
    await expect(
      concreteService(faultPool, 'student-native-rollback').createStudent(
        fixture.principal,
        {
          expected_revision: 1,
          actual_name: 'Native Rollback',
          username: 'native.rollback',
          relationship: 'dependent',
          new_password: '000123',
          password_confirmation: '000123',
        },
        mutationContext('native-rollback', '3'),
      ),
    ).rejects.toThrow(/injected enrollment failure/);
    await expect(
      countWhere(pool as DbPool, 'v21_student_profiles', 'household_id', fixture.householdId),
    ).resolves.toBe(0);
    await expect(
      countWhere(
        pool as DbPool,
        'admin_service_account_acceptances',
        'household_id',
        fixture.householdId,
      ),
    ).resolves.toBe(0);
    await expect(
      countWhere(
        pool as DbPool,
        'admin_directory_receipts',
        'result_ref',
        'student_created:student-native-rollback',
      ),
    ).resolves.toBe(0);
  });

  it('fails closed on native PostgreSQL when a current free period has no authorized source', async () => {
    const fixture = await seedParent(
      pool as DbPool,
      'native-missing-free-source',
      0,
      'free',
      false,
      'post_cutover_family_signup',
      undefined,
      true,
    );
    await expect(
      concreteService(pool as DbPool, 'student-native-missing-free-source').createStudent(
        fixture.principal,
        {
          expected_revision: 1,
          actual_name: 'Native Missing Source Student',
          username: 'native.missing.source',
          relationship: 'dependent',
          new_password: '000123',
          password_confirmation: '000123',
        },
        mutationContext('native-missing-free-source', '5'),
      ),
    ).rejects.toThrow(/household access source is unavailable/i);
    await expect(
      countWhere(pool as DbPool, 'v21_student_profiles', 'household_id', fixture.householdId),
    ).resolves.toBe(0);
    await expect(
      countWhere(
        pool as DbPool,
        'account_access_projections',
        'household_key',
        fixture.householdId,
      ),
    ).resolves.toBe(0);
  });

  it('records one controller-gated correction on native PostgreSQL without fabricating signup evidence', async () => {
    const fixture = await seedParent(
      pool as DbPool,
      'native-correction',
      0,
      'free',
      false,
      'post_cutover_family_signup',
      FAMILY_SIGNUP_ACCESS_CORRECTION_SOURCE_EFFECTIVE_AT,
      true,
    );
    const sourceEffectiveAt = FAMILY_SIGNUP_ACCESS_CORRECTION_SOURCE_EFFECTIVE_AT;
    const request = {
      correction_receipt_key: 'native-family-signup-source-correction',
      controller_authorization_reference: 'controller-review-native-test',
      controller_execution_gate: 'approved_family_signup_access_source_correction' as const,
      household_id: fixture.householdId,
      product: 'one_time_mishnayos' as const,
      runtime_tier: 'isolated_staging' as const,
      verification_environment_id: 'ci' as const,
      source_effective_at: sourceEffectiveAt,
      expires_at: FAMILY_SIGNUP_ACCESS_CORRECTION_EXPIRES_AT,
      observed_at: '2026-08-05T12:06:00.000Z',
      mode: 'execute' as const,
    };
    await expect(
      executeFamilySignupAccessSourceCorrection(pool as unknown as DbPool, request),
    ).resolves.toEqual({ disposition: 'committed' });
    await expect(
      executeFamilySignupAccessSourceCorrection(pool as unknown as DbPool, request),
    ).resolves.toEqual({ disposition: 'replayed' });
    await expect(
      count(pool as unknown as DbPool, 'family_signup_access_source_correction_receipts'),
    ).resolves.toBe(1);
    await expect(
      countWhere(pool as DbPool, 'family_signup_requests', 'household_id', fixture.householdId),
    ).resolves.toBe(0);
    await expect(
      countWhere(pool as DbPool, 'family_signup_receipts', 'household_id', fixture.householdId),
    ).resolves.toBe(0);
    await expect(
      countWhere(pool as DbPool, 'family_signup_outbox', 'household_id', fixture.householdId),
    ).resolves.toBe(0);
    await expect(
      concreteService(pool as DbPool, 'student-native-correction').createStudent(
        fixture.principal,
        {
          expected_revision: 1,
          actual_name: 'Native Corrected Student',
          username: 'native.corrected.student',
          relationship: 'dependent',
          new_password: '000123',
          password_confirmation: '000123',
        },
        mutationContext('native-correction', '6'),
      ),
    ).resolves.toMatchObject({ snapshot: { active_student_count: 1 } });
    const projection = await pool.query(
      `SELECT state, source_kind, effective_at, expires_at
         FROM onetime.account_access_projections
        WHERE household_key = $1`,
      [fixture.householdId],
    );
    expect(projection.rows[0]).toMatchObject({
      state: 'active',
      effective_at: new Date(sourceEffectiveAt),
      expires_at: new Date(FAMILY_SIGNUP_ACCESS_CORRECTION_EXPIRES_AT),
    });

    const afterCutoff = await seedParent(
      pool as DbPool,
      'native-correction-after-cutoff',
      0,
      'free',
      false,
      'post_cutover_family_signup',
      FAMILY_SIGNUP_ACCESS_CORRECTION_SOURCE_EFFECTIVE_AT,
      true,
    );
    await expect(
      executeFamilySignupAccessSourceCorrection(
        pool as unknown as DbPool,
        {
          ...request,
          correction_receipt_key: 'native-family-signup-source-correction-after-cutoff',
          household_id: afterCutoff.householdId,
        },
        { clock: () => new Date(FAMILY_SIGNUP_ACCESS_CORRECTION_EXPIRES_AT) },
      ),
    ).rejects.toThrow(/free_period_cutoff_reached/i);
    await expect(
      countWhere(
        pool as DbPool,
        'family_signup_access_source_correction_receipts',
        'household_id',
        afterCutoff.householdId,
      ),
    ).resolves.toBe(0);
    await expect(
      countWhere(pool as DbPool, 'family_signup_requests', 'household_id', afterCutoff.householdId),
    ).resolves.toBe(0);
    await expect(
      countWhere(pool as DbPool, 'family_signup_outbox', 'household_id', afterCutoff.householdId),
    ).resolves.toBe(0);

    const lockBoundary = await seedParent(
      pool as DbPool,
      'native-correction-lock-boundary',
      0,
      'free',
      false,
      'post_cutover_family_signup',
      FAMILY_SIGNUP_ACCESS_CORRECTION_SOURCE_EFFECTIVE_AT,
      true,
    );
    const lockClient = await pool.connect();
    let trustedNow = new Date('2026-09-11T17:59:59+03:00');
    let trustedClockRead = false;
    try {
      await lockClient.query('BEGIN');
      await lockClient.query('SELECT pg_advisory_xact_lock(hashtext($1))', [
        `family-signup-access-source-correction:${lockBoundary.householdId}`,
      ]);
      const waiting = executeFamilySignupAccessSourceCorrection(
        pool as unknown as DbPool,
        {
          ...request,
          correction_receipt_key: 'native-family-signup-source-correction-lock-boundary',
          household_id: lockBoundary.householdId,
        },
        {
          clock: () => {
            trustedClockRead = true;
            return trustedNow;
          },
        },
      );
      await new Promise<void>((resolve) => setTimeout(resolve, 25));
      expect(trustedClockRead).toBe(false);
      trustedNow = new Date(FAMILY_SIGNUP_ACCESS_CORRECTION_EXPIRES_AT);
      await lockClient.query('COMMIT');
      await expect(waiting).rejects.toThrow(/free_period_cutoff_reached/i);
    } finally {
      await lockClient.query('ROLLBACK');
      lockClient.release();
    }
    await expect(
      countWhere(
        pool as DbPool,
        'family_signup_access_source_correction_receipts',
        'household_id',
        lockBoundary.householdId,
      ),
    ).resolves.toBe(0);
    await expect(
      countWhere(
        pool as DbPool,
        'family_signup_requests',
        'household_id',
        lockBoundary.householdId,
      ),
    ).resolves.toBe(0);
    await expect(
      countWhere(pool as DbPool, 'family_signup_outbox', 'household_id', lockBoundary.householdId),
    ).resolves.toBe(0);
  });
});

function concreteRepository(pool: DbPool) {
  return createPostgresParentHouseholdRepository(pool, {
    acceptedServiceAccountVersion: 'student-service-account-v1',
    immutableEvidenceReference: 'policy://student-service-account/v1',
    portalAccountKey: 'account-test',
    portalProductKey: 'one_time_mishnayos',
    clock: () => now,
  });
}

function concreteService(
  pool: DbPool,
  studentId: string,
  hash: (password: string) => Promise<string> = async () => passwordHash,
) {
  return createParentHouseholdService({
    repository: concreteRepository(pool),
    passwords: { hash },
    ids: { nextStudentId: () => studentId },
  });
}

function mutationContext(suffix: string, hashSeed: string): ParentHouseholdMutationContext {
  return {
    idempotency_key: `parent-${suffix}-0001`,
    canonical_request_hash: hashSeed.repeat(64).slice(0, 64),
    occurred_at: now.toISOString(),
  };
}

async function applyMigrations(pool: DbPool, memory: boolean) {
  await pool.query('CREATE SCHEMA IF NOT EXISTS onetime');
  for (const name of memory ? migrationFiles : nativeMigrationFiles) {
    let sql = await readFile(path.resolve(process.cwd(), 'packages/db/migrations', name), 'utf8');
    if (memory) {
      sql = sql.replace(
        /-- @postgres-only-begin[\s\S]*?-- @postgres-only-end/gu,
        '-- PostgreSQL-only migration proof omitted by pg-mem',
      );
    }
    await pool.query(sql);
  }
}

async function installFamilySignupCutover(pool: DbPool) {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS onetime.schema_migrations (
      id text PRIMARY KEY,
      checksum text NOT NULL,
      applied_at timestamptz NOT NULL DEFAULT now()
    );
  `);
  await pool.query(
    `INSERT INTO onetime.schema_migrations (id, checksum, applied_at)
     VALUES ('2248_v21_family_signup', $1, $2)
     ON CONFLICT (id) DO UPDATE
       SET checksum = EXCLUDED.checksum,
           applied_at = EXCLUDED.applied_at`,
    ['f'.repeat(64), familySignupCutoverAt.toISOString()],
  );
}

async function installClassEnrollmentFixture(pool: DbPool, native = false) {
  if (native) {
    await pool.query(
      `INSERT INTO onetime.class_series
         (class_series_key, account_key, product_key, title, timezone, local_start_time,
          reminder_local_time, status, recurrence_weekdays, recurrence_starts_on,
          duration_minutes, series_state, is_canonical)
       VALUES ('canonical-class', 'account-test', 'one_time_mishnayos', 'Canonical class',
               'Asia/Jerusalem', time '19:00', time '18:30', 'active',
               ARRAY[1,2,3,4,7]::smallint[], DATE '2026-08-16', 60, 'active', true)`,
    );
    return;
  }
  await pool.query(`
    CREATE TABLE onetime.class_series (
      class_series_key text PRIMARY KEY,
      account_key text NOT NULL,
      product_key text NOT NULL,
      status text NOT NULL,
      series_state text NOT NULL,
      is_canonical boolean NOT NULL,
      UNIQUE (account_key, product_key, class_series_key)
    );
    CREATE TABLE onetime.class_series_enrollments (
      enrollment_key text PRIMARY KEY,
      account_key text NOT NULL,
      product_key text NOT NULL,
      class_series_key text NOT NULL,
      learner_key text NOT NULL,
      household_key text NOT NULL,
      enrollment_state text NOT NULL,
      source text NOT NULL,
      effective_at timestamptz NOT NULL,
      revoked_at timestamptz,
      idempotency_key text NOT NULL,
      audit_ref text NOT NULL,
      version bigint NOT NULL,
      UNIQUE (account_key, product_key, class_series_key, learner_key),
      UNIQUE (account_key, product_key, idempotency_key)
    );
    INSERT INTO onetime.class_series
      (class_series_key, account_key, product_key, status, series_state, is_canonical)
    VALUES ('canonical-class', 'account-test', 'one_time_mishnayos', 'active', 'active', true);
  `);
}

async function seedParent(
  pool: DbPool,
  suffix: string,
  activeStudents: number,
  accessState: 'active' | 'free' | 'grace' = 'active',
  includeSignupAccessProjection = true,
  freeProvenance: 'legacy' | 'post_cutover_family_signup' = 'legacy',
  freePeriodEffectiveAt?: string,
  native = false,
) {
  const adultId = `adult-${suffix}`;
  const accountId = `account-${suffix}`;
  const householdId = `household-${suffix}`;
  const sessionId = `session-${suffix}`;
  await pool.query(
    `INSERT INTO onetime.v21_adult_identities
       (adult_id, normalized_email, display_name, state, version, product_key,
        runtime_tier, verification_environment_id, created_at, updated_at)
     VALUES ($1,$2,$3,'active',1,'one_time_mishnayos','isolated_staging','ci',$4,$4)`,
    [adultId, `${suffix}@example.test`, `Owner ${suffix}`, now.toISOString()],
  );
  await pool.query(
    `INSERT INTO onetime.v21_human_accounts
       (human_account_id, adult_id, state, security_version, version, product_key,
        runtime_tier, verification_environment_id, created_at, updated_at)
     VALUES ($1,$2,'active',1,1,'one_time_mishnayos','isolated_staging','ci',$3,$3)`,
    [accountId, adultId, now.toISOString()],
  );
  await pool.query(
    `INSERT INTO onetime.v21_human_account_role_memberships
       (human_account_id, role, granted_at, granted_reason, product_key,
        runtime_tier, verification_environment_id)
     VALUES ($1,'parent',$2,'P12 test','one_time_mishnayos','isolated_staging','ci')`,
    [accountId, now.toISOString()],
  );
  await pool.query(
    `INSERT INTO onetime.v21_households
       (household_id, owner_adult_id, owner_human_account_id, classification,
        state, seat_limit, active_seat_count, access_aggregate_ref, version,
        product_key, runtime_tier, verification_environment_id, created_at, updated_at)
     VALUES ($1,$2,$3,'family','active',3,$4,$5,1,
             'one_time_mishnayos','isolated_staging','ci',$6,$6)`,
    [householdId, adultId, accountId, activeStudents, `access:${householdId}`, now.toISOString()],
  );
  const canonicalEventAt =
    accessState === 'free' &&
    !includeSignupAccessProjection &&
    freeProvenance === 'post_cutover_family_signup'
      ? (freePeriodEffectiveAt ?? new Date(familySignupCutoverAt.getTime() + 60_000).toISOString())
      : now.toISOString();
  const canonicalAccessCause =
    accessState === 'free' &&
    !includeSignupAccessProjection &&
    freeProvenance === 'post_cutover_family_signup'
      ? 'free_period'
      : null;
  const initialCanonicalState = native && accessState !== 'free' ? 'free' : accessState;
  const initialCanonicalCause = native ? 'free_period' : canonicalAccessCause;
  if (!native) {
    await pool.query(
      `INSERT INTO onetime.canonical_aggregate_states
         (aggregate_kind, aggregate_key, current_state, version, product_key,
          runtime_tier, verification_environment_id, last_transition_key,
          created_by_actor_kind, created_by_actor_key, last_mutated_by_actor_kind,
          last_mutated_by_actor_key, created_at, updated_at)
       VALUES ('access',$1,$2,1,'one_time_mishnayos','isolated_staging','ci',$3,
               'system','P12-test','system','P12-test',$4,$4)`,
      [householdId, accessState, `transition-${householdId}`, now.toISOString()],
    );
  }
  await pool.query(
    `INSERT INTO onetime.canonical_state_transition_events
       (transition_key, aggregate_kind, aggregate_key, previous_state, next_state,
        expected_version, resulting_version, product_key, runtime_tier,
        verification_environment_id, actor_kind, actor_key, idempotency_key,
        canonical_request_hash, access_cause, created_at)
     VALUES ($1,'access',$2,NULL,$3,0,1,'one_time_mishnayos','isolated_staging','ci',
             'system','P12-test',$4,$5,$6,$7)`,
    [
      `transition-${householdId}`,
      householdId,
      initialCanonicalState,
      `idempotency-${householdId}`,
      'e'.repeat(64),
      initialCanonicalCause,
      canonicalEventAt,
    ],
  );
  if (native && accessState === 'active') {
    await pool.query(
      `INSERT INTO onetime.canonical_state_transition_events
         (transition_key, aggregate_kind, aggregate_key, previous_state, next_state,
          expected_version, resulting_version, product_key, runtime_tier,
          verification_environment_id, actor_kind, actor_key, idempotency_key,
          canonical_request_hash, access_cause, created_at)
       VALUES ($1,'access',$2,'free','active',1,2,'one_time_mishnayos','isolated_staging','ci',
               'system','P12-test',$3,$4,'verified_paid_or_contract',$5)`,
      [
        `transition-${householdId}-active`,
        householdId,
        `idempotency-${householdId}-active`,
        'd'.repeat(64),
        new Date(Date.parse(canonicalEventAt) + 1_000).toISOString(),
      ],
    );
  }
  if (accessState === 'free' && includeSignupAccessProjection) {
    await pool.query(
      `INSERT INTO onetime.family_signup_access_projections
         (household_id, product, runtime_tier, verification_environment_id,
          access_branch, access_state, seat_limit, active_seat_count,
          free_access_expires_at, checkout_required,
          checkout_blocked_by_identity_review, rolling_trial_granted,
          card_collected, signup_committed_at)
       VALUES ($1,'one_time_mishnayos','isolated_staging','ci','immediate_free','free',
               3,0,'2026-09-13T16:24:00.000Z',false,false,false,false,$2)`,
      [householdId, now.toISOString()],
    );
  }
  await pool.query(
    `INSERT INTO onetime.v21_adult_sessions
       (session_id, human_account_id, active_role, active_household_id,
        access_token_digest, refresh_token_digest, security_version, version,
        idle_expires_at, absolute_expires_at, product_key, runtime_tier,
        verification_environment_id, created_at, updated_at)
     VALUES ($1,$2,'parent',$3,$4,$5,1,1,
             '2026-08-01T14:00:00.000Z','2026-08-30T14:00:00.000Z',
             'one_time_mishnayos','isolated_staging','ci',$6,$6)`,
    [sessionId, accountId, householdId, 'a'.repeat(64), 'b'.repeat(64), now.toISOString()],
  );
  for (let index = 0; index < activeStudents; index += 1) {
    const studentId = `student-${suffix}-${index + 1}`;
    await pool.query(
      `INSERT INTO onetime.v21_student_profiles
         (student_id, household_id, relationship, self_adult_id, actual_name,
          display_name, username, normalized_username, credential_hash,
          credential_version, credential_state, credential_history_ref,
          relationship_history_ref, state, version, product_key, runtime_tier,
          verification_environment_id, created_at, updated_at)
       VALUES ($1,$2,'dependent',NULL,$3,NULL,$4,$4,$5,1,'active',$6,$7,
               'active',1,'one_time_mishnayos','isolated_staging','ci',$8,$8)`,
      [
        studentId,
        householdId,
        `Student ${index + 1}`,
        `${suffix}.student.${index + 1}`,
        passwordHash,
        `credential:${studentId}`,
        `relationship:${studentId}`,
        now.toISOString(),
      ],
    );
  }
  return {
    householdId,
    principal: {
      role: 'parent',
      adult_id: adultId,
      household_id: householdId,
      session_id: sessionId,
    } satisfies ParentHouseholdPrincipal,
  };
}

async function seedStudentAccess(
  pool: DbPool,
  fixture: { householdId: string },
  studentId: string,
) {
  await pool.query(
    `INSERT INTO onetime.classroom_launch_grants_v21
       (grant_id, grant_key_digest, product, runtime_tier, verification_environment_id,
        student_id, household_id, authenticated_session_id, occurrence_id,
        registrant_id, issued_at, expires_at, student_version, enrollment_version,
        access_version, consent_version_digest, registrant_version,
        occurrence_version, version)
     VALUES ('grant-archive',$1,'one_time_mishnayos','isolated_staging','ci',$2,$3,
             'auth-session-archive','occurrence-archive','registrant-archive',$4,$5,
             1,1,1,$6,1,1,1)`,
    [
      'c'.repeat(64),
      studentId,
      fixture.householdId,
      now.toISOString(),
      new Date(now.getTime() + 60_000).toISOString(),
      'd'.repeat(64),
    ],
  );
  await pool.query(
    `INSERT INTO onetime.live_student_classroom_sessions
       (live_session_id, product, runtime_tier, verification_environment_id,
        student_id, household_id, occurrence_id, authenticated_session_id,
        device_lineage_id, state, lease_generation, last_heartbeat_at,
        lease_expires_at, version)
     VALUES ('live-archive','one_time_mishnayos','isolated_staging','ci',$1,$2,
             'occurrence-archive','auth-session-archive','device-archive','active',1,$3,$4,1)`,
    [
      studentId,
      fixture.householdId,
      now.toISOString(),
      new Date(now.getTime() + 90_000).toISOString(),
    ],
  );
}

function failOn(pool: DbPool, fragment: string, transactionLog: string[] = []): DbPool {
  const connect = pool.connect.bind(pool) as unknown as () => Promise<
    Queryable & { release: () => void }
  >;
  return {
    query: pool.query.bind(pool),
    end: pool.end.bind(pool),
    async connect() {
      const client = await connect();
      const wrapped: Queryable & { release: () => void } = {
        release: () => client.release(),
        query: ((text: string, values?: unknown[]) => {
          transactionLog.push(text.trim());
          if (text.includes(fragment)) throw new Error('injected enrollment failure');
          return client.query(text, values);
        }) as Queryable['query'],
      };
      return wrapped;
    },
  } as unknown as DbPool;
}

async function count(pool: DbPool, table: string) {
  const result = await pool.query(`SELECT count(*)::int AS count FROM onetime.${table}`);
  return Number(result.rows[0]?.count);
}

async function countWhere(pool: DbPool, table: string, column: string, value: string) {
  const result = await pool.query(
    `SELECT count(*)::int AS count FROM onetime.${table} WHERE ${column} = $1`,
    [value],
  );
  return Number(result.rows[0]?.count);
}
