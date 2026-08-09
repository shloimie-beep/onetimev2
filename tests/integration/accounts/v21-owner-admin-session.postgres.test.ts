import pg from 'pg';
import { describe, expect, it } from 'vitest';
import { createPostgresV21AdultSessionRuntime } from '../../../apps/web/src/server/features/auth/v21-adult-session.ts';
import { runMigrations } from '../../../packages/db/src/index.ts';
import { createPostgresV21AdultSessionRepository } from '../../../packages/db/src/accounts/v21-household-identity-repository.ts';
import { hashAuthPassword } from '../../../packages/domain/src/auth/policy.ts';

const nativeDatabaseUrl = process.env.OT_P0_NATIVE_DATABASE_URL;
const nativeProofEnabled =
  process.env.OT_P0_NATIVE_POSTGRES_DISPOSABLE === 'true' && Boolean(nativeDatabaseUrl);

describe.runIf(nativeProofEnabled)('OT-P0 native PostgreSQL owner Admin session', () => {
  it('defaults a dual-role owner to Admin and parameterizes readback and cleanup', async () => {
    const pool = new pg.Pool({ connectionString: nativeDatabaseUrl!, max: 2 });
    let ownsNativeSchema = false;
    try {
      const database = await pool.query(
        `SELECT current_database() AS database_name,
                current_setting('server_version') AS server_version`,
      );
      expect(database.rows[0]?.database_name).toBe('ot_p0_owner_session');
      expect(Number.parseInt(String(database.rows[0]?.server_version), 10)).toBeGreaterThanOrEqual(
        16,
      );
      const blank = await pool.query(
        `SELECT count(*)::integer AS table_count
           FROM information_schema.tables
          WHERE table_schema NOT IN ('pg_catalog', 'information_schema')`,
      );
      expect(blank.rows[0]).toEqual({ table_count: 0 });

      ownsNativeSchema = true;
      await runMigrations(pool);

      const now = new Date('2026-08-09T12:00:00.000Z');
      const password = 'native dual role owner password';
      await seedDualRoleOwner(pool, now, password);

      const runtime = createPostgresV21AdultSessionRuntime({
        db: pool,
        hmacSecret: 'ot-p0-native-admin-session-hmac-secret',
        clock: () => new Date(now),
      });
      const login = await runtime.login({
        scope: {
          product: 'one_time_mishnayos',
          runtime_tier: 'isolated_staging',
          verification_environment_id: 'ci',
        },
        email: 'native-dual-role-owner@example.test',
        password,
        now,
      });
      expect(login).toMatchObject({
        handled: true,
        authenticated: true,
        active_role: 'admin',
        role_selection_required: false,
        memberships: ['admin', 'parent'],
        household: null,
      });
      if (!login.handled || !login.authenticated) {
        throw new Error('Native dual-role owner login was not issued.');
      }

      const cookieHeader = `__Host-onetime-session=${encodeURIComponent(
        login.browser_session_token,
      )}`;
      await expect(
        runtime.resolveCookieHeader({ cookie_header: cookieHeader, now }),
      ).resolves.toMatchObject({
        status: 'resolved',
        context: {
          memberships: ['admin', 'parent'],
          session: { activeRole: 'admin', activeHouseholdId: null },
          household: null,
        },
      });

      const repository = createPostgresV21AdultSessionRepository(pool);
      await expect(
        repository.revoke({
          sessionId: 'native_absent_admin_cleanup',
          adultId: 'adult_native_dual_role_owner',
          humanAccountId: 'account_native_dual_role_owner',
          householdId: null,
          activeRole: 'admin',
          runtimeTier: 'isolated_staging',
          verificationEnvironmentId: 'ci',
          securityVersion: 2,
          tokenKind: 'access',
          tokenDigest: 'c'.repeat(64),
          now,
          reason: 'explicit_revocation',
        }),
      ).resolves.toBe(false);

      await expect(
        runtime.logoutCookieHeader({
          cookie_header: cookieHeader,
          csrf_token: login.csrf_token,
          now: new Date(now.getTime() + 1_000),
        }),
      ).resolves.toEqual({ revoked: true });
      await expect(
        runtime.resolveCookieHeader({
          cookie_header: cookieHeader,
          now: new Date(now.getTime() + 1_000),
        }),
      ).resolves.toEqual({ status: 'invalid' });
    } finally {
      if (ownsNativeSchema) await pool.query('DROP SCHEMA IF EXISTS onetime CASCADE');
      await pool.end();
    }
  }, 60_000);
});

