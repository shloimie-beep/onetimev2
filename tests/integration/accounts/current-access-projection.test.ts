import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { loadConfig, type AppConfig } from '../../../packages/config/src/index.ts';
import { createMemoryPool, runMigrations, type DbPool } from '../../../packages/db/src/index.ts';
import {
  applyHouseholdAccessState,
  createAccountUser,
  createSession,
  getSessionUserByKey,
  grantFreePilotAccess,
  householdHasLearningAccess,
  readHouseholdAccess,
  revokeFreePilotAccess,
} from '../../../packages/domain/src/index.ts';

let pool: DbPool;
let config: AppConfig;

const accountKey = 'access_projection_account';
const productKey = 'access_projection_product';
const effectiveAt = '2026-07-23T08:00:00.000Z';
const expiresAt = '2026-08-23T08:00:00.000Z';

beforeEach(async () => {
  config = loadConfig({
    NODE_ENV: 'test',
    PUBLIC_BASE_URL: 'https://join.onetimeonetime.com',
    APP_VERSION: 'test',
    COMMIT_SHA: 'test',
    OUTBOX_TRANSPORT_MODE: 'sink',
    ONE_TIME_ACCOUNT_KEY: accountKey,
    ONE_TIME_PRODUCT_KEY: productKey,
  });
  pool = createMemoryPool();
  await runMigrations(pool);
  await seedHousehold('household_alpha');
  await seedHousehold('household_beta');
});

afterEach(async () => {
  await pool.end();
});

