import { createHash } from 'node:crypto';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createV21AdultSessionRuntime } from '../../../apps/web/src/server/features/auth/v21-adult-session.ts';
import { createPostgresParentHouseholdRepository } from '../../../apps/web/src/server/features/portals/parent-household/postgres-repository.ts';
import { createParentHouseholdService } from '../../../apps/web/src/server/features/portals/parent-household/service.ts';
import { loadConfig, type AppConfig } from '../../../packages/config/src/index.ts';
import { ADULT_SESSION_POLICY } from '../../../packages/contracts/src/accounts/v21-household-identity.ts';
import {
  createMemoryPool,
  runMigrations,
  type DbPool,
  type Queryable,
} from '../../../packages/db/src/index.ts';
import {
  createPostgresV21AdultSessionRepository,
  type ResolvedV21ParentSession,
  type V21AdultLoginIdentity,
  type V21AdultSessionRepository,
} from '../../../packages/db/src/accounts/v21-household-identity-repository.ts';
import {
  CONTROLLER_DUAL_ROLE_ACCESS_EXPIRES_AT,
  CONTROLLER_DUAL_ROLE_PROVISIONING_POLICY,
  controllerDualRoleProvisioningIdentityKeys,
  controllerDualRoleSetupIdempotencyKey,
} from '../../../packages/domain/src/accounts/controller-dual-role-provisioning-policy.ts';
import {
  completePasswordReset,
  requestControllerDualRoleInitialPasswordSetup,
  requestPasswordReset,
} from '../../../packages/domain/src/accounts/lifecycle.ts';
import { hashAuthPassword } from '../../../packages/domain/src/auth/policy.ts';
import { createDbBackedTestAdultSessionRepository } from '../../support/pgmem-v21-parent-session-repository.ts';
import {
  CONTROLLER_DUAL_ROLE_APPLY_STAGES,
  isCanonicalControllerResetOrigin,
  runDualRoleAdultProvision,
  runDualRoleAdultProvisionCli,
} from '../../../scripts/operations/provision-dual-role-adult.ts';

const SOURCE_SHA = 'a'.repeat(40);
const AUTHORIZATION = 'test-only dual role controller authorization phrase';
const PROVISION_AT = new Date('2026-08-20T12:00:00.000Z');

let pool: DbPool;
let config: AppConfig;

beforeEach(async () => {
  const memory = createMemoryPool();
  await runMigrations(memory);
  pool = canonicalTriggerCompatiblePool(memory);
  config = testConfig();
  await seedCanonicalClassSeries(pool);
});

afterEach(async () => {
  await pool.end();
});

