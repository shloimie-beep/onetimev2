import { createHash } from 'node:crypto';
import pg from 'pg';
import { describe, expect, it } from 'vitest';
import { createPostgresV21AdultSessionRuntime } from '../../../apps/web/src/server/features/auth/v21-adult-session.ts';
import { createPostgresParentHouseholdRepository } from '../../../apps/web/src/server/features/portals/parent-household/postgres-repository.ts';
import { createParentHouseholdService } from '../../../apps/web/src/server/features/portals/parent-household/service.ts';
import { loadConfig } from '../../../packages/config/src/index.ts';
import { PARENT_HOUSEHOLD_ERROR_CODES } from '../../../packages/contracts/src/portals/parent-household/index.ts';
import { runMigrations, type DbPool } from '../../../packages/db/src/index.ts';
import {
  CONTROLLER_DUAL_ROLE_ACCESS_EXPIRES_AT,
  CONTROLLER_DUAL_ROLE_PROVISIONING_POLICY,
} from '../../../packages/domain/src/accounts/controller-dual-role-provisioning-policy.ts';
import {
  completePasswordReset,
  requestControllerDualRoleInitialPasswordSetup,
} from '../../../packages/domain/src/accounts/lifecycle.ts';
import { hashAuthPassword } from '../../../packages/domain/src/auth/policy.ts';
import {
  isIsolatedPostgresServerAddress,
  isNativeDisposablePostgresTarget,
  runDualRoleAdultProvision,
} from '../../../scripts/operations/provision-dual-role-adult.ts';

const databaseUrl = process.env.DUAL_ROLE_PROVISION_NATIVE_DATABASE_URL;
const enabled =
  process.env.DUAL_ROLE_PROVISION_NATIVE_POSTGRES_DISPOSABLE === 'true' && Boolean(databaseUrl);
const SOURCE_SHA = 'b'.repeat(40);
const AUTHORIZATION = 'native disposable dual role controller authorization';
const PROVISION_AT = new Date('2026-08-20T12:00:00.000Z');
const EMAIL = 'native-dual-role-controller@example.test';

describe('isolated PostgreSQL server address guard', () => {
  it.each([
    'local_socket',
    '127.0.0.1',
    '127.25.0.9/32',
    '::1',
    '::1/128',
    '10.0.0.8',
    '10.255.255.255/32',
    '172.16.0.1',
    '172.18.0.2/32',
    '172.31.255.254/24',
    '192.168.1.10/32',
  ])('accepts isolated address %s', (address) => {
    expect(isIsolatedPostgresServerAddress(address)).toBe(true);
  });

  it.each([
    '',
    '8.8.8.8',
    '100.64.0.1/32',
    '169.254.1.2/32',
    '172.15.255.255/32',
    '172.32.0.1/32',
    '192.0.2.4/32',
    '192.168.1.1/33',
    '256.0.0.1',
    '::ffff:127.0.0.1',
    'not-an-address',
  ])('rejects non-isolated or malformed address %s', (address) => {
    expect(isIsolatedPostgresServerAddress(address)).toBe(false);
  });
});