describe('canonical current household access projection', () => {
  it('grants a bounded free pilot idempotently without writing payment history', async () => {
    const command = {
      household_key: 'household_alpha',
      idempotency_key: 'pilot-grant-alpha-v1',
      effective_at: effectiveAt,
      expires_at: expiresAt,
      policy_version: 'free-pilot-test-v1',
      opaque_source_reference: 'pilot_alpha_opaque',
    };

    const applied = await grantFreePilotAccess({
      pool,
      accountKey,
      productKey,
      actorKind: 'provisioner',
      command,
      now: new Date('2026-07-23T09:00:00.000Z'),
    });
    expect(applied).toMatchObject({
      state: 'applied',
      sessions_revoked: 0,
      payment_history_written: false,
      projection: {
        household_key: 'household_alpha',
        state: 'active',
        source_kind: 'free_pilot',
        grants_access: true,
      },
    });

    const replayed = await grantFreePilotAccess({
      pool,
      accountKey,
      productKey,
      actorKind: 'provisioner',
      command,
      now: new Date('2026-07-23T09:05:00.000Z'),
    });
    expect(replayed).toMatchObject({
      state: 'replayed',
      payment_history_written: false,
      projection: { access_version: 1 },
    });

    const replayedAfterExpiry = await grantFreePilotAccess({
      pool,
      accountKey,
      productKey,
      actorKind: 'provisioner',
      command,
      now: new Date(expiresAt),
    });
    expect(replayedAfterExpiry).toMatchObject({
      state: 'replayed',
      payment_history_written: false,
      projection: {
        state: 'active',
        grants_access: false,
      },
    });

    const counts = await pool.query(
      `SELECT
         (SELECT count(*)::int FROM onetime.account_access_projections) AS access_count,
         (SELECT count(*)::int FROM onetime.account_access_events) AS event_count,
         (SELECT count(*)::int FROM onetime.billing_entitlement_projections) AS entitlement_count,
         (SELECT count(*)::int FROM onetime.billing_subscription_projections) AS subscription_count`,
    );
    expect({
      access_count: Number(counts.rows[0]?.access_count),
      event_count: Number(counts.rows[0]?.event_count),
      entitlement_count: Number(counts.rows[0]?.entitlement_count),
      subscription_count: Number(counts.rows[0]?.subscription_count),
    }).toEqual({
      access_count: 1,
      event_count: 1,
      entitlement_count: 0,
      subscription_count: 0,
    });

    const event = await pool.query(
      `SELECT source_reference_digest, response_json
         FROM onetime.account_access_events
        WHERE account_key = $1
          AND product_key = $2
          AND idempotency_key = $3`,
      [accountKey, productKey, command.idempotency_key],
    );
    expect(String(event.rows[0]?.source_reference_digest)).toMatch(/^[a-f0-9]{64}$/u);
  });

  it('fails closed on idempotency conflict, stale updates, and lower-precedence sources', async () => {
    const baseCommand = {
      household_key: 'household_alpha',
      state: 'active' as const,
      effective_at: effectiveAt,
      expires_at: null,
      opaque_source_reference: 'ghl_access_alpha',
      source_revision: 2,
      source_updated_at: '2026-07-23T09:00:00.000Z',
      policy_version: 'ghl-access-test-v1',
      revocation_reason: null,
    };
    await applyHouseholdAccessState({
      pool,
      accountKey,
      productKey,
      sourceKind: 'highlevel_payment_state',
      actorKind: 'highlevel_action',
      idempotencyKey: 'ghl-access-alpha-revision-2',
      command: baseCommand,
      now: new Date('2026-07-23T09:00:00.000Z'),
    });

    await expect(
      applyHouseholdAccessState({
        pool,
        accountKey,
        productKey,
        sourceKind: 'highlevel_payment_state',
        actorKind: 'highlevel_action',
        idempotencyKey: 'ghl-access-alpha-stale',
        command: {
          ...baseCommand,
          source_revision: 1,
          source_updated_at: '2026-07-23T08:59:00.000Z',
        },
        now: new Date('2026-07-23T09:01:00.000Z'),
      }),
    ).rejects.toMatchObject({ code: 'ACCESS_SOURCE_STALE' });
    expect(
      (
        await pool.query(
          `SELECT decision
             FROM onetime.account_access_events
            WHERE account_key = $1
              AND product_key = $2
              AND idempotency_key = 'ghl-access-alpha-stale'`,
          [accountKey, productKey],
        )
      ).rows[0]?.decision,
    ).toBe('rejected_stale');

    await applyHouseholdAccessState({
      pool,
      accountKey,
      productKey,
      sourceKind: 'admin_override',
      actorKind: 'admin',
      idempotencyKey: 'admin-suspend-alpha-v1',
      command: {
        ...baseCommand,
        state: 'suspended',
        opaque_source_reference: 'admin_override_alpha',
        source_revision: 1,
        source_updated_at: '2026-07-23T09:02:00.000Z',
        revocation_reason: 'operator_hold',
      },
      now: new Date('2026-07-23T09:02:00.000Z'),
    });

    await expect(
      grantFreePilotAccess({
        pool,
        accountKey,
        productKey,
        actorKind: 'provisioner',
        command: {
          household_key: 'household_alpha',
          idempotency_key: 'pilot-lower-precedence-v1',
          effective_at: effectiveAt,
          expires_at: expiresAt,
          policy_version: 'free-pilot-test-v1',
          opaque_source_reference: 'pilot_alpha_lower',
        },
        now: new Date('2026-07-23T09:03:00.000Z'),
      }),
    ).rejects.toMatchObject({ code: 'ACCESS_SOURCE_PRECEDENCE' });
    expect(
      (
        await pool.query(
          `SELECT decision
             FROM onetime.account_access_events
            WHERE account_key = $1
              AND product_key = $2
              AND idempotency_key = 'pilot-lower-precedence-v1'`,
          [accountKey, productKey],
        )
      ).rows[0]?.decision,
    ).toBe('rejected_precedence');

    await expect(
      applyHouseholdAccessState({
        pool,
        accountKey,
        productKey,
        sourceKind: 'admin_override',
        actorKind: 'admin',
        idempotencyKey: 'admin-suspend-alpha-v1',
        command: {
          ...baseCommand,
          state: 'revoked',
          opaque_source_reference: 'admin_override_alpha',
          source_revision: 2,
          source_updated_at: '2026-07-23T09:04:00.000Z',
          revocation_reason: 'different_command',
        },
        now: new Date('2026-07-23T09:04:00.000Z'),
      }),
    ).rejects.toMatchObject({ code: 'ACCESS_IDEMPOTENCY_CONFLICT' });
  });

  it('rejects future-poisoned source timestamps and overlong free-pilot windows', async () => {
    await expect(
      applyHouseholdAccessState({
        pool,
        accountKey,
        productKey,
        sourceKind: 'highlevel_payment_state',
        actorKind: 'highlevel_action',
        idempotencyKey: 'ghl-access-future-poison-v1',
        command: {
          household_key: 'household_alpha',
          state: 'active',
          effective_at: effectiveAt,
          expires_at: null,
          opaque_source_reference: 'ghl_future_poison',
          source_revision: 1,
          source_updated_at: '2026-07-24T09:00:00.000Z',
          policy_version: 'ghl-access-test-v1',
          revocation_reason: null,
        },
        now: new Date('2026-07-23T09:00:00.000Z'),
      }),
    ).rejects.toMatchObject({ code: 'ACCESS_INVALID_COMMAND' });

    await expect(
      grantFreePilotAccess({
        pool,
        accountKey,
        productKey,
        actorKind: 'provisioner',
        command: {
          household_key: 'household_alpha',
          idempotency_key: 'pilot-overlong-window-v1',
          effective_at: effectiveAt,
          expires_at: '2027-08-01T08:00:00.000Z',
          policy_version: 'free-pilot-test-v1',
          opaque_source_reference: 'pilot_overlong_window',
        },
        now: new Date('2026-07-23T09:00:00.000Z'),
      }),
    ).rejects.toMatchObject({ code: 'ACCESS_INVALID_COMMAND' });
  });

  it.each([
    ['pending', null, false],
    ['active', null, true],
    ['grace', expiresAt, true],
    ['scheduled_end', expiresAt, true],
    ['suspended', null, false],
    ['revoked', null, false],
    ['manual_review', null, false],
  ] as const)(
    'evaluates %s access truth from state, effective time, expiry, and active household',
    async (state, expiry, expected) => {
      const householdKey = `household_state_${state}`;
      await seedHousehold(householdKey);
      await applyHouseholdAccessState({
        pool,
        accountKey,
        productKey,
        sourceKind: 'admin_override',
        actorKind: 'admin',
        idempotencyKey: `state-test-${state}-v1`,
        command: {
          household_key: householdKey,
          state,
          effective_at: effectiveAt,
          expires_at: expiry,
          opaque_source_reference: `state_source_${state}`,
          source_revision: 1,
          source_updated_at: '2026-07-23T09:00:00.000Z',
          policy_version: 'access-state-test-v1',
          revocation_reason: ['suspended', 'revoked', 'manual_review'].includes(state)
            ? `state_${state}`
            : null,
        },
        now: new Date('2026-07-23T09:00:00.000Z'),
      });
      expect(
        await householdHasLearningAccess({
          db: pool,
          accountKey,
          productKey,
          householdKey,
          now: new Date('2026-07-23T09:00:00.000Z'),
        }),
      ).toBe(expected);
    },
  );

  it('treats the exact expiry boundary and inactive household as unavailable', async () => {
    await grantFreePilotAccess({
      pool,
      accountKey,
      productKey,
      actorKind: 'provisioner',
      command: {
        household_key: 'household_alpha',
        idempotency_key: 'pilot-expiry-boundary-v1',
        effective_at: effectiveAt,
        expires_at: expiresAt,
        policy_version: 'free-pilot-test-v1',
        opaque_source_reference: 'pilot_expiry_boundary',
      },
      now: new Date('2026-07-23T09:00:00.000Z'),
    });
    expect(
      (
        await readHouseholdAccess({
          db: pool,
          accountKey,
          productKey,
          householdKey: 'household_alpha',
          now: new Date('2026-08-23T07:59:59.999Z'),
        })
      )?.grants_access,
    ).toBe(true);
    expect(
      (
        await readHouseholdAccess({
          db: pool,
          accountKey,
          productKey,
          householdKey: 'household_alpha',
          now: new Date(expiresAt),
        })
      )?.grants_access,
    ).toBe(false);

    await pool.query(
      `UPDATE onetime.portal_households
          SET status = 'archived'
        WHERE account_key = $1
          AND product_key = $2
          AND household_key = 'household_alpha'`,
      [accountKey, productKey],
    );
    expect(
      await householdHasLearningAccess({
        db: pool,
        accountKey,
        productKey,
        householdKey: 'household_alpha',
        now: new Date('2026-07-23T09:00:00.000Z'),
      }),
    ).toBe(false);
  });

  it('ignores legacy billing rows and remains scoped by account, product, and household', async () => {
    await pool.query(
      `INSERT INTO onetime.billing_entitlement_projections
         (entitlement_key, account_key, product_key, principal_key, principal_type, status,
          policy_version, source, reason, effective_at, evaluated_at)
       VALUES
         ('legacy_entitlement_alpha',$1,$2,'legacy_user_alpha','account_user','active',
          'legacy-policy','legacy-test','historical-only',now(),now())`,
      [accountKey, productKey],
    );
    expect(
      await householdHasLearningAccess({
        db: pool,
        accountKey,
        productKey,
        householdKey: 'household_alpha',
      }),
    ).toBe(false);

    await grantFreePilotAccess({
      pool,
      accountKey,
      productKey,
      actorKind: 'provisioner',
      command: {
        household_key: 'household_alpha',
        idempotency_key: 'pilot-scope-alpha-v1',
        effective_at: effectiveAt,
        expires_at: expiresAt,
        policy_version: 'free-pilot-test-v1',
        opaque_source_reference: 'pilot_scope_alpha',
      },
      now: new Date('2026-07-23T09:00:00.000Z'),
    });
    expect(
      await householdHasLearningAccess({
        db: pool,
        accountKey,
        productKey,
        householdKey: 'household_beta',
        now: new Date('2026-07-23T09:00:00.000Z'),
      }),
    ).toBe(false);
    expect(
      await householdHasLearningAccess({
        db: pool,
        accountKey: 'other_account',
        productKey,
        householdKey: 'household_alpha',
        now: new Date('2026-07-23T09:00:00.000Z'),
      }),
    ).toBe(false);
  });

  it('revokes Parent and Student sessions when a free pilot is revoked', async () => {
    const parentUserKey = await createAccountUser({
      pool,
      config,
      email: 'access-parent@example.test',
      password: 'AccessParent!234',
      displayName: 'Access Parent',
      role: 'parent',
    });
    const studentUserKey = await createAccountUser({
      pool,
      config,
      email: 'access-student@example.test',
      password: 'AccessStudent!234',
      displayName: 'Access Student',
      role: 'student',
    });
    await pool.query(
      `INSERT INTO onetime.portal_guardian_relationships
         (relationship_key, account_key, product_key, household_key, guardian_user_ref,
          relationship_label, authority)
       VALUES
         ('access_parent_relationship',$1,$2,'household_alpha',$3,'Parent','primary_guardian')`,
      [accountKey, productKey, parentUserKey],
    );
    await pool.query(
      `INSERT INTO onetime.portal_learners
         (learner_key, account_key, product_key, household_key, display_name)
       VALUES ('access_student_learner',$1,$2,'household_alpha','Access Student')`,
      [accountKey, productKey],
    );
    await pool.query(
      `INSERT INTO onetime.portal_student_access_state
         (access_state_key, account_key, product_key, household_key, learner_key,
          student_user_ref, status, credential_status)
       VALUES
         ('access_student_state',$1,$2,'household_alpha','access_student_learner',$3,
          'active','parent_managed')`,
      [accountKey, productKey, studentUserKey],
    );
    await grantFreePilotAccess({
      pool,
      accountKey,
      productKey,
      actorKind: 'provisioner',
      command: {
        household_key: 'household_alpha',
        idempotency_key: 'pilot-session-grant-v1',
        effective_at: effectiveAt,
        expires_at: expiresAt,
        policy_version: 'free-pilot-test-v1',
        opaque_source_reference: 'pilot_session_alpha',
      },
      now: new Date('2026-07-23T09:00:00.000Z'),
    });

    const parentSession = await sessionForUser(parentUserKey);
    const studentSession = await sessionForUser(studentUserKey);
    const securityBefore = await pool.query(
      `SELECT user_key, security_version
         FROM onetime.account_users
        WHERE user_key IN ($1,$2)
        ORDER BY user_key`,
      [parentUserKey, studentUserKey],
    );

    const revoked = await revokeFreePilotAccess({
      pool,
      accountKey,
      productKey,
      actorKind: 'admin',
      command: {
        household_key: 'household_alpha',
        idempotency_key: 'pilot-session-revoke-v1',
        revoked_at: '2026-07-23T10:00:00.000Z',
        reason: 'operator_revoked',
        policy_version: 'free-pilot-test-v1',
      },
      now: new Date('2026-07-23T10:00:00.000Z'),
    });
    expect(revoked).toMatchObject({
      state: 'applied',
      sessions_revoked: 2,
      payment_history_written: false,
      projection: { state: 'revoked', grants_access: false },
    });

    const sessions = await pool.query(
      `SELECT session_key, revoked_at
         FROM onetime.user_sessions
        WHERE session_key IN ($1,$2)
        ORDER BY session_key`,
      [parentSession.session_key, studentSession.session_key],
    );
    expect(sessions.rows).toHaveLength(2);
    expect(sessions.rows.every((row) => Boolean(row.revoked_at))).toBe(true);

    const securityAfter = await pool.query(
      `SELECT user_key, security_version
         FROM onetime.account_users
        WHERE user_key IN ($1,$2)
        ORDER BY user_key`,
      [parentUserKey, studentUserKey],
    );
    expect(
      securityAfter.rows.map(
        (row, index) =>
          Number(row.security_version) - Number(securityBefore.rows[index]?.security_version),
      ),
    ).toEqual([1, 1]);
  });
});

async function seedHousehold(householdKey: string) {
  await pool.query(
    `INSERT INTO onetime.portal_households
       (household_key, account_key, product_key, display_name)
     VALUES ($1,$2,$3,$4)`,
    [householdKey, accountKey, productKey, householdKey],
  );
}

async function sessionForUser(userKey: string) {
  const user = await getSessionUserByKey({ pool, config, userKey });
  if (!user) throw new Error(`Missing test user ${userKey}.`);
  return createSession({ pool, config, user, assuranceMethod: 'password' });
}
