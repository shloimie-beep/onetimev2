import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createMemoryPool, runMigrations, type DbPool } from '../../../packages/db/src/index.ts';

let pool: DbPool;

beforeEach(async () => {
  pool = createMemoryPool();
  await runMigrations(pool);
});

afterEach(async () => {
  await pool.end();
});

describe('OT-LIVE-001.03 operator dual-role repair', () => {
  it('adds one Parent membership without duplicating or mutating the existing identity', async () => {
    const occurredAt = new Date('2026-08-04T10:00:00.000Z');
    await pool.query(
      `INSERT INTO onetime.v21_adult_identities
         (adult_id, normalized_email, display_name, state, version, product_key,
          runtime_tier, verification_environment_id, created_at, updated_at)
       VALUES ('adult_operator', 'sdratler@gmail.com', 'Operator Adult', 'active', 1,
               'one_time_mishnayos', 'isolated_staging', 'ci', $1, $1)`,
      [occurredAt],
    );
    await pool.query(
      `INSERT INTO onetime.v21_human_accounts
         (human_account_id, adult_id, state, security_version, version, product_key,
          runtime_tier, verification_environment_id, created_at, updated_at)
       VALUES ('account_operator', 'adult_operator', 'active', 7, 1,
               'one_time_mishnayos', 'isolated_staging', 'ci', $1, $1)`,
      [occurredAt],
    );
    await pool.query(
      `INSERT INTO onetime.v21_human_account_role_memberships
         (human_account_id, role, granted_at, granted_reason, product_key,
          runtime_tier, verification_environment_id)
       VALUES ('account_operator', 'admin', $1, 'existing_admin_membership',
               'one_time_mishnayos', 'isolated_staging', 'ci')`,
      [occurredAt],
    );
    await pool.query(
      `INSERT INTO onetime.v21_adult_credentials
         (human_account_id, adult_id, password_hash, credential_state, credential_version,
          product_key, runtime_tier, verification_environment_id, created_at, updated_at)
       VALUES ('account_operator', 'adult_operator', 'argon2id$existing-credential-hash',
               'active', 4, 'one_time_mishnayos', 'isolated_staging', 'ci', $1, $1)`,
      [occurredAt],
    );
    await pool.query(
      `INSERT INTO onetime.v21_households
         (household_id, owner_adult_id, owner_human_account_id, classification,
          state, seat_limit, active_seat_count, access_aggregate_ref, version,
          product_key, runtime_tier, verification_environment_id, created_at, updated_at)
       VALUES ('household_operator', 'adult_operator', 'account_operator', 'family',
               'active', 3, 0, 'household_operator', 1, 'one_time_mishnayos',
               'isolated_staging', 'ci', $1, $1)`,
      [occurredAt],
    );

    const migration = await readFile(
      path.resolve(process.cwd(), 'packages/db/migrations/2260_operator_dual_role_membership.sql'),
      'utf8',
    );
    await pool.query(migration);
    await pool.query(migration);

    const projection = await pool.query(
      `SELECT
         (SELECT count(*)::integer FROM onetime.v21_adult_identities
           WHERE normalized_email = 'sdratler@gmail.com') AS identity_count,
         (SELECT count(*)::integer FROM onetime.v21_human_accounts
           WHERE adult_id = 'adult_operator') AS account_count,
         (SELECT count(*)::integer FROM onetime.v21_adult_credentials
           WHERE adult_id = 'adult_operator') AS credential_count,
         (SELECT password_hash FROM onetime.v21_adult_credentials
           WHERE adult_id = 'adult_operator') AS password_hash,
         (SELECT credential_version::integer FROM onetime.v21_adult_credentials
           WHERE adult_id = 'adult_operator') AS credential_version,
         (SELECT security_version::integer FROM onetime.v21_human_accounts
           WHERE human_account_id = 'account_operator') AS security_version,
         (SELECT count(*)::integer FROM onetime.v21_households
           WHERE owner_adult_id = 'adult_operator') AS household_count,
         (SELECT count(*)::integer FROM onetime.v21_human_account_role_memberships
           WHERE human_account_id = 'account_operator' AND role = 'admin'
             AND revoked_at IS NULL) AS admin_membership_count,
         (SELECT count(*)::integer FROM onetime.v21_human_account_role_memberships
           WHERE human_account_id = 'account_operator' AND role = 'parent'
             AND revoked_at IS NULL) AS parent_membership_count`,
    );

    const normalizedProjection = Object.fromEntries(
      Object.entries(projection.rows[0] as Record<string, unknown>).map(([key, value]) => [
        key,
        Array.isArray(value) ? value[0] : value,
      ]),
    );
    expect(normalizedProjection).toMatchObject({
      identity_count: 1,
      account_count: 1,
      credential_count: 1,
      password_hash: 'argon2id$existing-credential-hash',
      credential_version: 4,
      security_version: 7,
      household_count: 1,
      admin_membership_count: 1,
      parent_membership_count: 1,
    });
  });
});