describe('native disposable PostgreSQL target guard', () => {
  const databaseName = 'onetime_dual_role_provision_ci_18';
  const safeEnvironment = {
    DUAL_ROLE_PROVISION_NATIVE_POSTGRES_DISPOSABLE: 'true',
    DUAL_ROLE_PROVISION_NATIVE_DATABASE_URL:
      'postgresql://127.0.0.1:5432/onetime_dual_role_provision_ci_18',
    PGHOST: '127.0.0.1',
  };

  it('accepts a private service-container address only behind a loopback disposable connection', () => {
    expect(
      isNativeDisposablePostgresTarget({
        databaseName,
        serverAddress: '172.18.0.2/32',
        environment: safeEnvironment,
      }),
    ).toBe(true);
  });

  it.each([
    {
      name: 'remote connection URL',
      databaseName,
      environment: {
        ...safeEnvironment,
        DUAL_ROLE_PROVISION_NATIVE_DATABASE_URL:
          'postgresql://10.0.0.8:5432/onetime_dual_role_provision_ci_18',
      },
    },
    {
      name: 'remote PGHOST',
      databaseName,
      environment: { ...safeEnvironment, PGHOST: '10.0.0.8' },
    },
    {
      name: 'URL database mismatch',
      databaseName,
      environment: {
        ...safeEnvironment,
        DUAL_ROLE_PROVISION_NATIVE_DATABASE_URL:
          'postgresql://127.0.0.1:5432/onetime_dual_role_provision_ci_16',
      },
    },
    {
      name: 'unapproved database suffix',
      databaseName: 'onetime_dual_role_provision_ci_other',
      environment: {
        ...safeEnvironment,
        DUAL_ROLE_PROVISION_NATIVE_DATABASE_URL:
          'postgresql://127.0.0.1:5432/onetime_dual_role_provision_ci_other',
      },
    },
    {
      name: 'public server address',
      databaseName,
      serverAddress: '8.8.8.8/32',
      environment: safeEnvironment,
    },
    {
      name: 'malformed server address',
      databaseName,
      serverAddress: 'not-an-address',
      environment: safeEnvironment,
    },
  ])('rejects $name', ({ databaseName: candidateDatabase, serverAddress, environment }) => {
    expect(
      isNativeDisposablePostgresTarget({
        databaseName: candidateDatabase,
        serverAddress: serverAddress ?? '172.18.0.2/32',
        environment,
      }),
    ).toBe(false);
  });
});