describe('controller dual-role adult provisioning', () => {
  it('accepts only the canonical authenticated app origin for the one-time setup link', async () => {
    expect(isCanonicalControllerResetOrigin('https://app.onetimeonetime.com')).toBe(true);
    expect(isCanonicalControllerResetOrigin('https://app.onetimeonetime.com/')).toBe(true);

    const rejectedOrigins = [
      'https://join.onetimeonetime.com',
      'https://other.example.com',
      'https://reset.app.onetimeonetime.com',
      'http://app.onetimeonetime.com',
      'https://app.onetimeonetime.com/reset-password',
      'https://app.onetimeonetime.com?source=controller',
      'https://app.onetimeonetime.com#setup',
      'https://operator@app.onetimeonetime.com',
      'https://app.onetimeonetime.com//',
    ];
    const before = await protectedCounts(pool);
    const manifest = privateManifest('dual-role-origin-guard@example.test');

    for (const publicBaseUrl of rejectedOrigins) {
      expect(isCanonicalControllerResetOrigin(publicBaseUrl)).toBe(false);
      const report = await runDualRoleAdultProvision({
        manifest,
        apply: true,
        authorizationPhrase: AUTHORIZATION,
        pool,
        config: { ...config, publicBaseUrl },
        now: PROVISION_AT,
      });
      expect(report).toMatchObject({
        status: 'blocked',
        blockers: expect.arrayContaining(['canonical_reset_origin_mismatch']),
      });
      expect(await protectedCounts(pool)).toEqual(before);
    }

    for (const publicBaseUrl of [
      'https://app.onetimeonetime.com',
      'https://app.onetimeonetime.com/',
    ]) {
      const report = await runDualRoleAdultProvision({
        manifest,
        apply: true,
        authorizationPhrase: AUTHORIZATION,
        pool,
        config: { ...config, publicBaseUrl },
        now: PROVISION_AT,
      });
      expect(report.blockers).not.toContain('canonical_reset_origin_mismatch');
      expect(await protectedCounts(pool)).toEqual(before);
    }
  });

  it('is strict, dry-run first, PII-safe, and performs zero dry-run writes', async () => {
    const manifest = privateManifest('dual-role-dry-run@example.test');
    const before = await protectedCounts(pool);
    const report = await runDualRoleAdultProvision({
      manifest,
      pool,
      config,
      now: PROVISION_AT,
      testOnlyAllowIsolatedApply: true,
    });

    expect(report).toMatchObject({
      apply: false,
      status: 'dry_run_planned',
      identity: { disposition: 'absent', adult_rows: 0 },
      setup_delivery: { disposition: 'planned', token_rows: 0, outbox_rows: 0 },
    });
    expect(await protectedCounts(pool)).toEqual(before);
    const serialized = JSON.stringify(report);
    expect(serialized).not.toContain('dual-role-dry-run@example.test');
    expect(serialized).not.toContain('Synthetic Dual Role Adult');
    expect(serialized).not.toContain('@');

    await expect(
      runDualRoleAdultProvision({
        manifest: { ...manifest, terms_accepted: true },
        pool,
        config,
        now: PROVISION_AT,
        testOnlyAllowIsolatedApply: true,
      }),
    ).rejects.toThrow(/invalid private manifest fields/i);
    expect(await protectedCounts(pool)).toEqual(before);

    const nonPositiveAuthorizationWindow = await runDualRoleAdultProvision({
      manifest: { ...manifest, expires_at: manifest.authorized_at },
      pool,
      config,
      now: PROVISION_AT,
      testOnlyAllowIsolatedApply: true,
    });
    expect(nonPositiveAuthorizationWindow).toMatchObject({
      status: 'blocked',
      blockers: expect.arrayContaining(['authorization_expired_or_too_broad']),
    });
    expect(await protectedCounts(pool)).toEqual(before);

    const targetBound = await runDualRoleAdultProvision({
      manifest,
      pool,
      config,
      now: PROVISION_AT,
    });
    expect(targetBound).toMatchObject({
      status: 'blocked',
      blockers: expect.arrayContaining([
        'controller_target_mismatch',
        'production_injection_seam_forbidden',
      ]),
    });
    expect(await protectedCounts(pool)).toEqual(before);
  });

  it('classifies every identity stage without raw detail and never requests setup', async () => {
    for (const stage of CONTROLLER_DUAL_ROLE_APPLY_STAGES) {
      const email = `dual-role-stage-${stage.replaceAll('_', '-')}@example.test`;
      const manifest = privateManifest(email);
      let setupCalls = 0;
      const report = await runDualRoleAdultProvision({
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

      expect(report).toMatchObject({
        setup_delivery: {
          disposition: 'planned',
          token_rows: 0,
          intent_rows: 0,
          outbox_rows: 0,
        },
      });
      expect(['blocked', 'identity_applied_setup_pending']).toContain(report.status);
      expect(report.blockers).toContain(`apply_identity_${stage}_failed`);
      expect(setupCalls).toBe(0);
      const serialized = JSON.stringify(report);
      expect(serialized).not.toContain(email);
      expect(serialized).not.toContain('Synthetic Dual Role Adult');
      expect(serialized).not.toContain('TEST_ONLY_RAW_FAILURE');
      expect(serialized).not.toContain('INSERT INTO');
      expect(serialized).not.toContain('database-id');
      expect(serialized).not.toContain('@');
    }
    await expect(count(pool, 'account_lifecycle_tokens')).resolves.toBe(0);
    await expect(count(pool, 'account_lifecycle_delivery_intents')).resolves.toBe(0);
    await expect(count(pool, 'account_lifecycle_delivery_outbox')).resolves.toBe(0);
  });

  it('writes the same sanitized controller failure to --out when the CLI throws', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'dual-role-controller-output-'));
    const outputPath = join(directory, 'result.json');
    const emitted: string[] = [];
    try {
      const exitCode = await runDualRoleAdultProvisionCli(
        ['--manifest', join(directory, 'missing-private-manifest.json'), '--out', outputPath],
        (output) => emitted.push(output),
      );
      const output = await readFile(outputPath, 'utf8');
      expect(exitCode).toBe(2);
      expect(emitted).toEqual([output]);
      expect(JSON.parse(output)).toEqual({
        schema: 'onetime.controller.dual_role_adult_provision.v1',
        status: 'blocked',
        blockers: ['controller_preflight_failed'],
      });
      expect(output).not.toContain(directory);
      expect(output).not.toContain('missing-private-manifest');
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });

  it.each([
    {
      name: 'missing table or ownership/RLS contract',
      blocker: 'apply_prerequisite_table_contract_mismatch',
      override: (kind: 'catalog' | 'trigger', rows: Record<string, unknown>[]) =>
        kind === 'catalog' ? rows.slice(1) : rows,
    },
    {
      name: 'missing write privilege',
      blocker: 'apply_prerequisite_privilege_contract_mismatch',
      override: (kind: 'catalog' | 'trigger', rows: Record<string, unknown>[]) =>
        kind === 'catalog'
          ? rows.map((row, index) => (index === 0 ? { ...row, can_insert: false } : row))
          : rows,
    },
    {
      name: 'missing canonical transition trigger',
      blocker: 'apply_prerequisite_trigger_contract_mismatch',
      override: (kind: 'catalog' | 'trigger', rows: Record<string, unknown>[]) =>
        kind === 'trigger' ? [{ count: 0 }] : rows,
    },
  ])('blocks apply on $name without entering the transaction', async ({ blocker, override }) => {
    let setupCalls = 0;
    const guardedPool = prerequisiteOverridePool(pool, override);
    const report = await runDualRoleAdultProvision({
      manifest: privateManifest(`dual-role-prerequisite-${blocker}@example.test`),
      apply: true,
      authorizationPhrase: AUTHORIZATION,
      pool: guardedPool,
      config,
      now: PROVISION_AT,
      testOnlyAllowIsolatedApply: true,
      issuePasswordReset: async () => {
        setupCalls += 1;
        throw new Error('Setup must not run after prerequisite failure.');
      },
    });
    expect(report).toMatchObject({
      status: 'blocked',
      blockers: expect.arrayContaining([blocker]),
      identity: { disposition: 'absent', adult_rows: 0 },
      setup_delivery: { token_rows: 0, intent_rows: 0, outbox_rows: 0 },
    });
    expect(setupCalls).toBe(0);
  });

  it('blocks an orphan deterministic key before applying any identity write', async () => {
    const email = 'dual-role-orphan-key@example.test';
    const manifest = privateManifest(email);
    const keys = controllerDualRoleProvisioningIdentityKeys({
      accountKey: config.accountKey,
      productKey: config.productKey,
      runtimeTier: config.oneTimeRuntimeTier,
      verificationEnvironmentId: config.oneTimeVerificationEnvironmentId,
      normalizedEmail: email,
    });
    await pool.query(
      `INSERT INTO onetime.portal_households
         (household_key, account_key, product_key, display_name, status, version,
          created_at, updated_at)
       VALUES ($1,$2,$3,'Orphan deterministic key','active',1,$4,$4)`,
      [keys.householdId, config.accountKey, config.productKey, PROVISION_AT],
    );
    const report = await runDualRoleAdultProvision({
      manifest,
      apply: true,
      authorizationPhrase: AUTHORIZATION,
      pool,
      config,
      now: PROVISION_AT,
      testOnlyAllowIsolatedApply: true,
    });
    expect(report).toMatchObject({
      status: 'blocked',
      blockers: expect.arrayContaining(['apply_prerequisite_target_key_collision']),
      identity: { disposition: 'absent', adult_rows: 0 },
      setup_delivery: { token_rows: 0, intent_rows: 0, outbox_rows: 0 },
    });
    await expect(count(pool, 'v21_adult_identities')).resolves.toBe(0);
  });

  it('blocks stale target-scoped prohibited evidence even when the adult is absent', async () => {
    const email = 'dual-role-stale-prohibited@example.test';
    const manifest = privateManifest(email);
    const keys = controllerDualRoleProvisioningIdentityKeys({
      accountKey: config.accountKey,
      productKey: config.productKey,
      runtimeTier: config.oneTimeRuntimeTier,
      verificationEnvironmentId: config.oneTimeVerificationEnvironmentId,
      normalizedEmail: email,
    });
    await pool.query(
      `INSERT INTO onetime.privacy_consent_event
         (consent_event_id, idempotency_key, canonical_request_hash, actor_kind,
          actor_account_or_credential_id, actor_adult_id, household_id, student_id,
          relationship, parent_authority_attested, scope, choice, policy_versions,
          occurred_at, request_correlation_id, network_evidence_digest, reason_code)
       VALUES ('stale-controller-consent','stale-controller-consent-idempotency',$1,
               'parent_account_owner',$2,$3,$4,'stale-student','dependent',true,
               'service_account','granted','{}'::jsonb,$5,'stale-correlation',$6,
               'stale_fixture')`,
      [
        'a'.repeat(64),
        keys.humanAccountId,
        keys.adultId,
        keys.householdId,
        PROVISION_AT,
        'b'.repeat(64),
      ],
    );
    const before = await protectedCounts(pool);
    const report = await runDualRoleAdultProvision({
      manifest,
      pool,
      config,
      now: PROVISION_AT,
      testOnlyAllowIsolatedApply: true,
    });
    expect(report).toMatchObject({
      status: 'blocked',
      identity: { disposition: 'blocked', adult_rows: 0 },
      blockers: expect.arrayContaining(['prohibited_projection_present']),
    });
    expect(await protectedCounts(pool)).toEqual(before);
  });

  it('creates one canonical adult, two roles, one Family, one setup email intent, and real role-switch/Add Student parity', async () => {
    const email = 'dual-role-complete@example.test';
    await seedUnrelatedEventRegistration(pool, email);
    let proofToken: string | undefined;
    let issueCalls = 0;
    const issueWithLocalProof: typeof requestControllerDualRoleInitialPasswordSetup = async (
      input,
    ) => {
      issueCalls += 1;
      const issued = await requestControllerDualRoleInitialPasswordSetup({
        ...input,
        includeLocalProofToken: true,
      });
      if ('token_for_local_proof' in issued) proofToken = issued.token_for_local_proof;
      return issued;
    };
    const manifest = privateManifest(email);
    const report = await runDualRoleAdultProvision({
      manifest,
      apply: true,
      authorizationPhrase: AUTHORIZATION,
      pool,
      config,
      now: PROVISION_AT,
      testOnlyAllowIsolatedApply: true,
      issuePasswordReset: issueWithLocalProof,
    });

    expect(report).toMatchObject({
      status: 'applied',
      identity: {
        disposition: 'exact_replay',
        active_memberships: ['admin', 'parent'],
        family_households: 1,
        canonical_access_state: 'free',
        compatibility_access_state: 'active',
        legacy_account_users: 0,
        local_contacts: 0,
      },
      setup_delivery: {
        disposition: 'queued',
        token_rows: 1,
        intent_rows: 1,
        outbox_rows: 1,
        external_send_performed_inline: false,
      },
    });
    expect(issueCalls).toBe(1);
    expect(proofToken).toBeTruthy();
    await expect(count(pool, 'v21_adult_identities')).resolves.toBe(1);
    await expect(count(pool, 'v21_human_accounts')).resolves.toBe(1);
    await expect(count(pool, 'v21_adult_credentials')).resolves.toBe(1);
    await expect(count(pool, 'v21_human_account_role_memberships')).resolves.toBe(2);
    await expect(count(pool, 'v21_households')).resolves.toBe(1);
    await expect(count(pool, 'portal_households')).resolves.toBe(1);
    await expect(count(pool, 'account_access_source_states')).resolves.toBe(1);
    await expect(count(pool, 'account_access_projections')).resolves.toBe(1);
    await expect(count(pool, 'account_access_events')).resolves.toBe(1);
    await expect(count(pool, 'account_lifecycle_tokens')).resolves.toBe(1);
    await expect(count(pool, 'account_lifecycle_delivery_intents')).resolves.toBe(1);
    await expect(count(pool, 'account_lifecycle_delivery_outbox')).resolves.toBe(1);
    await expect(count(pool, 'account_users')).resolves.toBe(0);
    await expect(count(pool, 'contacts')).resolves.toBe(0);
    await expect(count(pool, 'family_signup_requests')).resolves.toBe(0);
    await expect(count(pool, 'family_signup_consents')).resolves.toBe(0);
    await expect(count(pool, 'family_signup_outbox')).resolves.toBe(0);
    await expect(count(pool, 'v21_student_profiles')).resolves.toBe(0);
    await expect(unrelatedRegistration(pool, email)).resolves.toMatchObject({
      newsletter_opt_in: false,
      email_normalized: email,
    });

    const replay = await runDualRoleAdultProvision({
      manifest,
      apply: true,
      authorizationPhrase: AUTHORIZATION,
      pool,
      config,
      now: new Date(PROVISION_AT.getTime() + 1_000),
      testOnlyAllowIsolatedApply: true,
      issuePasswordReset: issueWithLocalProof,
    });
    expect(replay.status).toBe('replayed');
    expect(replay.setup_delivery.disposition).toBe('already_queued');
    expect(issueCalls).toBe(1);
    await expect(count(pool, 'account_lifecycle_delivery_outbox')).resolves.toBe(1);
    const dryRunReplay = await runDualRoleAdultProvision({
      manifest,
      pool,
      config,
      now: new Date(PROVISION_AT.getTime() + 2_000),
      testOnlyAllowIsolatedApply: true,
    });
    expect(dryRunReplay).toMatchObject({
      status: 'dry_run_replay',
      setup_delivery: { disposition: 'queued', token_rows: 1, outbox_rows: 1 },
    });
    const renamedFamilyReplay = await runDualRoleAdultProvision({
      manifest: {
        ...manifest,
        adult: { ...manifest.adult, household_display_name: 'Changed Family Name' },
      },
      pool,
      config,
      now: new Date(PROVISION_AT.getTime() + 3_000),
      testOnlyAllowIsolatedApply: true,
    });
    expect(renamedFamilyReplay).toMatchObject({
      status: 'blocked',
      blockers: expect.arrayContaining(['canonical_transition_mismatch']),
    });

    await completePasswordReset({
      pool,
      config,
      payload: {
        token: proofToken!,
        password: 'correct horse battery staple',
        password_confirmation: 'correct horse battery staple',
      },
      now: new Date(PROVISION_AT.getTime() + 60_000),
    });
    const runtime = createV21AdultSessionRuntime({
      repository: createDbBackedDualRoleTestSessionRepository(pool),
      hmacSecret: config.authCsrfSecret,
    });
    const login = await runtime.login({
      scope: {
        product: 'one_time_mishnayos',
        runtime_tier: 'isolated_staging',
        verification_environment_id: 'ci',
      },
      email,
      password: 'correct horse battery staple',
      now: new Date(PROVISION_AT.getTime() + 120_000),
    });
    expect(login).toMatchObject({
      handled: true,
      authenticated: true,
      active_role: 'admin',
      memberships: ['admin', 'parent'],
      household: null,
    });
    if (!login.handled || !login.authenticated) throw new Error('dual-role login unavailable');
    const switched = await runtime.switchRoleCookieHeader({
      cookie_header: `__Host-onetime-session=${login.browser_session_token}`,
      csrf_token: login.csrf_token,
      requested_role: 'parent',
      now: new Date(PROVISION_AT.getTime() + 180_000),
    });
    expect(switched).toMatchObject({ switched: true, active_role: 'parent' });
    if (!switched.switched) throw new Error('Parent role switch unavailable');
    const resolved = await runtime.resolveCookieHeader({
      cookie_header: `__Host-onetime-session=${switched.browser_session_token}`,
      now: new Date(PROVISION_AT.getTime() + 180_000),
    });
    if (resolved.status !== 'resolved' || !resolved.context.household) {
      throw new Error('Parent session did not resolve');
    }

    const studentService = parentService(
      pool,
      'synthetic-provisioned-student',
      new Date(PROVISION_AT.getTime() + 240_000),
    );
    const created = await studentService.createStudent(
      {
        role: 'parent',
        adult_id: resolved.context.adultId,
        household_id: resolved.context.household.householdId,
        session_id: resolved.context.session.sessionId,
      },
      {
        expected_revision: 1,
        actual_name: 'Synthetic Student',
        display_name: null,
        username: 'synthetic.provisioned.student',
        relationship: 'dependent',
        new_password: '000123',
        password_confirmation: '000123',
      },
      {
        idempotency_key: 'provisioned-parent-add-student-0001',
        canonical_request_hash: 'c'.repeat(64),
        occurred_at: new Date(PROVISION_AT.getTime() + 240_000).toISOString(),
      },
    );
    expect(created.snapshot).toMatchObject({ active_student_count: 1, revision: 2 });
    await expect(count(pool, 'v21_student_profiles')).resolves.toBe(1);
    await expect(count(pool, 'family_signup_requests')).resolves.toBe(0);
    await expect(count(pool, 'family_signup_consents')).resolves.toBe(0);
    await expect(count(pool, 'family_signup_outbox')).resolves.toBe(0);
    await expect(unrelatedRegistration(pool, email)).resolves.toMatchObject({
      newsletter_opt_in: false,
    });
    const studentSafetyStop = await runDualRoleAdultProvision({
      manifest,
      pool,
      config,
      now: new Date(PROVISION_AT.getTime() + 300_000),
      testOnlyAllowIsolatedApply: true,
    });
    expect(studentSafetyStop).toMatchObject({
      status: 'blocked',
      blockers: expect.arrayContaining(['prohibited_projection_present']),
    });

    const ordinaryRecovery = await requestPasswordReset({
      pool,
      config,
      payload: { idempotency_key: 'ordinary-reset-after-controller-activation', email },
      now: new Date(PROVISION_AT.getTime() + 360_000),
    });
    expect(ordinaryRecovery).not.toEqual({ request_accepted: true });
    await expect(count(pool, 'account_lifecycle_tokens')).resolves.toBe(2);
    await expect(count(pool, 'account_lifecycle_delivery_outbox')).resolves.toBe(2);
  });

  it('reports completed when the recipient finishes setup before apply readback', async () => {
    const email = 'dual-role-completed-during-issue@example.test';
    const issueAndComplete: typeof requestControllerDualRoleInitialPasswordSetup = async (
      input,
    ) => {
      const issued = await requestControllerDualRoleInitialPasswordSetup({
        ...input,
        includeLocalProofToken: true,
      });
      if (!('token_for_local_proof' in issued)) {
        throw new Error('Expected a local proof token for the isolated setup-race test.');
      }
      await completePasswordReset({
        pool: input.pool,
        config: input.config,
        payload: {
          token: issued.token_for_local_proof,
          password: 'completed during issue proof password',
          password_confirmation: 'completed during issue proof password',
        },
        now: new Date(PROVISION_AT.getTime() + 1),
      });
      return issued;
    };

    const report = await runDualRoleAdultProvision({
      manifest: privateManifest(email),
      apply: true,
      authorizationPhrase: AUTHORIZATION,
      pool,
      config,
      now: PROVISION_AT,
      testOnlyAllowIsolatedApply: true,
      issuePasswordReset: issueAndComplete,
    });

    expect(report).toMatchObject({
      status: 'applied',
      setup_delivery: {
        disposition: 'completed',
        token_rows: 1,
        intent_rows: 1,
        outbox_rows: 1,
      },
    });
    await expect(count(pool, 'account_lifecycle_tokens')).resolves.toBe(1);
    await expect(count(pool, 'account_lifecycle_delivery_intents')).resolves.toBe(1);
    await expect(count(pool, 'account_lifecycle_delivery_outbox')).resolves.toBe(1);
  });

  it('serializes a different-key public reset against the reserved controller setup without a second message', async () => {
    const email = 'dual-role-reset-race@example.test';
    const manifest = privateManifest(email);
    let enterIssue!: () => void;
    let releaseIssue!: () => void;
    const issueEntered = new Promise<void>((resolve) => {
      enterIssue = resolve;
    });
    const issueRelease = new Promise<void>((resolve) => {
      releaseIssue = resolve;
    });
    const provisionPromise = runDualRoleAdultProvision({
      manifest,
      apply: true,
      authorizationPhrase: AUTHORIZATION,
      pool,
      config,
      now: PROVISION_AT,
      testOnlyAllowIsolatedApply: true,
      issuePasswordReset: async (input) => {
        enterIssue();
        await issueRelease;
        return requestControllerDualRoleInitialPasswordSetup(input);
      },
    });
    await issueEntered;
    const publicReset = requestPasswordReset({
      pool,
      config,
      payload: { idempotency_key: 'different-public-reset-race-key', email },
      now: PROVISION_AT,
    });
    releaseIssue();
    const [provisioned, publicResult] = await Promise.all([provisionPromise, publicReset]);

    expect(provisioned.status).toBe('applied');
    expect(publicResult).toEqual({ request_accepted: true });
    await expect(count(pool, 'account_lifecycle_tokens')).resolves.toBe(1);
    await expect(count(pool, 'account_lifecycle_delivery_intents')).resolves.toBe(1);
    await expect(count(pool, 'account_lifecycle_delivery_outbox')).resolves.toBe(1);

    await pool.query(`UPDATE onetime.account_lifecycle_tokens SET expires_at=$1`, [PROVISION_AT]);
    const expiredSetupRecovery = await requestPasswordReset({
      pool,
      config,
      payload: { idempotency_key: 'public-reset-after-initial-setup-expiry', email },
      now: new Date(PROVISION_AT.getTime() + 1),
    });
    expect(expiredSetupRecovery).not.toEqual({ request_accepted: true });
    await expect(count(pool, 'account_lifecycle_tokens')).resolves.toBe(2);
    await expect(count(pool, 'account_lifecycle_delivery_outbox')).resolves.toBe(2);
  });

  it('issues the exact reserved setup once even after the ordinary reset budget is exhausted', async () => {
    const email = 'dual-role-exhausted-public-budget@example.test';
    const manifest = privateManifest(email);
    const setupIdempotencyKey = controllerDualRoleSetupIdempotencyKey({
      accountKey: config.accountKey,
      productKey: config.productKey,
      runtimeTier: config.oneTimeRuntimeTier,
      verificationEnvironmentId: config.oneTimeVerificationEnvironmentId,
      normalizedEmail: email,
    });

    await expect(
      requestControllerDualRoleInitialPasswordSetup({
        pool,
        config,
        payload: { idempotency_key: setupIdempotencyKey, email },
        now: PROVISION_AT,
      }),
    ).rejects.toThrow(/reserved initial account setup is unavailable/i);

    for (let attempt = 0; attempt < 5; attempt += 1) {
      await expect(
        requestPasswordReset({
          pool,
          config,
          payload: { idempotency_key: `public-budget-attempt-${attempt}`, email },
          now: PROVISION_AT,
        }),
      ).resolves.toEqual({ request_accepted: true });
    }
    await expect(
      requestPasswordReset({
        pool,
        config,
        payload: { idempotency_key: 'public-budget-blocked-attempt', email },
        now: PROVISION_AT,
      }),
    ).rejects.toThrow(/password reset requests are rate limited/i);

    const applied = await runDualRoleAdultProvision({
      manifest,
      apply: true,
      authorizationPhrase: AUTHORIZATION,
      pool,
      config,
      now: PROVISION_AT,
      testOnlyAllowIsolatedApply: true,
    });
    expect(applied).toMatchObject({
      status: 'applied',
      setup_delivery: { disposition: 'queued', token_rows: 1, outbox_rows: 1 },
    });

    await expect(
      requestControllerDualRoleInitialPasswordSetup({
        pool,
        config,
        payload: { idempotency_key: setupIdempotencyKey, email },
        now: new Date(PROVISION_AT.getTime() + 1),
      }),
    ).resolves.not.toEqual({ request_accepted: true });
    const replay = await runDualRoleAdultProvision({
      manifest,
      apply: true,
      authorizationPhrase: AUTHORIZATION,
      pool,
      config,
      now: new Date(PROVISION_AT.getTime() + 2),
      testOnlyAllowIsolatedApply: true,
    });
    expect(replay).toMatchObject({
      status: 'replayed',
      setup_delivery: { disposition: 'already_queued', token_rows: 1, outbox_rows: 1 },
    });
    await expect(count(pool, 'account_lifecycle_tokens')).resolves.toBe(1);
    await expect(count(pool, 'account_lifecycle_delivery_intents')).resolves.toBe(1);
    await expect(count(pool, 'account_lifecycle_delivery_outbox')).resolves.toBe(1);
  });

  it('preserves ordinary known and unknown password-reset behavior outside the controller reservation', async () => {
    const knownEmail = 'ordinary-known-adult@example.test';
    await seedOrdinaryLegacyUser(knownEmail);
    const unknown = await requestPasswordReset({
      pool,
      config,
      payload: {
        idempotency_key: 'ordinary-unknown-reset-0001',
        email: 'ordinary-unknown-adult@example.test',
      },
      now: PROVISION_AT,
    });
    expect(unknown).toEqual({ request_accepted: true });
    await expect(count(pool, 'account_lifecycle_tokens')).resolves.toBe(0);

    const known = await requestPasswordReset({
      pool,
      config,
      payload: { idempotency_key: 'ordinary-known-reset-0001', email: knownEmail },
      now: PROVISION_AT,
    });
    expect(known).not.toEqual({ request_accepted: true });
    await expect(count(pool, 'account_lifecycle_tokens')).resolves.toBe(1);
    await expect(count(pool, 'account_lifecycle_delivery_outbox')).resolves.toBe(1);
  });

  it('requires a verified isolated database even when a caller requests the test bypass', async () => {
    const manifest = privateManifest('dual-role-bypass-denied@example.test');
    const before = await protectedCounts(pool);
    const report = await runDualRoleAdultProvision({
      manifest,
      apply: true,
      authorizationPhrase: AUTHORIZATION,
      pool: databaseIdentityPool(pool, {
        database_name: 'railway',
        server_address: '10.0.0.8',
        server_version: 'PostgreSQL 18',
      }),
      config,
      now: PROVISION_AT,
      testOnlyAllowIsolatedApply: true,
    });
    expect(report).toMatchObject({
      status: 'blocked',
      blockers: expect.arrayContaining([
        'controller_target_mismatch',
        'production_injection_seam_forbidden',
        'production_runtime_required',
      ]),
    });
    expect(await protectedCounts(pool)).toEqual(before);
  });

  it('fails closed on a same-name local adult contact candidate without adopting or changing it', async () => {
    await pool.query(
      `INSERT INTO onetime.contacts
         (contact_key, account_key, product_key, display_name,
          family_school_classification, family_or_school, location_text, timezone,
          email_normalized, reminder_preference, source, created_at, updated_at)
       VALUES ('contact-controller-collision-fixture',$1,$2,'Rabbi Eli Scheller',
               'family','Collision fixture','Jerusalem','Asia/Jerusalem',
               'collision-fixture@example.test','none','test_fixture',$3,$3)`,
      [config.accountKey, config.productKey, PROVISION_AT],
    );
    const report = await runDualRoleAdultProvision({
      manifest: privateManifest('dual-role-contact-collision@example.test'),
      pool,
      config,
      now: PROVISION_AT,
      testOnlyAllowIsolatedApply: true,
    });
    expect(report).toMatchObject({
      status: 'blocked',
      identity: { local_contacts: 0, local_contact_collision_candidates: 1 },
      blockers: expect.arrayContaining(['local_contact_collision_candidate']),
    });
    const preserved = await pool.query(
      `SELECT email_normalized, suppression_state FROM onetime.contacts
        WHERE contact_key='contact-controller-collision-fixture'`,
    );
    expect(preserved.rows).toEqual([
      { email_normalized: 'collision-fixture@example.test', suppression_state: 'active' },
    ]);
  });

  it('fails closed on a known typo alias even when the legacy identity is a Student', async () => {
    await pool.query(
      `INSERT INTO onetime.account_users
         (user_key, account_key, product_key, email_normalized, display_name, role,
          password_hash, status, created_at, updated_at)
       VALUES ('legacy-student-controller-alias',$1,$2,'shrellereli@gmail.com',
               'Legacy Student Collision Candidate','student',$3,'active',$4,$4)`,
      [
        config.accountKey,
        config.productKey,
        hashAuthPassword('legacy Student collision fixture password'),
        PROVISION_AT,
      ],
    );
    const before = await protectedCounts(pool);
    const report = await runDualRoleAdultProvision({
      manifest: privateManifest('dual-role-legacy-student-collision@example.test'),
      pool,
      config,
      now: PROVISION_AT,
      testOnlyAllowIsolatedApply: true,
    });
    expect(report).toMatchObject({
      status: 'blocked',
      identity: { legacy_account_users: 0, legacy_collision_candidates: 1 },
      blockers: expect.arrayContaining(['legacy_identity_collision_candidate']),
    });
    expect(await protectedCounts(pool)).toEqual(before);
    const preserved = await pool.query(
      `SELECT role, status FROM onetime.account_users
        WHERE user_key='legacy-student-controller-alias'`,
    );
    expect(preserved.rows).toEqual([{ role: 'student', status: 'active' }]);
  });

  it('blocks unknown setup-provider state without minting or queuing a replacement', async () => {
    const email = 'dual-role-unknown-delivery@example.test';
    const manifest = privateManifest(email);
    await provision(email);
    const futureAuditAt = new Date(PROVISION_AT.getTime() + 60_000);
    await pool.query(`UPDATE onetime.account_lifecycle_audit_events SET created_at=$1`, [
      futureAuditAt,
    ]);
    const futureAudit = await runDualRoleAdultProvision({
      manifest,
      pool,
      config,
      now: PROVISION_AT,
      testOnlyAllowIsolatedApply: true,
    });
    expect(futureAudit).toMatchObject({
      status: 'blocked',
      blockers: expect.arrayContaining(['controller_provision_audit_mismatch']),
    });
    await pool.query(`UPDATE onetime.account_lifecycle_audit_events SET created_at=$1`, [
      PROVISION_AT,
    ]);
    await pool.query(
      `UPDATE onetime.account_lifecycle_delivery_outbox SET state='provider_accepted'`,
    );
    const accepted = await runDualRoleAdultProvision({
      manifest,
      pool,
      config,
      now: new Date(PROVISION_AT.getTime() + 1_000),
      testOnlyAllowIsolatedApply: true,
    });
    expect(accepted).toMatchObject({
      status: 'dry_run_replay',
      setup_delivery: { disposition: 'provider_accepted', token_rows: 1, outbox_rows: 1 },
    });
    await pool.query(`UPDATE onetime.account_lifecycle_delivery_outbox SET state='unknown'`);
    const report = await runDualRoleAdultProvision({
      manifest,
      apply: true,
      authorizationPhrase: AUTHORIZATION,
      pool,
      config,
      now: new Date(PROVISION_AT.getTime() + 1_000),
      testOnlyAllowIsolatedApply: true,
    });
    expect(report).toMatchObject({
      status: 'blocked',
      blockers: expect.arrayContaining(['setup_delivery_provider_effect_unknown']),
      setup_delivery: { disposition: 'blocked', token_rows: 1, outbox_rows: 1 },
    });
    await expect(count(pool, 'account_lifecycle_tokens')).resolves.toBe(1);
    await expect(count(pool, 'account_lifecycle_delivery_intents')).resolves.toBe(1);
    await expect(count(pool, 'account_lifecycle_delivery_outbox')).resolves.toBe(1);
  });

  it('collapses two concurrent applies into one exact identity and setup-delivery chain', async () => {
    const manifest = privateManifest('dual-role-concurrent@example.test');
    const apply = () =>
      runDualRoleAdultProvision({
        manifest,
        apply: true,
        authorizationPhrase: AUTHORIZATION,
        pool,
        config,
        now: PROVISION_AT,
        testOnlyAllowIsolatedApply: true,
      });
    const reports = await Promise.all([apply(), apply()]);

    expect(reports.map((report) => report.status).sort()).toEqual(['applied', 'replayed']);
    expect(reports.every((report) => report.identity.disposition === 'exact_replay')).toBe(true);
    expect(reports.every((report) => report.setup_delivery.token_rows === 1)).toBe(true);
    await expect(count(pool, 'v21_adult_identities')).resolves.toBe(1);
    await expect(count(pool, 'v21_human_accounts')).resolves.toBe(1);
    await expect(count(pool, 'v21_adult_credentials')).resolves.toBe(1);
    await expect(count(pool, 'v21_human_account_role_memberships')).resolves.toBe(2);
    await expect(count(pool, 'v21_households')).resolves.toBe(1);
    await expect(count(pool, 'canonical_state_transition_events')).resolves.toBe(2);
    await expect(count(pool, 'account_access_source_states')).resolves.toBe(1);
    await expect(count(pool, 'account_access_projections')).resolves.toBe(1);
    await expect(count(pool, 'account_access_events')).resolves.toBe(1);
    await expect(count(pool, 'account_lifecycle_tokens')).resolves.toBe(1);
    await expect(count(pool, 'account_lifecycle_delivery_intents')).resolves.toBe(1);
    await expect(count(pool, 'account_lifecycle_delivery_outbox')).resolves.toBe(1);
    await expect(count(pool, 'family_signup_requests')).resolves.toBe(0);
    await expect(count(pool, 'family_signup_consents')).resolves.toBe(0);
    await expect(count(pool, 'family_signup_outbox')).resolves.toBe(0);
  });

  it('fails closed for mismatched, future-dated, or non-provisioner compatibility evidence', async () => {
    const email = 'dual-role-negative@example.test';
    await provision(email);
    const principal = await insertParentSession(pool, email, 'negative-parent-session');
    const actionAt = new Date(PROVISION_AT.getTime() + 300_000);
    const service = parentService(pool, 'negative-student', actionAt);
    const attempt = (suffix: string) =>
      service.createStudent(
        principal,
        {
          expected_revision: 1,
          actual_name: 'Rejected Student',
          display_name: null,
          username: `rejected.${suffix}`,
          relationship: 'dependent',
          new_password: '000123',
          password_confirmation: '000123',
        },
        {
          idempotency_key: `negative-${suffix}-0001`,
          canonical_request_hash: 'd'.repeat(64),
          occurred_at: actionAt.toISOString(),
        },
      );

    await pool.query(
      `UPDATE onetime.v21_adult_identities
          SET normalized_email='arbitrary-dual-role@example.test',
              display_name='Arbitrary Dual Role Adult'`,
    );
    await expect(attempt('arbitrary-adult')).rejects.toThrow(
      /household access source is unavailable/i,
    );
    await pool.query(
      `UPDATE onetime.v21_adult_identities
          SET normalized_email=$1, display_name='Synthetic Dual Role Adult'`,
      [email],
    );

    await pool.query(
      `UPDATE onetime.account_access_projections SET policy_version='arbitrary-admin-override'`,
    );
    await expect(attempt('policy')).rejects.toThrow(/household access source is unavailable/i);
    await pool.query(`UPDATE onetime.account_access_projections SET policy_version=$1`, [
      CONTROLLER_DUAL_ROLE_PROVISIONING_POLICY,
    ]);

    await pool.query(`UPDATE onetime.account_access_source_states SET source_revision=2`);
    await expect(attempt('revision')).rejects.toThrow(/household access source is unavailable/i);
    await pool.query(`UPDATE onetime.account_access_source_states SET source_revision=1`);

    await pool.query(`UPDATE onetime.account_access_events SET actor_kind='admin'`);
    await expect(attempt('actor')).rejects.toThrow(/household access source is unavailable/i);
    await pool.query(`UPDATE onetime.account_access_events SET actor_kind='provisioner'`);

    const future = new Date(actionAt.getTime() + 60_000);
    await pool.query(`UPDATE onetime.v21_human_account_role_memberships SET granted_at=$1`, [
      future,
    ]);
    await expect(attempt('future-role')).rejects.toThrow(/household access source is unavailable/i);
    await pool.query(`UPDATE onetime.v21_human_account_role_memberships SET granted_at=$1`, [
      PROVISION_AT,
    ]);
    await pool.query(
      `UPDATE onetime.account_access_projections SET source_updated_at=$1;
       UPDATE onetime.account_access_source_states SET source_updated_at=$1;
       UPDATE onetime.account_access_events SET source_updated_at=$1`,
      [future],
    );
    await expect(attempt('future')).rejects.toThrow(/household access source is unavailable/i);
    await expect(count(pool, 'v21_student_profiles')).resolves.toBe(0);
    await expect(count(pool, 'portal_learners')).resolves.toBe(0);
    await expect(count(pool, 'admin_directory_receipts')).resolves.toBe(0);
  });

  it('accepts the bounded override one millisecond before expiry and rejects it at expiry', async () => {
    const beforeEmail = 'dual-role-before-expiry@example.test';
    await provision(beforeEmail);
    const beforePrincipal = await insertParentSession(pool, beforeEmail, 'before-expiry-session');
    const before = new Date(Date.parse(CONTROLLER_DUAL_ROLE_ACCESS_EXPIRES_AT) - 1);
    await expect(
      parentService(pool, 'before-expiry-student', before).createStudent(
        beforePrincipal,
        {
          expected_revision: 1,
          actual_name: 'Before Expiry Student',
          display_name: null,
          username: 'before.expiry.student',
          relationship: 'dependent',
          new_password: '000123',
          password_confirmation: '000123',
        },
        {
          idempotency_key: 'before-expiry-student-0001',
          canonical_request_hash: 'e'.repeat(64),
          occurred_at: before.toISOString(),
        },
      ),
    ).resolves.toMatchObject({ snapshot: { active_student_count: 1 } });

    const atEmail = 'dual-role-at-expiry@example.test';
    await provision(atEmail);
    const atPrincipal = await insertParentSession(pool, atEmail, 'at-expiry-session');
    const at = new Date(CONTROLLER_DUAL_ROLE_ACCESS_EXPIRES_AT);
    await expect(
      parentService(pool, 'at-expiry-student', at).createStudent(
        atPrincipal,
        {
          expected_revision: 1,
          actual_name: 'At Expiry Student',
          display_name: null,
          username: 'at.expiry.student',
          relationship: 'dependent',
          new_password: '000123',
          password_confirmation: '000123',
        },
        {
          idempotency_key: 'at-expiry-student-0001',
          canonical_request_hash: 'f'.repeat(64),
          occurred_at: at.toISOString(),
        },
      ),
    ).rejects.toThrow(/household access source is unavailable/i);
    await expect(
      countWhere(pool, 'v21_student_profiles', 'student_id', 'at-expiry-student'),
    ).resolves.toBe(0);
  });
});

