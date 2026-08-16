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
  CONTROLLER_DUAL_ROLE_APPLY_STAGES,
  isIsolatedPostgresServerAddress,
  isNativeDisposablePostgresTarget,
  runDualRoleAdultProvision,
  type ControllerDualRoleTransactionalReadbackGroup,
} from '../../../scripts/operations/provision-dual-role-adult.ts';

const databaseUrl = process.env.DUAL_ROLE_PROVISION_NATIVE_DATABASE_URL;
const enabled =
  process.env.DUAL_ROLE_PROVISION_NATIVE_POSTGRES_DISPOSABLE === 'true' && Boolean(databaseUrl);
const SOURCE_SHA = 'b'.repeat(40);
const AUTHORIZATION = 'native disposable dual role controller authorization';
const PROVISION_AT = new Date('2026-08-01T12:00:00.000Z');
const EMAIL = 'native-dual-role-controller@example.test';
const COMPATIBILITY_ACCESS_DIAGNOSTIC_CODES = [
  'compatibility_access_cardinality_mismatch',
  'compatibility_access_portal_mismatch',
  'compatibility_access_projection_mismatch',
  'compatibility_access_source_mismatch',
  'compatibility_access_timing_mismatch',
  'compatibility_access_expiry_mismatch',
  'compatibility_access_revision_mismatch',
  'compatibility_access_policy_mismatch',
  'compatibility_access_reference_mismatch',
  'compatibility_access_hash_mismatch',
  'compatibility_access_event_link_mismatch',
  'compatibility_access_event_body_mismatch',
  'compatibility_access_event_created_mismatch',
  'compatibility_access_idempotency_mismatch',
] as const;

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
      const beforeFailures = await cardinalities(pool);
      for (const stage of CONTROLLER_DUAL_ROLE_APPLY_STAGES) {
        let setupCalls = 0;
        const failure = await runDualRoleAdultProvision({
          manifest,
          apply: true,
          authorizationPhrase: AUTHORIZATION,
          pool,
          config,
          now: PROVISION_AT,
          testOnlyAllowIsolatedApply: true,
          testOnlyFailApplyStage: stage,
          issuePasswordReset: async () => {
            setupCalls += 1;
            throw new Error('Setup must not run after identity failure.');
          },
        });
        expect(failure).toMatchObject({
          status: 'blocked',
          blockers: [`apply_identity_${stage}_failed`],
          apply_execution: {
            bounded_watchdog: true,
            disposition: 'failed',
            transaction_outcome: stage === 'transaction_begin' ? 'not_started' : 'rolled_back',
            reconciliation_outcome: 'completed',
            final_stage: stage,
            transactional_readback_diagnostic: null,
          },
          identity: { disposition: 'absent', adult_rows: 0 },
          setup_delivery: { token_rows: 0, intent_rows: 0, outbox_rows: 0 },
        });
        expect(failure.apply_execution.journal.at(-1)).toEqual({
          sequence: failure.apply_execution.journal.length,
          stage,
          state: 'failed',
        });
        expect(setupCalls).toBe(0);
        await expect(cardinalities(pool)).resolves.toEqual(beforeFailures);
      }
      for (const stage of CONTROLLER_DUAL_ROLE_APPLY_STAGES.filter(
        (candidate) => candidate !== 'transaction_commit',
      )) {
        let setupCalls = 0;
        const stalled = await runDualRoleAdultProvision({
          manifest,
          apply: true,
          authorizationPhrase: AUTHORIZATION,
          pool,
          config,
          now: PROVISION_AT,
          testOnlyAllowIsolatedApply: true,
          testOnlyStallApplyStage: stage,
          testOnlyApplyStageTimeoutMs: 250,
          issuePasswordReset: async () => {
            setupCalls += 1;
            throw new Error('Setup must not run after an identity timeout.');
          },
        });
        expect(stalled).toMatchObject({
          status: 'blocked',
          blockers: [`apply_identity_${stage}_timed_out`],
          apply_execution: {
            bounded_watchdog: true,
            disposition: 'timed_out',
            transaction_outcome: 'rolled_back',
            reconciliation_outcome: 'completed',
            final_stage: stage,
            transactional_readback_diagnostic: null,
          },
          identity: { disposition: 'absent', adult_rows: 0 },
          setup_delivery: { token_rows: 0, intent_rows: 0, outbox_rows: 0 },
        });
        expect(stalled.apply_execution.journal.at(-1)).toEqual({
          sequence: stalled.apply_execution.journal.length,
          stage,
          state: 'timed_out',
        });
        expect(setupCalls).toBe(0);
        await expect(cardinalities(pool)).resolves.toEqual(beforeFailures);
      }
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
      expect(
        reports.every(
          (report) => report.apply_execution.transactional_readback_diagnostic === null,
        ),
      ).toBe(true);
      expect(proofToken).toBeTruthy();
      await expect(cardinalities(pool)).resolves.toEqual({
        adults: 1,
        accounts: 1,
        credentials: 1,
        memberships: 2,
        households: 1,
        canonicalTransitions: 2,
        canonicalStates: 2,
        portalHouseholds: 1,
        accessSources: 1,
        accessProjections: 1,
        accessEvents: 1,
        audits: 2,
        setupTokens: 1,
        setupIntents: 1,
        setupOutbox: 1,
      });
      await expect(accessEventCreatedAt(pool)).resolves.toBe(PROVISION_AT.toISOString());
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
        code: PARENT_HOUSEHOLD_ERROR_CODES.persistenceInvariant,
        message: 'The household access source is unavailable.',
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
      await expect(accessEventCreatedAt(pool)).resolves.toBe(PROVISION_AT.toISOString());
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
        code: PARENT_HOUSEHOLD_ERROR_CODES.persistenceInvariant,
        message: 'The household access source is unavailable.',
      });
      await expect(count(pool, 'v21_student_profiles')).resolves.toBe(1);
      await expect(accessEventCreatedAt(pool)).resolves.toBe(PROVISION_AT.toISOString());
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
  }, 120_000);

  it('rolls back every compatibility leaf and representative failures for every fixed group', async () => {
    const nativePool = new pg.Pool({ connectionString: databaseUrl!, max: 4 });
    const faultControl: NativeTransactionalReadbackFaultControl = {};
    const pool = nativeTransactionalReadbackFaultPool(nativePool, faultControl);
    let ownsSchema = false;
    try {
      const database = await pool.query(
        `SELECT current_database() AS database_name,
                COALESCE(inet_server_addr()::text, 'local_socket') AS server_address`,
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
      const mismatchCases: Array<{
        name: string;
        group: ControllerDualRoleTransactionalReadbackGroup;
        blocker: string;
        queryIncludes: string;
        mutateRows: (rows: Record<string, unknown>[]) => Record<string, unknown>[];
      }> = [
        {
          name: 'core',
          group: 'core_identity',
          blocker: 'canonical_adult_mismatch',
          queryIncludes: 'WHERE normalized_email = $1',
          mutateRows: (rows) =>
            rows.map((row, index) =>
              index === 0 ? { ...row, display_name: 'Native readback mismatch' } : row,
            ),
        },
        {
          name: 'canonical',
          group: 'canonical',
          blocker: 'canonical_transition_mismatch',
          queryIncludes: 'FROM onetime.canonical_state_transition_events',
          mutateRows: (rows) => rows.map((row) => ({ ...row, actor_kind: 'readback_mismatch' })),
        },
        {
          name: 'compatibility-cardinality',
          group: 'compatibility_access',
          blocker: 'compatibility_access_cardinality_mismatch',
          queryIncludes: 'FROM onetime.portal_households AS portal',
          mutateRows: () => [],
        },
        {
          name: 'compatibility-portal',
          group: 'compatibility_access',
          blocker: 'compatibility_access_portal_mismatch',
          queryIncludes: 'FROM onetime.portal_households AS portal',
          mutateRows: (rows) => rows.map((row) => ({ ...row, portal_version: 2 })),
        },
        {
          name: 'compatibility-projection',
          group: 'compatibility_access',
          blocker: 'compatibility_access_projection_mismatch',
          queryIncludes: 'FROM onetime.portal_households AS portal',
          mutateRows: (rows) => rows.map((row) => ({ ...row, state: 'readback_mismatch' })),
        },
        {
          name: 'compatibility-source',
          group: 'compatibility_access',
          blocker: 'compatibility_access_source_mismatch',
          queryIncludes: 'FROM onetime.portal_households AS portal',
          mutateRows: (rows) => rows.map((row) => ({ ...row, source_state: 'readback_mismatch' })),
        },
        {
          name: 'compatibility-timing',
          group: 'compatibility_access',
          blocker: 'compatibility_access_timing_mismatch',
          queryIncludes: 'FROM onetime.portal_households AS portal',
          mutateRows: (rows) =>
            rows.map((row) => ({ ...row, source_updated_at: '2999-01-01T00:00:00.000Z' })),
        },
        {
          name: 'compatibility-expiry',
          group: 'compatibility_access',
          blocker: 'compatibility_access_expiry_mismatch',
          queryIncludes: 'FROM onetime.portal_households AS portal',
          mutateRows: (rows) => rows.map((row) => ({ ...row, expires_at: null })),
        },
        {
          name: 'compatibility-revision',
          group: 'compatibility_access',
          blocker: 'compatibility_access_revision_mismatch',
          queryIncludes: 'FROM onetime.portal_households AS portal',
          mutateRows: (rows) => rows.map((row) => ({ ...row, event_source_revision: 2 })),
        },
        {
          name: 'compatibility-policy',
          group: 'compatibility_access',
          blocker: 'compatibility_access_policy_mismatch',
          queryIncludes: 'FROM onetime.portal_households AS portal',
          mutateRows: (rows) =>
            rows.map((row) => ({ ...row, policy_version: 'readback_mismatch' })),
        },
        {
          name: 'compatibility-reference',
          group: 'compatibility_access',
          blocker: 'compatibility_access_reference_mismatch',
          queryIncludes: 'FROM onetime.portal_households AS portal',
          mutateRows: (rows) =>
            rows.map((row) => ({ ...row, opaque_source_reference: 'readback_mismatch' })),
        },
        {
          name: 'compatibility-hash',
          group: 'compatibility_access',
          blocker: 'compatibility_access_hash_mismatch',
          queryIncludes: 'FROM onetime.portal_households AS portal',
          mutateRows: (rows) =>
            rows.map((row) => ({ ...row, projection_request_hash: '0'.repeat(64) })),
        },
        {
          name: 'compatibility-event-link',
          group: 'compatibility_access',
          blocker: 'compatibility_access_event_link_mismatch',
          queryIncludes: 'FROM onetime.portal_households AS portal',
          mutateRows: (rows) =>
            rows.map((row) => ({ ...row, source_last_event_key: 'readback_mismatch' })),
        },
        {
          name: 'compatibility-event-body',
          group: 'compatibility_access',
          blocker: 'compatibility_access_event_body_mismatch',
          queryIncludes: 'FROM onetime.portal_households AS portal',
          mutateRows: (rows) => rows.map((row) => ({ ...row, actor_kind: 'readback_mismatch' })),
        },
        {
          name: 'compatibility-event-created',
          group: 'compatibility_access',
          blocker: 'compatibility_access_event_created_mismatch',
          queryIncludes: 'FROM onetime.portal_households AS portal',
          mutateRows: (rows) =>
            rows.map((row) => ({ ...row, event_created_at: '2999-01-01T00:00:00.000Z' })),
        },
        {
          name: 'compatibility-idempotency',
          group: 'compatibility_access',
          blocker: 'compatibility_access_idempotency_mismatch',
          queryIncludes: 'FROM onetime.portal_households AS portal',
          mutateRows: (rows) =>
            rows.map((row) => ({ ...row, idempotency_key: 'readback_mismatch' })),
        },
        {
          name: 'audit',
          group: 'provision_audit',
          blocker: 'controller_provision_audit_mismatch',
          queryIncludes: 'FROM onetime.account_lifecycle_audit_events',
          mutateRows: () => [],
        },
        {
          name: 'prohibited',
          group: 'prohibited',
          blocker: 'prohibited_projection_present',
          queryIncludes: 'FROM onetime.family_signup_requests',
          mutateRows: (rows) => rows.map((row) => ({ ...row, count: 1 })),
        },
      ];
      const queryFailureCases: Array<{
        group: ControllerDualRoleTransactionalReadbackGroup;
        queryIncludes: string;
      }> = [
        { group: 'core_identity', queryIncludes: 'WHERE normalized_email = $1' },
        { group: 'canonical', queryIncludes: 'FROM onetime.canonical_aggregate_states' },
        {
          group: 'compatibility_access',
          queryIncludes: 'FROM onetime.portal_households AS portal',
        },
        {
          group: 'provision_audit',
          queryIncludes: 'FROM onetime.account_lifecycle_audit_events',
        },
        { group: 'prohibited', queryIncludes: 'FROM onetime.family_signup_requests' },
      ];
      expect(
        mismatchCases
          .filter((testCase) => testCase.group === 'compatibility_access')
          .map((testCase) => testCase.blocker),
      ).toEqual(COMPATIBILITY_ACCESS_DIAGNOSTIC_CODES);

      for (const testCase of mismatchCases) {
        const operationNow = new Date(Math.floor(Date.now() / 1000) * 1000);
        const email = `native-readback-${testCase.name}@example.test`;
        await seedNativeUnrelatedEventRegistration(pool, email, operationNow);
        const before = await fullControllerCardinalities(pool);
        faultControl.faults = [
          {
            queryIncludes: testCase.queryIncludes,
            mutateRows: testCase.mutateRows,
          },
        ];
        let setupCalls = 0;
        const report = await runDualRoleAdultProvision({
          manifest: privateManifestAt(email, `native-readback-${testCase.name}`, operationNow),
          apply: true,
          authorizationPhrase: AUTHORIZATION,
          pool,
          config,
          now: operationNow,
          testOnlyAllowIsolatedApply: true,
          issuePasswordReset: async () => {
            setupCalls += 1;
            throw new Error('Setup must not run after native readback mismatch.');
          },
        });
        const expectedDiagnostic = {
          groups: [{ group_code: testCase.group, blocker_codes: [testCase.blocker] }],
        };
        expect(report).toMatchObject({
          status: 'blocked',
          blockers: ['apply_identity_transactional_readback_failed'],
          generated_at: operationNow.toISOString(),
          apply_execution: {
            disposition: 'failed',
            transaction_outcome: 'rolled_back',
            reconciliation_outcome: 'completed',
            final_stage: 'transactional_readback',
            transactional_readback_diagnostic: expectedDiagnostic,
          },
          identity: { disposition: 'absent', adult_rows: 0 },
          setup_delivery: { token_rows: 0, intent_rows: 0, outbox_rows: 0 },
        });
        expect(report.apply_execution.journal.at(-1)).toEqual({
          sequence: report.apply_execution.journal.length,
          stage: 'transactional_readback',
          state: 'failed',
          transactional_readback_diagnostic: expectedDiagnostic,
        });
        expect(setupCalls).toBe(0);
        await expect(fullControllerCardinalities(pool)).resolves.toEqual(before);
        await expect(nativeUnrelatedEventRegistrationCount(pool, email)).resolves.toBe(1);
        const serialized = JSON.stringify(report);
        expect(serialized).not.toContain(email);
        expect(serialized).not.toContain('Synthetic Dual Role Adult');
        expect(serialized).not.toContain('@');
        expect(serialized).not.toContain('SELECT');
      }

      for (const testCase of queryFailureCases) {
        const operationNow = new Date(Math.floor(Date.now() / 1000) * 1000);
        const email = `native-readback-query-${testCase.group.replaceAll('_', '-')}@example.test`;
        await seedNativeUnrelatedEventRegistration(pool, email, operationNow);
        const before = await fullControllerCardinalities(pool);
        faultControl.faults = [
          {
            queryIncludes: testCase.queryIncludes,
            throwRawQueryError: true,
          },
        ];
        let setupCalls = 0;
        const report = await runDualRoleAdultProvision({
          manifest: privateManifestAt(
            email,
            `native-readback-query-${testCase.group}`,
            operationNow,
          ),
          apply: true,
          authorizationPhrase: AUTHORIZATION,
          pool,
          config,
          now: operationNow,
          testOnlyAllowIsolatedApply: true,
          issuePasswordReset: async () => {
            setupCalls += 1;
            throw new Error('Setup must not run after native readback query failure.');
          },
        });
        const queryFailureCode = `${testCase.group}_query_failed`;
        const expectedDiagnostic = {
          groups: [{ group_code: testCase.group, blocker_codes: [queryFailureCode] }],
        };
        expect(report).toMatchObject({
          status: 'blocked',
          blockers: ['apply_identity_transactional_readback_failed'],
          generated_at: operationNow.toISOString(),
          apply_execution: {
            disposition: 'failed',
            transaction_outcome: 'rolled_back',
            reconciliation_outcome: 'completed',
            final_stage: 'transactional_readback',
            transactional_readback_diagnostic: expectedDiagnostic,
          },
          identity: { disposition: 'absent', adult_rows: 0 },
          setup_delivery: { token_rows: 0, intent_rows: 0, outbox_rows: 0 },
        });
        expect(report.apply_execution.journal.at(-1)).toEqual({
          sequence: report.apply_execution.journal.length,
          stage: 'transactional_readback',
          state: 'failed',
          transactional_readback_diagnostic: expectedDiagnostic,
        });
        expect(setupCalls).toBe(0);
        await expect(fullControllerCardinalities(pool)).resolves.toEqual(before);
        await expect(nativeUnrelatedEventRegistrationCount(pool, email)).resolves.toBe(1);
        const serialized = JSON.stringify(report);
        for (const unsafe of [
          email,
          'Synthetic Dual Role Adult',
          'RAW_NATIVE_READBACK_FAILURE',
          'SELECT secret FROM native_private_table',
          'native-database-id-123',
          'params=',
          'native-authorization-secret',
          '@',
        ]) {
          expect(serialized).not.toContain(unsafe);
        }
      }
    } finally {
      if (ownsSchema) await pool.query('DROP SCHEMA IF EXISTS onetime CASCADE');
      await pool.end();
    }
  }, 300_000);

  it('destroys the real client on rollback and commit uncertainty without creating setup effects', async () => {
    const nativePool = new pg.Pool({ connectionString: databaseUrl!, max: 4 });
    const destroyedReleases: boolean[] = [];
    const pool = observeClientDestruction(nativePool, destroyedReleases);
    let ownsSchema = false;
    try {
      const database = await pool.query(
        `SELECT current_database() AS database_name,
                COALESCE(inet_server_addr()::text, 'local_socket') AS server_address`,
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
      const before = await cardinalities(pool);
      for (const rollbackBehavior of ['stall', 'fail'] as const) {
        destroyedReleases.length = 0;
        let setupCalls = 0;
        const rollbackManifest = privateManifest(
          `native-dual-role-${rollbackBehavior}@example.test`,
          `native-dual-role-controller-proof-${rollbackBehavior}`,
        );
        const report = await runDualRoleAdultProvision({
          manifest: rollbackManifest,
          apply: true,
          authorizationPhrase: AUTHORIZATION,
          pool,
          config,
          now: PROVISION_AT,
          testOnlyAllowIsolatedApply: true,
          testOnlyStallApplyStage: 'adult_identity_insert',
          testOnlyApplyStageTimeoutMs: 500,
          testOnlyRollbackBehavior: rollbackBehavior,
          issuePasswordReset: async () => {
            setupCalls += 1;
            throw new Error('Setup must not run while rollback is unknown.');
          },
        });
        expect(report).toMatchObject({
          status: 'blocked',
          blockers: ['apply_identity_adult_identity_insert_timed_out'],
          apply_execution: {
            disposition: 'timed_out',
            transaction_outcome: 'rollback_unknown',
            reconciliation_outcome: 'completed',
            final_stage: 'adult_identity_insert',
          },
          identity: { disposition: 'absent', adult_rows: 0 },
          setup_delivery: { token_rows: 0, intent_rows: 0, outbox_rows: 0 },
        });
        expect(destroyedReleases).toContain(true);
        expect(setupCalls).toBe(0);
        await expect(cardinalities(pool)).resolves.toEqual(before);
      }

      destroyedReleases.length = 0;
      let setupCalls = 0;
      const commitUnknown = await runDualRoleAdultProvision({
        manifest,
        apply: true,
        authorizationPhrase: AUTHORIZATION,
        pool,
        config,
        now: PROVISION_AT,
        testOnlyAllowIsolatedApply: true,
        testOnlyStallApplyStage: 'transaction_commit',
        testOnlyApplyStageTimeoutMs: 500,
        issuePasswordReset: async () => {
          setupCalls += 1;
          throw new Error('Setup must not run while commit is being reconciled.');
        },
      });
      expect(commitUnknown).toMatchObject({
        status: 'identity_applied_setup_pending',
        blockers: ['apply_identity_transaction_commit_timed_out'],
        apply_execution: {
          disposition: 'timed_out',
          transaction_outcome: 'commit_unknown',
          reconciliation_outcome: 'completed',
          final_stage: 'transaction_commit',
        },
        identity: { disposition: 'exact_replay', adult_rows: 1 },
        setup_delivery: { token_rows: 0, intent_rows: 0, outbox_rows: 0 },
      });
      expect(destroyedReleases).toContain(true);
      expect(setupCalls).toBe(0);
      await expect(cardinalities(pool)).resolves.toEqual({
        adults: 1,
        accounts: 1,
        credentials: 1,
        memberships: 2,
        households: 1,
        canonicalTransitions: 2,
        canonicalStates: 2,
        portalHouseholds: 1,
        accessSources: 1,
        accessProjections: 1,
        accessEvents: 1,
        audits: 1,
        setupTokens: 0,
        setupIntents: 0,
        setupOutbox: 0,
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
    } finally {
      if (ownsSchema) await pool.query('DROP SCHEMA IF EXISTS onetime CASCADE');
      await pool.end();
    }
  }, 120_000);
});

type NativeTransactionalReadbackFaultControl = {
  faults?: Array<{
    queryIncludes: string;
    mutateRows?: (rows: Record<string, unknown>[]) => Record<string, unknown>[];
    throwRawQueryError?: boolean;
  }>;
};

function nativeTransactionalReadbackFaultPool(
  nativePool: pg.Pool,
  faultControl: NativeTransactionalReadbackFaultControl,
): DbPool {
  return {
    query: nativePool.query.bind(nativePool) as DbPool['query'],
    connect: (async () => {
      const client = await nativePool.connect();
      const invoke = client.query.bind(client) as unknown as (
        statement: string | { text: string },
        values?: unknown[],
      ) => Promise<{ rowCount: number | null; rows: Record<string, unknown>[] }>;
      const state = { armed: false, injected: new Set<number>() };
      return new Proxy(client, {
        get(target, property, receiver) {
          if (property === 'query') {
            return async (statement: string | { text: string }, values?: unknown[]) => {
              const text = typeof statement === 'string' ? statement : statement.text;
              const faultIndex = state.armed
                ? (faultControl.faults ?? []).findIndex(
                    (fault, index) =>
                      !state.injected.has(index) && text.includes(fault.queryIncludes),
                  )
                : -1;
              if (faultIndex >= 0) {
                const fault = faultControl.faults?.[faultIndex];
                state.injected.add(faultIndex);
                if (fault?.throwRawQueryError) {
                  try {
                    await invoke('SELECT 1 / 0');
                  } catch {
                    throw new Error(
                      'RAW_NATIVE_READBACK_FAILURE SELECT secret FROM native_private_table ' +
                        'params=native@example.test native-database-id-123 ' +
                        'native-authorization-secret',
                    );
                  }
                }
                const result = await invoke(statement, values);
                const rows = fault?.mutateRows?.(
                  result.rows.map((row) => ({ ...(row as Record<string, unknown>) })),
                );
                if (rows) return { ...result, rowCount: rows.length, rows };
                return result;
              }
              const result = await invoke(statement, values);
              if (text.includes('INSERT INTO onetime.account_lifecycle_audit_events')) {
                state.armed = true;
              }
              return result;
            };
          }
          const value = Reflect.get(target, property, receiver);
          return typeof value === 'function' ? value.bind(target) : value;
        },
      });
    }) as DbPool['connect'],
    end: nativePool.end.bind(nativePool) as DbPool['end'],
  };
}

function observeClientDestruction(nativePool: pg.Pool, destroyedReleases: boolean[]): DbPool {
  return {
    query: nativePool.query.bind(nativePool) as DbPool['query'],
    connect: (async () => {
      const client = await nativePool.connect();
      return new Proxy(client, {
        get(target, property, receiver) {
          if (property === 'release') {
            return (destroy?: boolean | Error) => {
              destroyedReleases.push(destroy === true);
              target.release(destroy);
            };
          }
          const value = Reflect.get(target, property, receiver);
          return typeof value === 'function' ? value.bind(target) : value;
        },
      });
    }) as DbPool['connect'],
    end: nativePool.end.bind(nativePool) as DbPool['end'],
  };
}

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

function privateManifest(email = EMAIL, operationId = 'native-dual-role-controller-proof') {
  return {
    schema_version: 'onetime.controller.dual_role_adult_provision.v1',
    operation_id: operationId,
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
      email,
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

function privateManifestAt(email: string, operationId: string, now: Date) {
  return {
    ...privateManifest(email, operationId),
    authorized_at: now.toISOString(),
    expires_at: new Date(now.getTime() + 60 * 60 * 1000).toISOString(),
  };
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

async function seedNativeUnrelatedEventRegistration(pool: DbPool, email: string, now: Date) {
  const definition = await pool.query(
    `SELECT event_definition_key, account_key, product_key, event_code
       FROM onetime.event_definitions ORDER BY created_at LIMIT 1`,
  );
  const row = definition.rows[0] as Record<string, unknown>;
  await pool.query(
    `INSERT INTO onetime.event_registrations
       (registration_key, event_definition_key, account_key, product_key, event_code,
        email_normalized, first_name, newsletter_opt_in,
        event_service_consent_policy_version, marketing_consent_policy_version,
        marketing_consent_recorded_at, initial_source, latest_source,
        first_seen_at, last_seen_at, registered_at, last_registered_at, metadata,
        created_at, updated_at)
     VALUES ($1,$2,$3,$4,$5,$6,'Unrelated',false,'event-service-test',NULL,NULL,
             'historical_event','historical_event',$7,$7,$7,$7,'{}'::jsonb,$7,$7)`,
    [
      `native-registration-${createHash('sha256').update(email).digest('hex').slice(0, 20)}`,
      row.event_definition_key,
      row.account_key,
      row.product_key,
      row.event_code,
      email,
      now,
    ],
  );
}

async function nativeUnrelatedEventRegistrationCount(pool: DbPool, email: string) {
  const result = await pool.query(
    `SELECT count(*)::integer AS count
       FROM onetime.event_registrations
      WHERE email_normalized=$1`,
    [email],
  );
  return Number(result.rows[0]?.count ?? 0);
}

const FULL_CONTROLLER_CARDINALITY_TABLES = [
  'v21_adult_identities',
  'v21_human_accounts',
  'v21_adult_credentials',
  'v21_human_account_role_memberships',
  'v21_households',
  'canonical_state_transition_events',
  'canonical_aggregate_states',
  'portal_households',
  'account_access_source_states',
  'account_access_projections',
  'account_access_events',
  'account_lifecycle_audit_events',
  'account_lifecycle_tokens',
  'account_lifecycle_delivery_intents',
  'account_lifecycle_delivery_outbox',
  'account_users',
  'contacts',
  'family_signup_requests',
  'family_signup_receipts',
  'family_signup_outbox',
  'family_signup_consents',
  'portal_guardian_consents',
  'privacy_consent_event',
  'v21_student_profiles',
  'portal_learners',
  'portal_student_access_state',
  'account_learner_identity_links',
  'adult_household_contact_links',
  'adult_ghl_identity_link',
  'household_provider_mapping',
  'provider_operation_binding',
  'ghl_identity_sync_operation',
  'ghl_household_identity_projection',
  'ghl_identity_review_case',
  'v21_billing_portal_sessions',
  'v21_provider_reassociation_intents',
  'billing_ghl_lifecycle_intents',
  'billing_access_episode_authority',
  'billing_access_episode_events',
  'billing_checkout_abandonment_intents',
  'billing_principal_customers',
  'billing_checkout_sessions',
  'billing_subscription_projections',
  'billing_invoice_summaries',
  'billing_reconciliation_jobs',
  'billing_entitlement_projections',
  'billing_audit_events',
] as const;

async function fullControllerCardinalities(pool: DbPool) {
  const entries = await Promise.all(
    FULL_CONTROLLER_CARDINALITY_TABLES.map(
      async (table) => [table, await count(pool, table)] as const,
    ),
  );
  return Object.fromEntries(entries);
}

async function cardinalities(pool: DbPool) {
  return {
    adults: await count(pool, 'v21_adult_identities'),
    accounts: await count(pool, 'v21_human_accounts'),
    credentials: await count(pool, 'v21_adult_credentials'),
    memberships: await count(pool, 'v21_human_account_role_memberships'),
    households: await count(pool, 'v21_households'),
    canonicalTransitions: await count(pool, 'canonical_state_transition_events'),
    canonicalStates: await count(pool, 'canonical_aggregate_states'),
    portalHouseholds: await count(pool, 'portal_households'),
    accessSources: await count(pool, 'account_access_source_states'),
    accessProjections: await count(pool, 'account_access_projections'),
    accessEvents: await count(pool, 'account_access_events'),
    audits: await count(pool, 'account_lifecycle_audit_events'),
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

async function accessEventCreatedAt(pool: DbPool) {
  const result = await pool.query(
    `SELECT created_at
       FROM onetime.account_access_events
      ORDER BY event_key`,
  );
  expect(result.rowCount).toBe(1);
  return new Date(String(result.rows[0]?.created_at)).toISOString();
}