describe.runIf(enabled)('controller dual-role provisioning on native PostgreSQL', () => {
  it('is concurrent-idempotent and authorizes the real Parent mutation only for its exact unexpired chain', async () => {
    const pool = new pg.Pool({ connectionString: databaseUrl!, max: 6 });
    let ownsSchema = false;
    try {
      const database = await pool.query(
        `SELECT current_database() AS database_name,
                current_setting('server_version') AS server_version,
                COALESCE(inet_server_addr()::text, 'local_socket') AS server_address`,
      );
      expect(String(database.rows[0]?.database_name)).toMatch(
        /^onetime_dual_role_provision_ci_(16|18)$/u,
      );
      expect(Number.parseInt(String(database.rows[0]?.server_version), 10)).toBeGreaterThanOrEqual(
        16,
      );
      expect(
        isNativeDisposablePostgresTarget({
          databaseName: String(database.rows[0]?.database_name),
          serverAddress: String(database.rows[0]?.server_address),
        }),
      ).toBe(true);
      const blank = await pool.query(
        `SELECT count(*)::integer AS table_count
           FROM information_schema.tables
          WHERE table_schema NOT IN ('pg_catalog','information_schema')`,
      );
      expect(blank.rows[0]).toEqual({ table_count: 0 });
      ownsSchema = true;
      await runMigrations(pool);
      await seedCanonicalClass(pool);

      const config = nativeConfig();
      const manifest = privateManifest();
      let proofToken: string | undefined;
      const apply = () =>
        runDualRoleAdultProvision({
          manifest,
          apply: true,
          authorizationPhrase: AUTHORIZATION,
          pool,
          config,
          now: PROVISION_AT,
          testOnlyAllowIsolatedApply: true,
          issuePasswordReset: async (input) => {
            const issued = await requestControllerDualRoleInitialPasswordSetup({
              ...input,
              includeLocalProofToken: true,
            });
            if ('token_for_local_proof' in issued) proofToken = issued.token_for_local_proof;
            return issued;
          },
        });
      const reports = await Promise.all([apply(), apply()]);
      expect(reports.map((report) => report.status).sort()).toEqual(['applied', 'replayed']);
      expect(proofToken).toBeTruthy();
      await expect(cardinalities(pool)).resolves.toEqual({
        adults: 1,
        accounts: 1,
        credentials: 1,
        memberships: 2,
        households: 1,
        canonicalTransitions: 2,
        accessSources: 1,
        accessProjections: 1,
        accessEvents: 1,
        setupTokens: 1,
        setupIntents: 1,
        setupOutbox: 1,
      });
      await expect(forbiddenCardinalities(pool)).resolves.toEqual({
        legacyUsers: 0,
        contacts: 0,
        students: 0,
        guardianConsents: 0,
        privacyConsents: 0,
        providerReassociations: 0,
        adultGhlLinks: 0,
        ghlSyncOperations: 0,
        ghlHouseholdProjections: 0,
        householdProviderMappings: 0,
        billingIntents: 0,
      });

      await completePasswordReset({
        pool,
        config,
        payload: {
          token: proofToken!,
          password: 'native controller password phrase',
          password_confirmation: 'native controller password phrase',
        },
        now: new Date(PROVISION_AT.getTime() + 60_000),
      });
      const accessExpiresAt = Date.parse(CONTROLLER_DUAL_ROLE_ACCESS_EXPIRES_AT);
      const loginAt = new Date(accessExpiresAt - 10 * 60_000);
      const switchAt = new Date(accessExpiresAt - 9 * 60_000);
      const runtime = createPostgresV21AdultSessionRuntime({
        db: pool,
        hmacSecret: config.authCsrfSecret,
        clock: () => loginAt,
      });
      const login = await runtime.login({
        scope: {
          product: 'one_time_mishnayos',
          runtime_tier: 'isolated_staging',
          verification_environment_id: 'ci',
        },
        email: EMAIL,
        password: 'native controller password phrase',
        now: loginAt,
      });
      expect(login).toMatchObject({
        handled: true,
        authenticated: true,
        active_role: 'admin',
        memberships: ['admin', 'parent'],
        household: null,
      });
      if (!login.handled || !login.authenticated) throw new Error('Native login unavailable.');
      const switched = await runtime.switchRoleCookieHeader({
        cookie_header: `__Host-onetime-session=${login.browser_session_token}`,
        csrf_token: login.csrf_token,
        requested_role: 'parent',
        now: switchAt,
      });
      expect(switched).toMatchObject({ switched: true, active_role: 'parent' });
      if (!switched.switched) throw new Error('Native Parent role switch unavailable.');
      const resolved = await runtime.resolveCookieHeader({
        cookie_header: `__Host-onetime-session=${switched.browser_session_token}`,
        now: switchAt,
      });
      if (resolved.status !== 'resolved' || !resolved.context.household) {
        throw new Error('Native Parent session unavailable.');
      }
      const principal = {
        role: 'parent' as const,
        adult_id: resolved.context.adultId,
        household_id: resolved.context.household.householdId,
        session_id: resolved.context.session.sessionId,
      };
      const beforeExpiry = new Date(accessExpiresAt - 1);

      await pool.query(`UPDATE onetime.account_access_projections SET source_request_hash=$1`, [
        'f'.repeat(64),
      ]);
      await expect(
        studentService(pool, 'native-mismatch-student', beforeExpiry).createStudent(
          principal,
          studentInput('native.mismatch.student'),
          mutation('native-mismatch-student-0001', beforeExpiry, 'c'),
        ),
      ).rejects.toMatchObject({
        code: PARENT_HOUSEHOLD_ERROR_CODES.householdMissing,
        message: 'This Parent household is unavailable.',
      });
      await expect(count(pool, 'v21_student_profiles')).resolves.toBe(0);
      await pool.query(
        `UPDATE onetime.account_access_projections AS projection
            SET source_request_hash=event.request_hash
           FROM onetime.account_access_events AS event
          WHERE event.event_key=projection.last_event_key`,
      );

      const created = await studentService(
        pool,
        'native-positive-student',
        beforeExpiry,
      ).createStudent(
        principal,
        studentInput('native.positive.student'),
        mutation('native-positive-student-0001', beforeExpiry, 'd'),
      );
      expect(created.snapshot).toMatchObject({ active_student_count: 1, revision: 2 });
      await expect(forbiddenCardinalities(pool)).resolves.toEqual({
        legacyUsers: 1,
        contacts: 0,
        students: 1,
        guardianConsents: 0,
        privacyConsents: 0,
        providerReassociations: 0,
        adultGhlLinks: 0,
        ghlSyncOperations: 0,
        ghlHouseholdProjections: 0,
        householdProviderMappings: 0,
        billingIntents: 0,
      });

      const atExpiry = new Date(CONTROLLER_DUAL_ROLE_ACCESS_EXPIRES_AT);
      await expect(
        studentService(pool, 'native-expired-student', atExpiry).createStudent(
          principal,
          { ...studentInput('native.expired.student'), expected_revision: 2 },
          mutation('native-expired-student-0001', atExpiry, 'e'),
        ),
      ).rejects.toMatchObject({
        code: PARENT_HOUSEHOLD_ERROR_CODES.householdMissing,
        message: 'This Parent household is unavailable.',
      });
      await expect(count(pool, 'v21_student_profiles')).resolves.toBe(1);
      await expect(
        pool.query(
          `SELECT count(*)::integer AS count
             FROM onetime.family_signup_requests
            WHERE household_id=$1`,
          [principal.household_id],
        ),
      ).resolves.toMatchObject({ rows: [{ count: 0 }] });
    } finally {
      if (ownsSchema) await pool.query('DROP SCHEMA IF EXISTS onetime CASCADE');
      await pool.end();
    }
  }, 90_000);
});