async function provision(email: string) {
  return runDualRoleAdultProvision({
    manifest: privateManifest(email),
    apply: true,
    authorizationPhrase: AUTHORIZATION,
    pool,
    config,
    now: PROVISION_AT,
    testOnlyAllowIsolatedApply: true,
  });
}

async function seedOrdinaryLegacyUser(email: string) {
  await pool.query(
    `INSERT INTO onetime.account_users
       (user_key, account_key, product_key, email_normalized, display_name, role,
        password_hash, status, created_at, updated_at)
     VALUES ($1,$2,$3,$4,'Ordinary Known Adult','admin',$5,'active',$6,$6)`,
    [
      `ordinary-user-${createHash('sha256').update(email).digest('hex').slice(0, 24)}`,
      config.accountKey,
      config.productKey,
      email,
      hashAuthPassword('ordinary fixture password'),
      PROVISION_AT,
    ],
  );
}

function databaseIdentityPool(
  target: DbPool,
  identity: { database_name: string; server_address: string; server_version: string },
): DbPool {
  return {
    ...target,
    query: (async (statement: string | { text: string }, values?: unknown[]) => {
      const text = typeof statement === 'string' ? statement : statement.text;
      if (text.includes('current_database() AS database_name')) {
        return { rowCount: 1, rows: [identity] };
      }
      return target.query(statement as never, values as never);
    }) as DbPool['query'],
    connect: target.connect.bind(target),
    end: target.end.bind(target),
  } as DbPool;
}