async function seedDualRoleOwner(pool: pg.Pool, now: Date, password: string) {
  await pool.query(
    `INSERT INTO onetime.v21_adult_identities
       (adult_id, normalized_email, display_name, state, version, product_key,
        runtime_tier, verification_environment_id, created_at, updated_at)
     VALUES ('adult_native_dual_role_owner', 'native-dual-role-owner@example.test',
             'Native Dual Role Owner', 'active', 1, 'one_time_mishnayos',
             'isolated_staging', 'ci', $1, $1)`,
    [now],
  );
  await pool.query(
    `INSERT INTO onetime.v21_human_accounts
       (human_account_id, adult_id, state, security_version, version, product_key,
        runtime_tier, verification_environment_id, created_at, updated_at)
     VALUES ('account_native_dual_role_owner', 'adult_native_dual_role_owner', 'active', 2, 1,
             'one_time_mishnayos', 'isolated_staging', 'ci', $1, $1)`,
    [now],
  );
  await pool.query(
    `INSERT INTO onetime.v21_human_account_role_memberships
       (human_account_id, role, granted_at, granted_reason, product_key,
        runtime_tier, verification_environment_id)
     VALUES
       ('account_native_dual_role_owner', 'admin', $1, 'native_owner_admin_proof',
        'one_time_mishnayos', 'isolated_staging', 'ci'),
       ('account_native_dual_role_owner', 'parent', $1, 'native_owner_parent_proof',
        'one_time_mishnayos', 'isolated_staging', 'ci')`,
    [now],
  );
  await pool.query(
    `INSERT INTO onetime.v21_adult_credentials
       (human_account_id, adult_id, password_hash, credential_state, credential_version,
        product_key, runtime_tier, verification_environment_id, created_at, updated_at)
     VALUES ('account_native_dual_role_owner', 'adult_native_dual_role_owner', $1,
             'active', 1, 'one_time_mishnayos', 'isolated_staging', 'ci', $2, $2)`,
    [hashAuthPassword(password), now],
  );
  await pool.query(
    `INSERT INTO onetime.v21_households
       (household_id, owner_adult_id, owner_human_account_id, classification,
        state, seat_limit, active_seat_count, access_aggregate_ref, version,
        product_key, runtime_tier, verification_environment_id, created_at, updated_at)
     VALUES ('household_native_dual_role_owner', 'adult_native_dual_role_owner',
             'account_native_dual_role_owner', 'family', 'active', 3, 0,
             'household_native_dual_role_owner', 1, 'one_time_mishnayos',
             'isolated_staging', 'ci', $1, $1)`,
    [now],
  );
  await pool.query(
    `INSERT INTO onetime.canonical_aggregate_states
       (aggregate_kind, aggregate_key, current_state, version, product_key,
        runtime_tier, verification_environment_id, last_transition_key,
        created_by_actor_kind, created_by_actor_key, last_mutated_by_actor_kind,
        last_mutated_by_actor_key, created_at, updated_at)
     VALUES ('access', 'household_native_dual_role_owner', 'active', 1,
             'one_time_mishnayos', 'isolated_staging', 'ci', 'native_owner_access',
             'system', 'ot_p0_native_proof', 'system', 'ot_p0_native_proof', $1, $1)`,
    [now],
  );
}