function nativeConfig() {
  return loadConfig({
    NODE_ENV: 'test',
    PUBLIC_BASE_URL: 'https://join.onetimeonetime.com',
    DELIVERY_ENVIRONMENT: 'isolated_staging',
    ONE_TIME_RUNTIME_ENVIRONMENT: 'isolated_staging',
    ONE_TIME_VERIFICATION_ENVIRONMENT_ID: 'ci',
    APP_VERSION: 'test',
    COMMIT_SHA: SOURCE_SHA,
    RAILWAY_PROJECT_ID: 'native-test-project',
    RAILWAY_ENVIRONMENT_ID: 'native-test-environment',
    RAILWAY_SERVICE_ID: 'native-test-service',
    AUTH_CSRF_SECRET: 'native-dual-role-controller-auth-csrf-secret',
    ONE_TIME_LIFECYCLE_DELIVERY_KEY: 'native-dual-role-controller-delivery-key-value',
    OUTBOX_TRANSPORT_MODE: 'sink',
    PARENT_STUDENT_SERVICE_ACCOUNT_VERSION: 'native-parent-student-service-v1',
    PARENT_STUDENT_SERVICE_ACCOUNT_EVIDENCE_REFERENCE: 'native-evidence/parent-student-v1',
  });
}

function privateManifest() {
  return {
    schema_version: 'onetime.controller.dual_role_adult_provision.v1',
    operation_id: 'native-dual-role-controller-proof',
    authorized_at: PROVISION_AT.toISOString(),
    expires_at: new Date(PROVISION_AT.getTime() + 60 * 60 * 1000).toISOString(),
    expected_runtime_source_sha: SOURCE_SHA,
    authorization_phrase_sha256: createHash('sha256').update(AUTHORIZATION).digest('hex'),
    railway: {
      project_id: 'native-test-project',
      environment_id: 'native-test-environment',
      service_id: 'native-test-service',
    },
    scope: {
      account_key: 'one_time',
      product_key: 'one_time_mishnayos',
      runtime_tier: 'isolated_staging',
      verification_environment_id: 'ci',
    },
    adult: {
      email: EMAIL,
      display_name: 'Synthetic Dual Role Adult',
      household_display_name: 'Synthetic Native Dual Role Family',
      roles: ['admin', 'parent'],
      separate_family_household: true,
      canonical_access_state: 'free',
      compatibility_access: {
        source_kind: 'admin_override',
        actor_kind: 'provisioner',
        policy_version: CONTROLLER_DUAL_ROLE_PROVISIONING_POLICY,
        expires_at: CONTROLLER_DUAL_ROLE_ACCESS_EXPIRES_AT,
      },
      setup_delivery: { purpose: 'password_reset', send_now: true, max_message_count: 1 },
    },
    preconditions: {
      identity: 'absent_or_exact_replay',
      legacy_account_user_count: 0,
      local_contact_count: 0,
    },
    prohibited_effects: {
      create_legacy_account_user: false,
      create_contact_or_ghl_projection: false,
      create_student: false,
      create_billing_or_payment_state: false,
      record_terms_privacy_or_marketing_consent: false,
    },
  } as const;
}