function privateManifest(email: string) {
  return {
    schema_version: 'onetime.controller.dual_role_adult_provision.v1',
    operation_id: `test-${createHash('sha256').update(email).digest('hex').slice(0, 16)}`,
    authorized_at: PROVISION_AT.toISOString(),
    expires_at: new Date(PROVISION_AT.getTime() + 60 * 60 * 1000).toISOString(),
    expected_runtime_source_sha: SOURCE_SHA,
    authorization_phrase_sha256: createHash('sha256').update(AUTHORIZATION).digest('hex'),
    railway: {
      project_id: 'test-project-identity',
      environment_id: 'test-environment-identity',
      service_id: 'test-service-identity',
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
      household_display_name: 'Synthetic Dual Role Family',
      roles: ['admin', 'parent'],
      separate_family_household: true,
      canonical_access_state: 'free',
      compatibility_access: {
        source_kind: 'admin_override',
        actor_kind: 'provisioner',
        policy_version: CONTROLLER_DUAL_ROLE_PROVISIONING_POLICY,
        expires_at: CONTROLLER_DUAL_ROLE_ACCESS_EXPIRES_AT,
      },
      setup_delivery: {
        purpose: 'password_reset',
        send_now: true,
        max_message_count: 1,
      },
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

function testConfig() {
  return loadConfig({
    NODE_ENV: 'test',
    DELIVERY_ENVIRONMENT: 'isolated_staging',
    ONE_TIME_RUNTIME_ENVIRONMENT: 'isolated_staging',
    ONE_TIME_VERIFICATION_ENVIRONMENT_ID: 'ci',
    APP_VERSION: 'test',
    COMMIT_SHA: SOURCE_SHA,
    RAILWAY_PROJECT_ID: 'test-project-identity',
    RAILWAY_ENVIRONMENT_ID: 'test-environment-identity',
    RAILWAY_SERVICE_ID: 'test-service-identity',
    AUTH_CSRF_SECRET: 'dual-role-provisioning-auth-csrf-secret-for-tests',
    ONE_TIME_LIFECYCLE_DELIVERY_KEY: 'dual-role-provisioning-lifecycle-delivery-key-for-tests',
    OUTBOX_TRANSPORT_MODE: 'sink',
    PARENT_STUDENT_SERVICE_ACCOUNT_VERSION: 'test-parent-student-service-v1',
    PARENT_STUDENT_SERVICE_ACCOUNT_EVIDENCE_REFERENCE: 'test-evidence/parent-student-service-v1',
  });
}

function parentService(pool: DbPool, studentId: string, clock: Date) {
  return createParentHouseholdService({
    repository: createPostgresParentHouseholdRepository(pool, {
      acceptedServiceAccountVersion: 'test-parent-student-service-v1',
      immutableEvidenceReference: 'test-evidence/parent-student-service-v1',
      portalAccountKey: 'one_time',
      portalProductKey: 'one_time_mishnayos',
      clock: () => clock,
    }),
    passwords: { hash: async (password) => hashAuthPassword(password) },
    ids: { nextStudentId: () => studentId },
  });
}

async function insertParentSession(db: DbPool, email: string, sessionId: string) {
  const identity = await db.query(
    `SELECT adult.adult_id, account.human_account_id, account.security_version,
            household.household_id
       FROM onetime.v21_adult_identities AS adult
       JOIN onetime.v21_human_accounts AS account ON account.adult_id=adult.adult_id
       JOIN onetime.v21_households AS household
         ON household.owner_human_account_id=account.human_account_id
      WHERE adult.normalized_email=$1`,
    [email],
  );
  const row = identity.rows[0] as Record<string, unknown>;
  await db.query(
    `INSERT INTO onetime.v21_adult_sessions
       (session_id, human_account_id, active_role, active_household_id,
        access_token_digest, refresh_token_digest, security_version, version,
        idle_expires_at, absolute_expires_at, product_key, runtime_tier,
        verification_environment_id, created_at, updated_at)
     VALUES ($1,$2,'parent',$3,$4,$5,$6,1,
             '2026-09-20T12:00:00.000Z','2026-10-20T12:00:00.000Z',
             'one_time_mishnayos','isolated_staging','ci',$7,$7)`,
    [
      sessionId,
      row.human_account_id,
      row.household_id,
      createHash('sha256').update(`${sessionId}:access`).digest('hex'),
      createHash('sha256').update(`${sessionId}:refresh`).digest('hex'),
      row.security_version,
      PROVISION_AT,
    ],
  );
  return {
    role: 'parent' as const,
    adult_id: String(row.adult_id),
    household_id: String(row.household_id),
    session_id: sessionId,
  };
}

async function protectedCounts(db: DbPool) {
  return {
    adults: await count(db, 'v21_adult_identities'),
    accounts: await count(db, 'v21_human_accounts'),
    households: await count(db, 'v21_households'),
    legacyUsers: await count(db, 'account_users'),
    contacts: await count(db, 'contacts'),
    lifecycleTokens: await count(db, 'account_lifecycle_tokens'),
    outbox: await count(db, 'account_lifecycle_delivery_outbox'),
  };
}

async function seedUnrelatedEventRegistration(db: DbPool, email: string) {
  const definition = await db.query(
    `SELECT event_definition_key, account_key, product_key, event_code
       FROM onetime.event_definitions ORDER BY created_at LIMIT 1`,
  );
  const row = definition.rows[0] as Record<string, unknown>;
  await db.query(
    `INSERT INTO onetime.event_registrations
       (registration_key, event_definition_key, account_key, product_key, event_code,
        email_normalized, first_name, newsletter_opt_in,
        event_service_consent_policy_version, marketing_consent_policy_version,
        marketing_consent_recorded_at, initial_source, latest_source,
        first_seen_at, last_seen_at, registered_at, last_registered_at, metadata,
        created_at, updated_at)
     VALUES ($1,$2,$3,$4,$5,$6,'Synthetic',false,'event-service-test',NULL,NULL,
             'historical_event','historical_event',$7,$7,$7,$7,'{}'::jsonb,$7,$7)`,
    [
      `registration-${createHash('sha256').update(email).digest('hex').slice(0, 20)}`,
      row.event_definition_key,
      row.account_key,
      row.product_key,
      row.event_code,
      email,
      PROVISION_AT,
    ],
  );
}

async function seedCanonicalClassSeries(db: DbPool) {
  await db.query(
    `INSERT INTO onetime.class_series
       (class_series_key, account_key, product_key, title, timezone, local_start_time,
        reminder_local_time, status, series_state, is_canonical)
     VALUES ('dual-role-provisioning-canonical-class','one_time','one_time_mishnayos',
             'Synthetic canonical class','Asia/Jerusalem','19:00','18:30','active','active',true)`,
  );
}

async function unrelatedRegistration(db: DbPool, email: string) {
  const result = await db.query(
    `SELECT email_normalized, newsletter_opt_in
       FROM onetime.event_registrations WHERE email_normalized=$1`,
    [email],
  );
  return result.rows[0];
}

async function count(db: DbPool, table: string) {
  const result = await db.query(`SELECT count(*)::integer AS count FROM onetime.${table}`);
  return Number(result.rows[0]?.count ?? 0);
}

async function countWhere(db: DbPool, table: string, column: string, value: string) {
  const result = await db.query(
    `SELECT count(*)::integer AS count FROM onetime.${table} WHERE ${column}=$1`,
    [value],
  );
  return Number(result.rows[0]?.count ?? 0);
}

function createDbBackedDualRoleTestSessionRepository(db: DbPool): V21AdultSessionRepository {
  const production = createPostgresV21AdultSessionRepository(db);
  const parent = createDbBackedTestAdultSessionRepository(db);
  const readExactIdentity = async (
    input: Parameters<V21AdultSessionRepository['create']>[0],
  ): Promise<V21AdultLoginIdentity | null> => {
    const adult = await db.query(
      `SELECT normalized_email
         FROM onetime.v21_adult_identities
        WHERE adult_id=$1
          AND product_key='one_time_mishnayos'
          AND runtime_tier=$2
          AND verification_environment_id=$3
          AND state='active'`,
      [input.adultId, input.runtimeTier, input.verificationEnvironmentId],
    );
    const normalizedEmail = adult.rows[0]?.normalized_email;
    if (adult.rowCount !== 1 || typeof normalizedEmail !== 'string') return null;
    const identity = await production.findLoginIdentity({
      normalizedEmail,
      runtimeTier: input.runtimeTier,
      verificationEnvironmentId: input.verificationEnvironmentId,
    });
    if (
      !identity ||
      identity.adultId !== input.adultId ||
      identity.humanAccountId !== input.humanAccountId ||
      identity.securityVersion !== input.securityVersion ||
      identity.adultState !== 'active' ||
      identity.accountState !== 'active' ||
      !identity.memberships.includes(input.activeRole ?? 'parent')
    ) {
      return null;
    }
    return identity;
  };
  const enrichParent = async (resolved: ResolvedV21ParentSession) => {
    const identity = await production.findLoginIdentity({
      normalizedEmail: resolved.normalizedEmail,
      runtimeTier: resolved.session.runtimeTier,
      verificationEnvironmentId: resolved.session.verificationEnvironmentId,
    });
    if (
      !identity ||
      identity.adultId !== resolved.adultId ||
      identity.humanAccountId !== resolved.session.humanAccountId
    ) {
      throw new Error('The test Parent session identity could not be recomposed.');
    }
    return {
      ...resolved,
      ownedHouseholdCount: identity.activeOwnedHouseholdCount,
      memberships: identity.memberships,
    };
  };
  return {
    create: async (input) => {
      if (input.activeRole !== 'admin') return enrichParent(await parent.create(input));
      if (input.householdId !== null) throw new Error('Admin session cannot bind a household.');
      const identity = await readExactIdentity(input);
      if (!identity) throw new Error('Admin session identity binding is not eligible.');
      const idleExpiresAt = new Date(
        input.issuedAt.getTime() + ADULT_SESSION_POLICY.admin.idleMilliseconds,
      );
      const absoluteExpiresAt = new Date(
        input.issuedAt.getTime() + ADULT_SESSION_POLICY.admin.absoluteMilliseconds,
      );
      const inserted = await db.query(
        `INSERT INTO onetime.v21_adult_sessions
           (session_id, human_account_id, active_role, active_household_id,
            access_token_digest, refresh_token_digest, security_version, version,
            idle_expires_at, absolute_expires_at, product_key, runtime_tier,
            verification_environment_id, created_at, updated_at)
         VALUES ($1,$2,'admin',NULL,$3,$4,$5,1,$6,$7,'one_time_mishnayos',$8,$9,$10,$10)
         RETURNING *`,
        [
          input.sessionId,
          input.humanAccountId,
          input.accessTokenDigest,
          input.refreshTokenDigest,
          input.securityVersion,
          idleExpiresAt,
          absoluteExpiresAt,
          input.runtimeTier,
          input.verificationEnvironmentId,
          input.issuedAt,
        ],
      );
      const row = inserted.rows[0] as Record<string, unknown> | undefined;
      if (inserted.rowCount !== 1 || !row) throw new Error('Admin session was not inserted.');
      return resolvedAdminTestSession(identity, row);
    },
    resolve: async (input) => {
      if (input.activeRole !== 'admin') {
        const resolved = await parent.resolve(input);
        return resolved ? enrichParent(resolved) : null;
      }
      if (input.householdId !== null) return null;
      const digestColumn =
        input.tokenKind === 'access' ? 'access_token_digest' : 'refresh_token_digest';
      const result = await db.query(
        `SELECT *
           FROM onetime.v21_adult_sessions
          WHERE session_id=$1
            AND human_account_id=$2
            AND active_role='admin'
            AND active_household_id IS NULL
            AND product_key='one_time_mishnayos'
            AND runtime_tier=$3
            AND verification_environment_id=$4
            AND security_version=$5
            AND ${digestColumn}=$6
            AND revoked_at IS NULL
            AND idle_expires_at>$7
            AND absolute_expires_at>$7`,
        [
          input.sessionId,
          input.humanAccountId,
          input.runtimeTier,
          input.verificationEnvironmentId,
          input.securityVersion,
          input.tokenDigest,
          input.now,
        ],
      );
      if (result.rowCount !== 1) return null;
      const identity = await readExactIdentity({
        ...input,
        accessTokenDigest: input.tokenDigest,
        refreshTokenDigest: input.tokenDigest,
        issuedAt: input.now,
      });
      const row = result.rows[0] as Record<string, unknown> | undefined;
      return identity && row ? resolvedAdminTestSession(identity, row) : null;
    },
    revoke: async (input) => {
      if (input.activeRole !== 'admin') return parent.revoke(input);
      if (input.householdId !== null) return false;
      const digestColumn =
        input.tokenKind === 'access' ? 'access_token_digest' : 'refresh_token_digest';
      const revoked = await db.query(
        `UPDATE onetime.v21_adult_sessions
            SET revoked_at=$7, revoke_reason=$8, version=version+1, updated_at=$7
          WHERE session_id=$1
            AND human_account_id=$2
            AND active_role='admin'
            AND active_household_id IS NULL
            AND runtime_tier=$3
            AND verification_environment_id=$4
            AND security_version=$5
            AND ${digestColumn}=$6
            AND revoked_at IS NULL`,
        [
          input.sessionId,
          input.humanAccountId,
          input.runtimeTier,
          input.verificationEnvironmentId,
          input.securityVersion,
          input.tokenDigest,
          input.now,
          input.reason,
        ],
      );
      return revoked.rowCount === 1;
    },
    findLoginIdentity: production.findLoginIdentity,
    upgradeCredentialPasswordHash: production.upgradeCredentialPasswordHash,
  };
}

function resolvedAdminTestSession(
  identity: V21AdultLoginIdentity,
  row: Record<string, unknown>,
): ResolvedV21ParentSession {
  const timestamp = (value: unknown) =>
    value instanceof Date ? value.toISOString() : new Date(String(value)).toISOString();
  return {
    adultId: identity.adultId,
    normalizedEmail: identity.normalizedEmail,
    ownerDisplayName: identity.ownerDisplayName,
    ownedHouseholdCount: identity.activeOwnedHouseholdCount,
    memberships: identity.memberships,
    session: {
      sessionId: String(row.session_id),
      product: 'one_time_mishnayos',
      runtimeTier: String(row.runtime_tier) as 'isolated_staging' | 'production',
      verificationEnvironmentId: String(
        row.verification_environment_id,
      ) as ResolvedV21ParentSession['session']['verificationEnvironmentId'],
      humanAccountId: String(row.human_account_id),
      activeRole: 'admin',
      activeHouseholdId: null,
      securityVersion: Number(row.security_version),
      version: Number(row.version),
      idleExpiresAt: timestamp(row.idle_expires_at),
      absoluteExpiresAt: timestamp(row.absolute_expires_at),
      revokedAt: row.revoked_at ? timestamp(row.revoked_at) : null,
      revocationReason: row.revoke_reason ? String(row.revoke_reason) : null,
      createdAt: timestamp(row.created_at),
      updatedAt: timestamp(row.updated_at),
    },
    household: null,
  };
}

function prerequisiteOverridePool(
  db: DbPool,
  override: (
    kind: 'catalog' | 'trigger',
    rows: Record<string, unknown>[],
  ) => Record<string, unknown>[],
): DbPool {
  const query = (async (statement: string | { text: string }, values?: unknown[]) => {
    const result = await (
      db.query as unknown as (
        statement: string | { text: string },
        values?: unknown[],
      ) => Promise<{ rowCount: number | null; rows: Record<string, unknown>[] }>
    )(statement, values);
    const text = typeof statement === 'string' ? statement : statement.text;
    const kind = text.includes('controller_dual_role_apply_catalog_prerequisite')
      ? 'catalog'
      : text.includes('controller_dual_role_apply_trigger_prerequisite')
        ? 'trigger'
        : null;
    if (!kind) return result;
    const rows = override(kind, result.rows);
    return { ...result, rowCount: rows.length, rows };
  }) as DbPool['query'];
  return {
    query,
    connect: db.connect.bind(db) as DbPool['connect'],
    end: db.end.bind(db) as DbPool['end'],
  } as DbPool;
}

function canonicalTriggerCompatiblePool(memory: DbPool): DbPool {
  const advisoryLocks = new Map<string, { waiters: Array<() => void> }>();
  const acquireAdvisoryLock = async (key: string) => {
    const existing = advisoryLocks.get(key);
    if (existing) {
      await new Promise<void>((resolve) => existing.waiters.push(resolve));
    } else {
      advisoryLocks.set(key, { waiters: [] });
    }
    let released = false;
    return () => {
      if (released) return;
      released = true;
      const current = advisoryLocks.get(key);
      const next = current?.waiters.shift();
      if (next) next();
      else advisoryLocks.delete(key);
    };
  };
  const wrap = <T extends Queryable['query']>(
    query: T,
    receiver: object,
    transactionLocks?: Map<string, () => void>,
  ): T => {
    const invoke = query.bind(receiver) as unknown as (
      statement: string | { text: string },
      values?: unknown[],
    ) => Promise<{ rowCount: number | null; rows: Record<string, unknown>[] }>;
    return (async (statement: string | { text: string }, values?: unknown[]) => {
      const originalText = typeof statement === 'string' ? statement : statement.text;
      const text = originalText.replace(/\s+FOR UPDATE(?:\s+OF\s+[A-Za-z0-9_,.\s]+)?/gu, '');
      const rewritten = typeof statement === 'string' ? text : { ...statement, text };
      const normalized = text.trim().toUpperCase();
      if (text.includes('controller_dual_role_apply_catalog_prerequisite')) {
        const tableNames = Array.isArray(values?.[0]) ? values[0] : [];
        return {
          rowCount: tableNames.length,
          rows: tableNames.map((tableName) => ({
            table_name: tableName,
            owned_by_runtime: true,
            rls_disabled: true,
            can_select: true,
            can_insert: true,
            can_update: true,
          })),
        };
      }
      if (text.includes('controller_dual_role_apply_trigger_prerequisite')) {
        return { rowCount: 1, rows: [{ count: 1 }] };
      }
      if (text.includes('current_database() AS database_name')) {
        return {
          rowCount: 1,
          rows: [
            {
              database_name: 'pgmem_dual_role_provisioning_ci',
              server_address: '127.0.0.1',
              server_version: 'pg-mem-isolated-test-double',
            },
          ],
        };
      }
      if (transactionLocks && text.includes('pg_advisory_xact_lock')) {
        const key = JSON.stringify(values?.[0] ?? null);
        if (!transactionLocks.has(key)) {
          transactionLocks.set(key, await acquireAdvisoryLock(key));
        }
      }
      let result;
      try {
        result = await invoke(rewritten, values);
      } finally {
        if (transactionLocks && (normalized === 'COMMIT' || normalized === 'ROLLBACK')) {
          for (const release of transactionLocks.values()) release();
          transactionLocks.clear();
        }
      }
      if (
        text.includes('INSERT INTO onetime.canonical_state_transition_events') &&
        values?.[7] === 'controller_dual_role_adult_provision_v1'
      ) {
        await invoke(
          `INSERT INTO onetime.canonical_aggregate_states
             (aggregate_kind, aggregate_key, current_state, version, product_key,
              runtime_tier, verification_environment_id, last_transition_key,
              created_by_actor_kind, created_by_actor_key, last_mutated_by_actor_kind,
              last_mutated_by_actor_key, archived_at, created_at, updated_at)
           VALUES ($1,$2,$3,1,$4,$5,$6,$7,'system',$8,'system',$8,NULL,$9,$9)`,
          [
            values[1],
            values[2],
            values[3],
            values[4],
            values[5],
            values[6],
            values[0],
            values[7],
            values[11],
          ],
        );
      }
      return result;
    }) as T;
  };
  return {
    query: wrap(memory.query, memory),
    connect: (async () => {
      const client = await memory.connect();
      const transactionLocks = new Map<string, () => void>();
      return new Proxy(client, {
        get(target, property, receiver) {
          if (property === 'query') return wrap(target.query, target, transactionLocks);
          if (property === 'release') {
            return () => {
              for (const release of transactionLocks.values()) release();
              transactionLocks.clear();
              return target.release();
            };
          }
          const value = Reflect.get(target, property, receiver) as unknown;
          return typeof value === 'function' ? value.bind(target) : value;
        },
      });
    }) as DbPool['connect'],
    end: memory.end.bind(memory) as DbPool['end'],
    __memory: true,
  } as DbPool;
}