function studentService(pool: DbPool, studentId: string, clock: Date) {
  return createParentHouseholdService({
    repository: createPostgresParentHouseholdRepository(pool, {
      acceptedServiceAccountVersion: 'native-parent-student-service-v1',
      immutableEvidenceReference: 'native-evidence/parent-student-v1',
      portalAccountKey: 'one_time',
      portalProductKey: 'one_time_mishnayos',
      clock: () => clock,
    }),
    passwords: { hash: async (password) => hashAuthPassword(password) },
    ids: { nextStudentId: () => studentId },
  });
}

function studentInput(username: string) {
  return {
    expected_revision: 1,
    actual_name: 'Native Synthetic Student',
    display_name: null,
    username,
    relationship: 'dependent' as const,
    new_password: '000123',
    password_confirmation: '000123',
  };
}

function mutation(idempotencyKey: string, occurredAt: Date, hashDigit: string) {
  return {
    idempotency_key: idempotencyKey,
    canonical_request_hash: hashDigit.repeat(64),
    occurred_at: occurredAt.toISOString(),
  };
}

async function seedCanonicalClass(pool: DbPool) {
  await pool.query(
    `INSERT INTO onetime.class_series
       (class_series_key, account_key, product_key, title, timezone, local_start_time,
        reminder_local_time, status, series_state, is_canonical)
     VALUES ('native-dual-role-canonical-class','one_time','one_time_mishnayos',
             'Native canonical class','Asia/Jerusalem','19:00','18:30','active','active',true)`,
  );
}

async function cardinalities(pool: DbPool) {
  return {
    adults: await count(pool, 'v21_adult_identities'),
    accounts: await count(pool, 'v21_human_accounts'),
    credentials: await count(pool, 'v21_adult_credentials'),
    memberships: await count(pool, 'v21_human_account_role_memberships'),
    households: await count(pool, 'v21_households'),
    canonicalTransitions: await count(pool, 'canonical_state_transition_events'),
    accessSources: await count(pool, 'account_access_source_states'),
    accessProjections: await count(pool, 'account_access_projections'),
    accessEvents: await count(pool, 'account_access_events'),
    setupTokens: await count(pool, 'account_lifecycle_tokens'),
    setupIntents: await count(pool, 'account_lifecycle_delivery_intents'),
    setupOutbox: await count(pool, 'account_lifecycle_delivery_outbox'),
  };
}

async function forbiddenCardinalities(pool: DbPool) {
  return {
    legacyUsers: await count(pool, 'account_users'),
    contacts: await count(pool, 'contacts'),
    students: await count(pool, 'v21_student_profiles'),
    guardianConsents: await count(pool, 'portal_guardian_consents'),
    privacyConsents: await count(pool, 'privacy_consent_event'),
    providerReassociations: await count(pool, 'v21_provider_reassociation_intents'),
    adultGhlLinks: await count(pool, 'adult_ghl_identity_link'),
    ghlSyncOperations: await count(pool, 'ghl_identity_sync_operation'),
    ghlHouseholdProjections: await count(pool, 'ghl_household_identity_projection'),
    householdProviderMappings: await count(pool, 'household_provider_mapping'),
    billingIntents: await count(pool, 'billing_ghl_lifecycle_intents'),
  };
}

async function count(pool: DbPool, table: string) {
  const result = await pool.query(`SELECT count(*)::integer AS count FROM onetime.${table}`);
  return Number(result.rows[0]?.count ?? 0);
}
