import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { z } from 'zod';
import { CANONICAL_APPLICATION_ORIGIN } from '../../apps/web/src/server/features/domain-transition/policy.ts';
import { loadConfig, type AppConfig } from '../../packages/config/src/index.ts';
import {
  createPgPool,
  inTransaction,
  type DbPool,
  type Queryable,
} from '../../packages/db/src/index.ts';
import {
  CONTROLLER_DUAL_ROLE_ACCESS_EXPIRES_AT,
  CONTROLLER_DUAL_ROLE_PROVISIONING_ACTOR,
  CONTROLLER_DUAL_ROLE_PROVISIONING_POLICY,
  CONTROLLER_DUAL_ROLE_PROVISIONING_SCHEMA,
  controllerDualRoleAccessIdempotencyKey,
  controllerDualRoleAccessSourceReference,
  controllerDualRoleProvisionAuditKey,
  controllerDualRoleProvisionAuditMetadata,
  controllerDualRoleProvisioningIdentityKeys,
  controllerDualRoleSetupIdempotencyKey,
  isControllerDualRoleProvisioningCollisionCandidate,
  isControllerDualRoleProvisioningTarget,
} from '../../packages/domain/src/accounts/controller-dual-role-provisioning-policy.ts';
import { requestControllerDualRoleInitialPasswordSetup } from '../../packages/domain/src/accounts/lifecycle.ts';
import {
  accountAccessRequestHash,
  applyHouseholdAccessStateWithClient,
} from '../../packages/domain/src/access/service.ts';
import { hashAuthPassword } from '../../packages/domain/src/auth/policy.ts';
import { normalizeEmail, stableKey } from '../../packages/domain/src/lead/normalize.ts';

const AUTHORIZATION_MAX_AGE_MS = 4 * 60 * 60 * 1000;
const CLOCK_SKEW_MS = 5 * 60 * 1000;
const SETUP_TOKEN_TTL_MINUTES = 60;
const AUTHORIZATION_ENV = 'ONE_TIME_DUAL_ROLE_PROVISION_AUTHORIZATION';
const SCHEMA = CONTROLLER_DUAL_ROLE_PROVISIONING_SCHEMA;

export const CONTROLLER_DUAL_ROLE_APPLY_STAGES = [
  'transaction_begin',
  'advisory_lock',
  'locked_preflight',
  'adult_identity_insert',
  'human_account_insert',
  'role_memberships_insert',
  'family_household_insert',
  'credential_hash',
  'adult_credential_insert',
  'human_transition_insert',
  'access_transition_insert',
  'portal_household_insert',
  'access_projection_apply',
  'provision_audit_insert',
  'transactional_readback',
  'transaction_commit',
] as const;

export type ControllerDualRoleApplyStage = (typeof CONTROLLER_DUAL_ROLE_APPLY_STAGES)[number];

const APPLY_TABLE_CONTRACT = [
  { name: 'v21_adult_identities', update: false },
  { name: 'v21_human_accounts', update: false },
  { name: 'v21_human_account_role_memberships', update: false },
  { name: 'v21_households', update: false },
  { name: 'v21_adult_credentials', update: false },
  { name: 'canonical_state_transition_events', update: false },
  { name: 'canonical_aggregate_states', update: true },
  { name: 'portal_households', update: false },
  { name: 'account_access_source_states', update: true },
  { name: 'account_access_projections', update: true },
  { name: 'account_access_events', update: false },
  { name: 'account_lifecycle_audit_events', update: false },
  { name: 'account_lifecycle_tokens', update: true },
  { name: 'account_lifecycle_delivery_intents', update: false },
  { name: 'account_lifecycle_delivery_outbox', update: true },
] as const;

class ControllerDualRoleApplyStageError extends Error {
  readonly blocker: `apply_identity_${ControllerDualRoleApplyStage}_failed`;

  constructor(stage: ControllerDualRoleApplyStage) {
    super('The controller identity transaction failed at a classified stage.');
    this.name = 'ControllerDualRoleApplyStageError';
    this.blocker = `apply_identity_${stage}_failed`;
  }
}

export function isCanonicalControllerResetOrigin(value: string) {
  return value === CANONICAL_APPLICATION_ORIGIN || value === `${CANONICAL_APPLICATION_ORIGIN}/`;
}

const scopeSchema = z
  .object({
    account_key: z.string().trim().min(3).max(120),
    product_key: z.literal('one_time_mishnayos'),
    runtime_tier: z.enum(['isolated_staging', 'production']),
    verification_environment_id: z.enum([
      'ci',
      'provider_sandbox',
      'persistent_staging',
      'production_operator_canary',
      'production_broad',
    ]),
  })
  .strict();

const manifestSchema = z
  .object({
    schema_version: z.literal(SCHEMA),
    operation_id: z
      .string()
      .trim()
      .min(8)
      .max(120)
      .regex(/^[A-Za-z0-9:_-]+$/u),
    authorized_at: z.iso.datetime({ offset: true }),
    expires_at: z.iso.datetime({ offset: true }),
    expected_runtime_source_sha: z.string().regex(/^[a-f0-9]{40}$/u),
    authorization_phrase_sha256: z.string().regex(/^[a-f0-9]{64}$/u),
    railway: z
      .object({
        project_id: z.string().trim().min(8).max(160),
        environment_id: z.string().trim().min(8).max(160),
        service_id: z.string().trim().min(8).max(160),
      })
      .strict(),
    scope: scopeSchema,
    adult: z
      .object({
        email: z
          .string()
          .trim()
          .email()
          .refine((value) => value === normalizeEmail(value), 'Email must already be normalized.'),
        display_name: z.string().trim().min(2).max(120),
        household_display_name: z.string().trim().min(2).max(160),
        roles: z.tuple([z.literal('admin'), z.literal('parent')]),
        separate_family_household: z.literal(true),
        canonical_access_state: z.literal('free'),
        compatibility_access: z
          .object({
            source_kind: z.literal('admin_override'),
            actor_kind: z.literal('provisioner'),
            policy_version: z.literal(CONTROLLER_DUAL_ROLE_PROVISIONING_POLICY),
            expires_at: z.literal(CONTROLLER_DUAL_ROLE_ACCESS_EXPIRES_AT),
          })
          .strict(),
        setup_delivery: z
          .object({
            purpose: z.literal('password_reset'),
            send_now: z.literal(true),
            max_message_count: z.literal(1),
          })
          .strict(),
      })
      .strict(),
    preconditions: z
      .object({
        identity: z.literal('absent_or_exact_replay'),
        legacy_account_user_count: z.literal(0),
        local_contact_count: z.literal(0),
      })
      .strict(),
    prohibited_effects: z
      .object({
        create_legacy_account_user: z.literal(false),
        create_contact_or_ghl_projection: z.literal(false),
        create_student: z.literal(false),
        create_billing_or_payment_state: z.literal(false),
        record_terms_privacy_or_marketing_consent: z.literal(false),
      })
      .strict(),
  })
  .strict();

type Manifest = z.infer<typeof manifestSchema>;
type IdentityDisposition = 'absent' | 'exact_replay' | 'blocked';
type SetupDisposition =
  | 'planned'
  | 'queued'
  | 'already_queued'
  | 'provider_accepted'
  | 'delivered'
  | 'sink_delivered'
  | 'completed'
  | 'not_required'
  | 'blocked';

export type DualRoleAdultProvisionReport = {
  schema: typeof SCHEMA;
  generated_at: string;
  apply: boolean;
  status:
    | 'blocked'
    | 'dry_run_planned'
    | 'dry_run_replay'
    | 'applied'
    | 'replayed'
    | 'identity_applied_setup_pending';
  blockers: string[];
  identity: {
    disposition: IdentityDisposition;
    adult_rows: number;
    active_memberships: string[];
    family_households: number;
    canonical_access_state: string | null;
    compatibility_access_state: string | null;
    legacy_account_users: number;
    local_contacts: number;
    canonical_collision_candidates: number;
    legacy_collision_candidates: number;
    local_contact_collision_candidates: number;
  };
  setup_delivery: {
    purpose: 'password_reset';
    ttl_minutes: 60;
    disposition: SetupDisposition;
    token_rows: number;
    intent_rows: number;
    outbox_rows: number;
    external_send_performed_inline: false;
  };
  safety: {
    dry_run_default: true;
    strict_private_manifest: true;
    exact_source_and_runtime_required: true;
    ephemeral_authorization_required_for_apply: true;
    read_only_apply_prerequisite_check: true;
    sanitized_stage_failure_reporting: true;
    advisory_transaction_lock: true;
    one_adult_credential: true;
    no_legacy_adult: true;
    no_contact_or_ghl_effect: true;
    no_student_effect: true;
    no_billing_or_payment_claim: true;
    no_terms_privacy_or_marketing_claim: true;
    unrelated_event_registrations_ignored: true;
    compatibility_access_expires_at: typeof CONTROLLER_DUAL_ROLE_ACCESS_EXPIRES_AT;
    durable_access_source_required_before_expiry: true;
    raw_email_name_token_hash_url_or_database_ids_printed: false;
  };
};

export type DualRoleAdultProvisionOptions = {
  manifestPath?: string;
  manifest?: unknown;
  apply?: boolean;
  authorizationPhrase?: string;
  now?: Date;
  pool?: DbPool;
  config?: AppConfig;
  /** Tests only. The CLI has no flag for this bypass. */
  testOnlyAllowIsolatedApply?: boolean;
  /** Tests may wrap the real lifecycle function to capture a local proof token. */
  issuePasswordReset?: typeof requestControllerDualRoleInitialPasswordSetup;
  /** Tests only. The CLI has no failure-injection flag. */
  testOnlyFailApplyStage?: ControllerDualRoleApplyStage;
};

type TargetKeys = ReturnType<typeof targetKeys>;

type IdentityInspection = DualRoleAdultProvisionReport['identity'] & {
  credentialState: 'active' | 'reset_required' | 'disabled' | null;
  blockers: string[];
};

type SetupInspection = DualRoleAdultProvisionReport['setup_delivery'] & {
  blockers: string[];
};

export async function runDualRoleAdultProvision(
  options: DualRoleAdultProvisionOptions,
): Promise<DualRoleAdultProvisionReport> {
  const requestedNow = options.now ?? new Date();
  const apply = options.apply === true;
  const manifest = await loadManifest(options);
  const config = options.config ?? loadConfig(process.env);
  const keys = targetKeys(manifest);
  const pool = options.pool ?? createPgPool(config);
  const shouldClose = !options.pool;
  try {
    const isolatedSyntheticTestTarget = await verifyIsolatedSyntheticTestTarget(
      pool,
      config,
      options,
    );
    const now = isolatedSyntheticTestTarget ? requestedNow : new Date();
    const blockers = envelopeBlockers(manifest, config, options, now, isolatedSyntheticTestTarget);
    if (apply && !isolatedSyntheticTestTarget) {
      blockers.push(...(await productionWorkerBlockers(pool, config, now)));
    }
    const initial = await inspectIdentity(pool, config, manifest, keys, now);
    blockers.push(...initial.blockers);
    const initialSetup = await inspectSetup(pool, config, manifest, keys, now);
    if (initialSetup.blockers.length) blockers.push(...initialSetup.blockers);
    const prerequisiteInspectionAllowed =
      blockers.length === 0 ||
      (apply &&
        blockers.every((blocker): boolean => blocker === 'ephemeral_authorization_missing'));
    if (prerequisiteInspectionAllowed) {
      blockers.push(...(await applyPrerequisiteBlockers(pool, manifest, keys, initial)));
    }
    if (blockers.length) {
      return report(now, apply, 'blocked', blockers, initial, initialSetup);
    }
    if (!apply) {
      return report(
        now,
        false,
        initial.disposition === 'absent' ? 'dry_run_planned' : 'dry_run_replay',
        [],
        initial,
        initialSetup.token_rows === 0 && initialSetup.disposition !== 'blocked'
          ? { ...initialSetup, disposition: 'planned' }
          : initialSetup,
      );
    }

    let created: boolean;
    try {
      created = await applyIdentity(
        pool,
        config,
        manifest,
        keys,
        now,
        isolatedSyntheticTestTarget ? options.testOnlyFailApplyStage : undefined,
      );
    } catch (error) {
      const failureBlocker =
        error instanceof ControllerDualRoleApplyStageError
          ? error.blocker
          : 'apply_identity_unclassified_failure';
      return reconcileFailedIdentityApply(
        pool,
        config,
        manifest,
        keys,
        now,
        failureBlocker,
        initial,
        initialSetup,
      );
    }
    const identity = await inspectIdentity(pool, config, manifest, keys, now);
    if (identity.disposition !== 'exact_replay' || identity.blockers.length) {
      return report(now, true, 'blocked', identity.blockers, identity, initialSetup);
    }

    let setup = await inspectSetup(pool, config, manifest, keys, now);
    if (setup.disposition === 'blocked') {
      return report(now, true, 'identity_applied_setup_pending', setup.blockers, identity, setup);
    }
    if (setup.token_rows === 0 && identity.credentialState === 'reset_required') {
      try {
        const issue = options.issuePasswordReset ?? requestControllerDualRoleInitialPasswordSetup;
        await issue({
          pool,
          config,
          payload: {
            idempotency_key: keys.setupIdempotencyKey,
            email: manifest.adult.email,
          },
          now,
        });
      } catch {
        setup = { ...setup, disposition: 'blocked', blockers: ['setup_delivery_not_reconciled'] };
        return report(now, true, 'identity_applied_setup_pending', setup.blockers, identity, setup);
      }
      setup = await inspectSetup(pool, config, manifest, keys, now);
      if (setup.disposition === 'blocked' || setup.token_rows !== 1) {
        return report(
          now,
          true,
          'identity_applied_setup_pending',
          setup.blockers.length ? setup.blockers : ['setup_delivery_not_reconciled'],
          identity,
          setup,
        );
      }
    } else if (setup.token_rows === 1 && setup.disposition === 'queued') {
      setup = { ...setup, disposition: 'already_queued' };
    } else if (setup.token_rows === 0 && identity.credentialState === 'active') {
      setup = { ...setup, disposition: 'not_required' };
    }
    return report(now, true, created ? 'applied' : 'replayed', [], identity, setup);
  } finally {
    if (shouldClose) await pool.end();
  }
}

async function loadManifest(options: DualRoleAdultProvisionOptions): Promise<Manifest> {
  let value = options.manifest;
  if (value === undefined) {
    if (!options.manifestPath) throw new Error('A private manifest path is required.');
    value = JSON.parse((await readFile(options.manifestPath, 'utf8')).replace(/^\uFEFF/u, ''));
  }
  const parsed = manifestSchema.safeParse(value);
  if (!parsed.success) {
    const fields = [...new Set(parsed.error.issues.map((issue) => issue.path.join('.')))].sort();
    throw new Error(`Invalid private manifest fields: ${fields.join(', ') || 'root'}.`);
  }
  return parsed.data;
}

function envelopeBlockers(
  manifest: Manifest,
  config: AppConfig,
  options: DualRoleAdultProvisionOptions,
  now: Date,
  isolatedSyntheticTestTarget: boolean,
) {
  const blockers: string[] = [];
  if (
    !isolatedSyntheticTestTarget &&
    (options.now !== undefined ||
      options.pool !== undefined ||
      options.config !== undefined ||
      options.issuePasswordReset !== undefined ||
      options.testOnlyAllowIsolatedApply !== undefined ||
      options.testOnlyFailApplyStage !== undefined)
  ) {
    blockers.push('production_injection_seam_forbidden');
  }
  if (
    !isolatedSyntheticTestTarget &&
    !isControllerDualRoleProvisioningTarget({
      normalizedEmail: manifest.adult.email,
      displayName: manifest.adult.display_name,
    })
  ) {
    blockers.push('controller_target_mismatch');
  }
  const authorizedAt = Date.parse(manifest.authorized_at);
  const expiresAt = Date.parse(manifest.expires_at);
  if (authorizedAt > now.getTime() + CLOCK_SKEW_MS) blockers.push('authorization_not_yet_valid');
  if (authorizedAt < now.getTime() - AUTHORIZATION_MAX_AGE_MS) {
    blockers.push('authorization_too_old');
  }
  if (
    expiresAt <= authorizedAt ||
    expiresAt <= now.getTime() ||
    expiresAt > authorizedAt + AUTHORIZATION_MAX_AGE_MS
  ) {
    blockers.push('authorization_expired_or_too_broad');
  }
  if (Date.parse(CONTROLLER_DUAL_ROLE_ACCESS_EXPIRES_AT) <= now.getTime()) {
    blockers.push('compatibility_access_window_expired');
  }
  if (manifest.expected_runtime_source_sha !== config.commitSha)
    blockers.push('runtime_sha_mismatch');
  if (config.railwayGitCommitSha && config.railwayGitCommitSha !== config.commitSha) {
    blockers.push('railway_git_sha_mismatch');
  }
  if (manifest.scope.account_key !== config.accountKey) blockers.push('account_scope_mismatch');
  if (manifest.scope.product_key !== config.productKey) blockers.push('product_scope_mismatch');
  if (manifest.scope.runtime_tier !== config.oneTimeRuntimeTier) {
    blockers.push('runtime_tier_mismatch');
  }
  if (manifest.scope.verification_environment_id !== config.oneTimeVerificationEnvironmentId) {
    blockers.push('verification_environment_mismatch');
  }
  if (manifest.railway.project_id !== config.railwayProjectId)
    blockers.push('railway_project_mismatch');
  if (manifest.railway.environment_id !== config.railwayEnvironmentId) {
    blockers.push('railway_environment_mismatch');
  }
  if (manifest.railway.service_id !== config.railwayServiceId)
    blockers.push('railway_service_mismatch');
  if (!options.apply) return blockers;
  if (!options.authorizationPhrase) blockers.push('ephemeral_authorization_missing');
  else if (!sha256Equals(options.authorizationPhrase, manifest.authorization_phrase_sha256)) {
    blockers.push('ephemeral_authorization_mismatch');
  }
  if (!isolatedSyntheticTestTarget) {
    if (
      !config.railwayGitCommitSha ||
      !/^[a-f0-9]{40}$/u.test(config.railwayGitCommitSha) ||
      config.railwayGitCommitSha !== config.commitSha ||
      config.railwayGitCommitSha !== manifest.expected_runtime_source_sha
    ) {
      blockers.push('railway_git_sha_missing_or_mismatch');
    }
    if (config.nodeEnv !== 'production' || config.oneTimeRuntimeTier !== 'production') {
      blockers.push('production_runtime_required');
    }
    if (!isCanonicalControllerResetOrigin(config.publicBaseUrl)) {
      blockers.push('canonical_reset_origin_mismatch');
    }
    if (!config.oneTimeVerificationWritesAllowed) blockers.push('production_writes_not_allowed');
    blockers.push(...transactionalEmailBlockers(config));
  }
  return blockers;
}

async function verifyIsolatedSyntheticTestTarget(
  pool: DbPool,
  config: AppConfig,
  options: DualRoleAdultProvisionOptions,
) {
  if (options.testOnlyAllowIsolatedApply !== true) return false;
  if (
    config.nodeEnv !== 'test' ||
    config.oneTimeRuntimeTier !== 'isolated_staging' ||
    config.oneTimeVerificationEnvironmentId !== 'ci' ||
    process.env.VITEST !== 'true'
  ) {
    return false;
  }
  try {
    const result = await pool.query(
      `SELECT current_database() AS database_name,
              COALESCE(inet_server_addr()::text, 'local_socket') AS server_address,
              version() AS server_version`,
    );
    if (result.rows.length !== 1) return false;
    const row = result.rows[0] as Record<string, unknown>;
    const databaseName = String(row.database_name ?? '');
    const serverAddress = String(row.server_address ?? '');
    const serverVersion = String(row.server_version ?? '');
    const nativeDisposable = isNativeDisposablePostgresTarget({
      databaseName,
      serverAddress,
    });
    const memoryDouble =
      databaseName === 'pgmem_dual_role_provisioning_ci' &&
      serverAddress === '127.0.0.1' &&
      serverVersion === 'pg-mem-isolated-test-double';
    return nativeDisposable || memoryDouble;
  } catch {
    return false;
  }
}

export function isIsolatedPostgresServerAddress(value: string) {
  const address = value.trim();
  if (address === 'local_socket') return true;
  if (/^::1(?:\/(?:[0-9]|[1-9][0-9]|1[01][0-9]|12[0-8]))?$/u.test(address)) return true;

  const match = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})(?:\/(\d{1,2}))?$/u.exec(address);
  if (!match) return false;
  const octets = match.slice(1, 5).map(Number);
  if (octets.some((octet) => !Number.isInteger(octet) || octet < 0 || octet > 255)) {
    return false;
  }
  const prefix = match[5] === undefined ? undefined : Number(match[5]);
  if (prefix !== undefined && (prefix < 0 || prefix > 32)) return false;

  const first = octets[0];
  const second = octets[1];
  if (first === undefined || second === undefined) return false;
  return (
    first === 127 ||
    first === 10 ||
    (first === 172 && second >= 16 && second <= 31) ||
    (first === 192 && second === 168)
  );
}

export function isNativeDisposablePostgresTarget(input: {
  databaseName: string;
  serverAddress: string;
  environment?: Record<string, string | undefined>;
}) {
  const environment = input.environment ?? process.env;
  if (environment.DUAL_ROLE_PROVISION_NATIVE_POSTGRES_DISPOSABLE !== 'true') return false;
  if (!/^onetime_dual_role_provision_ci_(?:16|18)$/u.test(input.databaseName)) return false;
  if (!isIsolatedPostgresServerAddress(input.serverAddress)) return false;
  if (!isLoopbackConnectionHost(environment.PGHOST ?? '')) return false;

  try {
    const connection = new URL(environment.DUAL_ROLE_PROVISION_NATIVE_DATABASE_URL ?? '');
    if (connection.protocol !== 'postgresql:') return false;
    if (!isLoopbackConnectionHost(connection.hostname)) return false;
    const databaseName = decodeURIComponent(connection.pathname.replace(/^\//u, ''));
    return databaseName === input.databaseName && !databaseName.includes('/');
  } catch {
    return false;
  }
}

function isLoopbackConnectionHost(value: string) {
  const host = value
    .trim()
    .toLowerCase()
    .replace(/^\[|\]$/gu, '');
  if (host === 'localhost' || host === '::1') return true;
  const match = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/u.exec(host);
  if (!match) return false;
  const octets = match.slice(1, 5).map(Number);
  return octets.every((octet) => octet >= 0 && octet <= 255) && octets[0] === 127;
}

async function productionWorkerBlockers(pool: DbPool, config: AppConfig, now: Date) {
  try {
    const result = await pool.query(
      `SELECT count(*)::integer AS count
         FROM onetime.worker_heartbeats
        WHERE account_key=$1 AND product_key=$2
          AND worker_type='delivery_outbox' AND state='ready'
          AND last_seen_at >= $3::timestamptz - interval '120 seconds'
          AND lease_expires_at > $3::timestamptz
          AND commit_sha=$4`,
      [config.accountKey, config.productKey, now, config.commitSha],
    );
    return Number(result.rows[0]?.count ?? 0) > 0 ? [] : ['lifecycle_delivery_worker_not_ready'];
  } catch {
    return ['lifecycle_delivery_worker_readback_unavailable'];
  }
}

function transactionalEmailBlockers(config: AppConfig) {
  const blockers: string[] = [];
  if (config.lifecycleEmailMode !== 'transactional')
    blockers.push('transactional_email_mode_missing');
  if (!config.lifecycleDeliveryKeyConfigured) blockers.push('lifecycle_delivery_key_missing');
  if (!config.deliveryProviderAuthorizationId) blockers.push('delivery_authorization_missing');
  if (!config.deliveryProviderTransportEnabled || !config.resendTransportEnabled) {
    blockers.push('resend_transport_not_fully_enabled');
  }
  if (!config.resendApiKey) blockers.push('resend_api_key_missing');
  if (!config.resendWebhookEnabled || !config.resendWebhookSecretConfigured) {
    blockers.push('resend_webhook_not_ready');
  }
  if (normalizedAddress(config.emailFrom) !== 'info@onetimeonetime.com') {
    blockers.push('transactional_sender_mismatch');
  }
  if (normalizedAddress(config.emailReplyTo) !== 'info@onetimeonetime.com') {
    blockers.push('transactional_reply_to_mismatch');
  }
  if (config.deliveryProviderPerRunBudget <= 0 || config.deliveryProviderPerProviderBudget <= 0) {
    blockers.push('delivery_budget_missing');
  }
  return blockers;
}

async function applyPrerequisiteBlockers(
  pool: DbPool,
  manifest: Manifest,
  keys: TargetKeys,
  initial: IdentityInspection,
) {
  const blockers: string[] = [];
  try {
    const catalog = await pool.query(
      `/* controller_dual_role_apply_catalog_prerequisite */
       SELECT tables.relname AS table_name,
              pg_get_userbyid(tables.relowner) = current_user AS owned_by_runtime,
              NOT tables.relrowsecurity AND NOT tables.relforcerowsecurity AS rls_disabled,
              has_table_privilege(tables.oid, 'SELECT') AS can_select,
              has_table_privilege(tables.oid, 'INSERT') AS can_insert,
              has_table_privilege(tables.oid, 'UPDATE') AS can_update
         FROM pg_catalog.pg_class AS tables
         JOIN pg_catalog.pg_namespace AS namespaces
           ON namespaces.oid=tables.relnamespace
        WHERE namespaces.nspname='onetime'
          AND tables.relkind IN ('r','p')
          AND tables.relname=ANY($1::text[])`,
      [APPLY_TABLE_CONTRACT.map((entry) => entry.name)],
    );
    const byName = new Map(
      catalog.rows.map((row) => [String(row.table_name), row as Record<string, unknown>]),
    );
    if (
      byName.size !== APPLY_TABLE_CONTRACT.length ||
      APPLY_TABLE_CONTRACT.some((entry) => {
        const row = byName.get(entry.name);
        return !row || row.owned_by_runtime !== true || row.rls_disabled !== true;
      })
    ) {
      blockers.push('apply_prerequisite_table_contract_mismatch');
    }
    if (
      APPLY_TABLE_CONTRACT.some((entry) => {
        const row = byName.get(entry.name);
        return (
          !row ||
          row.can_select !== true ||
          row.can_insert !== true ||
          (entry.update && row.can_update !== true)
        );
      })
    ) {
      blockers.push('apply_prerequisite_privilege_contract_mismatch');
    }

    const trigger = await pool.query(
      `/* controller_dual_role_apply_trigger_prerequisite */
       SELECT count(*)::integer AS count
         FROM pg_catalog.pg_trigger AS triggers
         JOIN pg_catalog.pg_class AS tables ON tables.oid=triggers.tgrelid
         JOIN pg_catalog.pg_namespace AS table_namespaces
           ON table_namespaces.oid=tables.relnamespace
         JOIN pg_catalog.pg_proc AS functions ON functions.oid=triggers.tgfoid
         JOIN pg_catalog.pg_namespace AS function_namespaces
           ON function_namespaces.oid=functions.pronamespace
        WHERE table_namespaces.nspname='onetime'
          AND tables.relname='canonical_state_transition_events'
          AND triggers.tgname='canonical_state_transition_apply'
          AND triggers.tgtype=(1 | 2 | 4) /* ROW | BEFORE | INSERT */
          AND triggers.tgenabled IN ('O','A')
          AND NOT triggers.tgisinternal
          AND function_namespaces.nspname='onetime'
          AND functions.proname='apply_canonical_state_transition'`,
    );
    if (Number(trigger.rows[0]?.count ?? 0) !== 1) {
      blockers.push('apply_prerequisite_trigger_contract_mismatch');
    }
  } catch {
    blockers.push('apply_prerequisite_catalog_unavailable');
  }

  if (initial.disposition === 'absent') {
    try {
      if ((await targetKeyCollisionCount(pool, manifest, keys)) !== 0) {
        blockers.push('apply_prerequisite_target_key_collision');
      }
    } catch {
      blockers.push('apply_prerequisite_key_check_unavailable');
    }
  }
  return [...new Set(blockers)];
}

async function targetKeyCollisionCount(db: Queryable, manifest: Manifest, keys: TargetKeys) {
  const counts = await Promise.all([
    countQuery(
      db,
      `SELECT count(*)::integer AS count FROM onetime.v21_adult_identities
        WHERE adult_id=$1 OR normalized_email=$2`,
      [keys.adultId, manifest.adult.email],
    ),
    countQuery(
      db,
      `SELECT count(*)::integer AS count FROM onetime.v21_human_accounts
        WHERE human_account_id=$1 OR adult_id=$2`,
      [keys.humanAccountId, keys.adultId],
    ),
    countQuery(
      db,
      `SELECT count(*)::integer AS count FROM onetime.v21_human_account_role_memberships
        WHERE human_account_id=$1`,
      [keys.humanAccountId],
    ),
    countQuery(
      db,
      `SELECT count(*)::integer AS count FROM onetime.v21_households
        WHERE household_id=$1 OR owner_adult_id=$2 OR owner_human_account_id=$3`,
      [keys.householdId, keys.adultId, keys.humanAccountId],
    ),
    countQuery(
      db,
      `SELECT count(*)::integer AS count FROM onetime.v21_adult_credentials
        WHERE human_account_id=$1 OR adult_id=$2`,
      [keys.humanAccountId, keys.adultId],
    ),
    countQuery(
      db,
      `SELECT count(*)::integer AS count FROM onetime.canonical_state_transition_events
        WHERE transition_key IN ($1,$2)`,
      [keys.humanTransitionKey, keys.accessTransitionKey],
    ),
    countQuery(
      db,
      `SELECT count(*)::integer AS count FROM onetime.canonical_aggregate_states
        WHERE (aggregate_kind='human_account' AND aggregate_key=$1)
           OR (aggregate_kind='access' AND aggregate_key=$2)`,
      [keys.humanAccountId, keys.householdId],
    ),
    countQuery(
      db,
      `SELECT count(*)::integer AS count FROM onetime.portal_households
        WHERE household_key=$1
           OR (account_key=$2 AND product_key=$3 AND household_key=$1)`,
      [keys.householdId, manifest.scope.account_key, manifest.scope.product_key],
    ),
    countQuery(
      db,
      `SELECT count(*)::integer AS count FROM onetime.account_access_source_states
        WHERE source_state_key=$1
           OR (account_key=$2 AND product_key=$3 AND household_key=$4
               AND source_slot='complimentary')
           OR opaque_source_reference=$5`,
      [
        keys.accessSourceStateKey,
        manifest.scope.account_key,
        manifest.scope.product_key,
        keys.householdId,
        keys.accessSourceReference,
      ],
    ),
    countQuery(
      db,
      `SELECT count(*)::integer AS count FROM onetime.account_access_projections
        WHERE access_key=$1
           OR (account_key=$2 AND product_key=$3 AND household_key=$4)
           OR opaque_source_reference=$5`,
      [
        keys.accessProjectionKey,
        manifest.scope.account_key,
        manifest.scope.product_key,
        keys.householdId,
        keys.accessSourceReference,
      ],
    ),
    countQuery(
      db,
      `SELECT count(*)::integer AS count FROM onetime.account_access_events
        WHERE event_key=$1
           OR (account_key=$2 AND product_key=$3 AND idempotency_key=$4)
           OR source_reference_digest=$5`,
      [
        keys.accessEventKey,
        manifest.scope.account_key,
        manifest.scope.product_key,
        keys.accessIdempotencyKey,
        keys.accessSourceReferenceDigest,
      ],
    ),
    countQuery(
      db,
      `SELECT count(*)::integer AS count FROM onetime.account_lifecycle_audit_events
        WHERE audit_key=$1`,
      [keys.auditKey],
    ),
    countQuery(
      db,
      `SELECT count(*)::integer AS count FROM onetime.account_lifecycle_tokens
        WHERE token_key=$1 OR subject_human_account_id=$2 OR email_normalized=$3`,
      [keys.setupTokenKey, keys.humanAccountId, manifest.adult.email],
    ),
    countQuery(
      db,
      `SELECT count(*)::integer AS count FROM onetime.account_lifecycle_delivery_intents
        WHERE intent_key=$1 OR idempotency_key=$2 OR recipient_email=$3`,
      [keys.setupIntentKey, keys.setupIdempotencyKey, manifest.adult.email],
    ),
    countQuery(
      db,
      `SELECT count(*)::integer AS count FROM onetime.account_lifecycle_delivery_outbox
        WHERE delivery_key=$1 OR idempotency_key=$2 OR destination_ref=$3`,
      [keys.setupDeliveryKey, keys.setupIdempotencyKey, keys.setupDestinationRef],
    ),
  ]);
  return counts.reduce((total, count) => total + count, 0);
}

function targetKeys(manifest: Manifest) {
  const parts = [
    manifest.scope.account_key,
    manifest.scope.product_key,
    manifest.scope.runtime_tier,
    manifest.scope.verification_environment_id,
    manifest.adult.email,
  ];
  const { adultId, humanAccountId, householdId } = controllerDualRoleProvisioningIdentityKeys({
    accountKey: manifest.scope.account_key,
    productKey: manifest.scope.product_key,
    runtimeTier: manifest.scope.runtime_tier,
    verificationEnvironmentId: manifest.scope.verification_environment_id,
    normalizedEmail: manifest.adult.email,
  });
  const canonicalRequestHash = sha256(
    JSON.stringify({
      schema: SCHEMA,
      adult_id: adultId,
      human_account_id: humanAccountId,
      household_id: householdId,
      household_display_name: manifest.adult.household_display_name,
      roles: ['admin', 'parent'],
      access: 'free',
      compatibility_policy: CONTROLLER_DUAL_ROLE_PROVISIONING_POLICY,
      compatibility_expires_at: CONTROLLER_DUAL_ROLE_ACCESS_EXPIRES_AT,
    }),
  );
  const policyScope = {
    accountKey: manifest.scope.account_key,
    productKey: manifest.scope.product_key,
    runtimeTier: manifest.scope.runtime_tier,
    verificationEnvironmentId: manifest.scope.verification_environment_id,
    normalizedEmail: manifest.adult.email,
  };
  const setupIdempotencyKey = controllerDualRoleSetupIdempotencyKey(policyScope);
  const accessIdempotencyKey = controllerDualRoleAccessIdempotencyKey(householdId);
  const accessSourceReference = controllerDualRoleAccessSourceReference(householdId);
  const setupTokenKey = stableKey('account_lifecycle_token', [
    manifest.scope.account_key,
    manifest.scope.product_key,
    'password_reset',
    setupIdempotencyKey,
  ]);
  return {
    adultId,
    humanAccountId,
    householdId,
    humanTransitionKey: stableKey('canonical_transition', [...parts, 'human_account_active']),
    accessTransitionKey: stableKey('canonical_transition', [...parts, 'access_free']),
    auditKey: controllerDualRoleProvisionAuditKey(policyScope),
    canonicalRequestHash,
    accessIdempotencyKey,
    accessEventKey: stableKey('account_access_event', [
      manifest.scope.account_key,
      manifest.scope.product_key,
      accessIdempotencyKey,
    ]),
    accessSourceStateKey: stableKey('account_access_source', [
      manifest.scope.account_key,
      manifest.scope.product_key,
      householdId,
      'complimentary',
    ]),
    accessProjectionKey: stableKey('account_access', [
      manifest.scope.account_key,
      manifest.scope.product_key,
      householdId,
    ]),
    accessSourceReference,
    accessSourceReferenceDigest: sha256(accessSourceReference),
    setupIdempotencyKey,
    setupTokenKey,
    setupIntentKey: stableKey('account_lifecycle_delivery', [
      setupTokenKey,
      'password_reset',
      setupIdempotencyKey,
    ]),
    setupDeliveryKey: stableKey('account_lifecycle_delivery_outbox', [
      manifest.scope.account_key,
      manifest.scope.product_key,
      'password_reset',
      setupIdempotencyKey,
    ]),
    setupDestinationRef: sha256(manifest.adult.email),
    setupRequestHash: sha256(
      JSON.stringify({
        email: manifest.adult.email,
        idempotency_key: setupIdempotencyKey,
      }),
    ),
  };
}

async function inspectIdentity(
  db: Queryable,
  config: AppConfig,
  manifest: Manifest,
  keys: TargetKeys,
  now: Date,
): Promise<IdentityInspection> {
  const adults = await db.query(
    `SELECT adult_id, display_name, state, product_key, runtime_tier, verification_environment_id
       FROM onetime.v21_adult_identities
      WHERE normalized_email = $1`,
    [manifest.adult.email],
  );
  const legacy = await countQuery(
    db,
    `SELECT count(*)::integer AS count FROM onetime.account_users
      WHERE account_key = $1 AND product_key = $2 AND email_normalized = $3`,
    [config.accountKey, config.productKey, manifest.adult.email],
  );
  const contacts = await countQuery(
    db,
    `SELECT count(*)::integer AS count FROM onetime.contacts
      WHERE account_key = $1 AND product_key = $2 AND email_normalized = $3`,
    [config.accountKey, config.productKey, manifest.adult.email],
  );
  const localContactCandidateRows = await db.query(
    `SELECT email_normalized, display_name
       FROM onetime.contacts
      WHERE account_key=$1 AND product_key=$2`,
    [config.accountKey, config.productKey],
  );
  const localContactCollisionCandidates = localContactCandidateRows.rows.filter((row) =>
    isControllerDualRoleProvisioningCollisionCandidate({
      normalizedEmail: String(row.email_normalized ?? ''),
      displayName: String(row.display_name ?? ''),
    }),
  ).length;
  const canonicalCandidateRows = await db.query(
    `SELECT adult_id, normalized_email, display_name
       FROM onetime.v21_adult_identities`,
  );
  const canonicalCollisionCandidates = canonicalCandidateRows.rows.filter((row) => {
    const candidate = row as Record<string, unknown>;
    if (
      candidate.adult_id === keys.adultId &&
      candidate.normalized_email === manifest.adult.email &&
      candidate.display_name === manifest.adult.display_name
    ) {
      return false;
    }
    return isControllerDualRoleProvisioningCollisionCandidate({
      normalizedEmail: String(candidate.normalized_email ?? ''),
      displayName: String(candidate.display_name ?? ''),
    });
  }).length;
  const legacyCandidateRows = await db.query(
    `SELECT email_normalized, display_name
       FROM onetime.account_users
      WHERE account_key=$1 AND product_key=$2`,
    [config.accountKey, config.productKey],
  );
  const legacyCollisionCandidates = legacyCandidateRows.rows.filter((row) =>
    isControllerDualRoleProvisioningCollisionCandidate({
      normalizedEmail: String(row.email_normalized ?? ''),
      displayName: String(row.display_name ?? ''),
    }),
  ).length;
  const blockers: string[] = [];
  if (legacy !== 0) blockers.push('legacy_identity_collision');
  if (contacts !== 0) blockers.push('local_contact_collision');
  if (localContactCollisionCandidates !== 0) {
    blockers.push('local_contact_collision_candidate');
  }
  if (canonicalCollisionCandidates !== 0) blockers.push('canonical_identity_collision_candidate');
  if (legacyCollisionCandidates !== 0) blockers.push('legacy_identity_collision_candidate');
  const base = {
    adult_rows: adults.rows.length,
    active_memberships: [] as string[],
    family_households: 0,
    canonical_access_state: null as string | null,
    compatibility_access_state: null as string | null,
    legacy_account_users: legacy,
    local_contacts: contacts,
    canonical_collision_candidates: canonicalCollisionCandidates,
    legacy_collision_candidates: legacyCollisionCandidates,
    local_contact_collision_candidates: localContactCollisionCandidates,
  };
  const prohibited = await prohibitedCounts(db, manifest, keys);
  if (Object.values(prohibited).some((value) => value !== 0)) {
    blockers.push('prohibited_projection_present');
  }
  if (!adults.rows.length) {
    return {
      ...base,
      disposition: blockers.length ? 'blocked' : 'absent',
      credentialState: null,
      blockers,
    };
  }
  if (adults.rows.length !== 1) blockers.push('canonical_identity_ambiguous');
  const adult = adults.rows[0] as Record<string, unknown> | undefined;
  if (
    !adult ||
    adult.adult_id !== keys.adultId ||
    adult.display_name !== manifest.adult.display_name ||
    adult.state !== 'active' ||
    adult.product_key !== manifest.scope.product_key ||
    adult.runtime_tier !== manifest.scope.runtime_tier ||
    adult.verification_environment_id !== manifest.scope.verification_environment_id
  ) {
    blockers.push('canonical_adult_mismatch');
  }
  const accounts = await db.query(
    `SELECT human_account_id, adult_id, state
       FROM onetime.v21_human_accounts WHERE adult_id = $1`,
    [keys.adultId],
  );
  if (
    accounts.rows.length !== 1 ||
    accounts.rows[0]?.human_account_id !== keys.humanAccountId ||
    accounts.rows[0]?.state !== 'active'
  ) {
    blockers.push('human_account_mismatch');
  }
  const memberships = await db.query(
    `SELECT role FROM onetime.v21_human_account_role_memberships
      WHERE human_account_id = $1 AND revoked_at IS NULL ORDER BY role`,
    [keys.humanAccountId],
  );
  const activeMemberships = memberships.rows.map((row) => String(row.role));
  if (JSON.stringify(activeMemberships) !== JSON.stringify(['admin', 'parent'])) {
    blockers.push('dual_role_membership_mismatch');
  }
  const credentials = await db.query(
    `SELECT adult_id, credential_state FROM onetime.v21_adult_credentials
      WHERE human_account_id = $1`,
    [keys.humanAccountId],
  );
  const credentialState = credentials.rows[0]?.credential_state as
    'active' | 'reset_required' | 'disabled' | undefined;
  if (
    credentials.rows.length !== 1 ||
    credentials.rows[0]?.adult_id !== keys.adultId ||
    !['active', 'reset_required'].includes(String(credentialState))
  ) {
    blockers.push('adult_credential_mismatch');
  }
  const households = await db.query(
    `SELECT household_id, classification, state, seat_limit, owner_adult_id,
            owner_human_account_id, billing_account_ref
       FROM onetime.v21_households WHERE owner_human_account_id = $1`,
    [keys.humanAccountId],
  );
  if (
    households.rows.length !== 1 ||
    households.rows[0]?.household_id !== keys.householdId ||
    households.rows[0]?.classification !== 'family' ||
    households.rows[0]?.state !== 'active' ||
    Number(households.rows[0]?.seat_limit) !== 3 ||
    households.rows[0]?.owner_adult_id !== keys.adultId ||
    households.rows[0]?.billing_account_ref !== null
  ) {
    blockers.push('family_household_mismatch');
  }
  const states = await db.query(
    `SELECT aggregate_kind, aggregate_key, current_state, version, last_transition_key,
            product_key, runtime_tier, verification_environment_id
       FROM onetime.canonical_aggregate_states
      WHERE product_key=$3 AND runtime_tier=$4 AND verification_environment_id=$5
        AND ((aggregate_kind = 'human_account' AND aggregate_key = $1)
          OR (aggregate_kind = 'access' AND aggregate_key = $2))`,
    [
      keys.humanAccountId,
      keys.householdId,
      manifest.scope.product_key,
      manifest.scope.runtime_tier,
      manifest.scope.verification_environment_id,
    ],
  );
  const humanState = states.rows.find((row) => row.aggregate_kind === 'human_account');
  const accessState = states.rows.find((row) => row.aggregate_kind === 'access');
  if (
    states.rows.length !== 2 ||
    humanState?.aggregate_key !== keys.humanAccountId ||
    humanState.current_state !== 'active' ||
    Number(humanState.version) !== 1 ||
    humanState.last_transition_key !== keys.humanTransitionKey
  ) {
    blockers.push('canonical_human_state_mismatch');
  }
  if (
    states.rows.length !== 2 ||
    accessState?.aggregate_key !== keys.householdId ||
    accessState?.current_state !== 'free' ||
    Number(accessState?.version) !== 1 ||
    accessState.last_transition_key !== keys.accessTransitionKey
  ) {
    blockers.push('canonical_access_state_mismatch');
  }
  const transitions = await db.query(
    `SELECT transition_key, aggregate_kind, aggregate_key, previous_state, next_state,
            expected_version, resulting_version, product_key, runtime_tier,
            verification_environment_id, canonical_request_hash, actor_kind, actor_key,
            access_cause, created_at
       FROM onetime.canonical_state_transition_events
      WHERE transition_key IN ($1,$2)`,
    [keys.humanTransitionKey, keys.accessTransitionKey],
  );
  if (transitions.rows.length !== 2) blockers.push('canonical_transition_mismatch');
  for (const transition of transitions.rows) {
    if (
      transition.canonical_request_hash !== keys.canonicalRequestHash ||
      transition.actor_kind !== 'system' ||
      transition.actor_key !== CONTROLLER_DUAL_ROLE_PROVISIONING_ACTOR ||
      transition.previous_state !== null ||
      Number(transition.expected_version) !== 0 ||
      Number(transition.resulting_version) !== 1 ||
      transition.product_key !== manifest.scope.product_key ||
      transition.runtime_tier !== manifest.scope.runtime_tier ||
      transition.verification_environment_id !== manifest.scope.verification_environment_id ||
      new Date(String(transition.created_at)).getTime() > now.getTime()
    ) {
      blockers.push('canonical_transition_mismatch');
      break;
    }
    const humanTransitionMatches =
      transition.transition_key === keys.humanTransitionKey &&
      transition.aggregate_kind === 'human_account' &&
      transition.aggregate_key === keys.humanAccountId &&
      transition.next_state === 'active' &&
      transition.access_cause === null;
    const accessTransitionMatches =
      transition.transition_key === keys.accessTransitionKey &&
      transition.aggregate_kind === 'access' &&
      transition.aggregate_key === keys.householdId &&
      transition.next_state === 'free' &&
      transition.access_cause === 'free_period';
    if (!humanTransitionMatches && !accessTransitionMatches) {
      blockers.push('canonical_transition_mismatch');
      break;
    }
  }
  const compatibility = await db.query(
    `SELECT portal.account_key AS portal_account_key,
            portal.product_key AS portal_product_key,
            portal.display_name AS portal_display_name,
            portal.status AS portal_status, portal.version AS portal_version,
            projection.state, projection.source_kind, projection.effective_at,
            projection.expires_at, projection.source_updated_at,
            projection.policy_version, projection.opaque_source_reference,
            projection.source_revision, projection.last_event_key,
            projection.revocation_reason,
            source.source_slot, source.source_kind AS source_kind_state,
            source.state AS source_state, source.effective_at AS source_effective_at,
            source.expires_at AS source_expires_at,
            source.opaque_source_reference AS source_reference_state,
            source.source_revision AS source_revision_state,
            source.source_updated_at AS source_updated_at_state,
            source.source_request_hash AS source_request_hash,
            source.policy_version AS source_policy_version,
            source.revocation_reason AS source_revocation_reason,
            source.last_event_key AS source_last_event_key,
            projection.source_request_hash AS projection_request_hash,
            event.account_key AS event_account_key, event.product_key AS event_product_key,
            event.household_key AS event_household_key,
            event.actor_kind, event.decision, event.idempotency_key,
            event.request_hash AS event_request_hash,
            event.source_kind AS event_source_kind,
            event.source_reference_digest, event.source_revision AS event_source_revision,
            event.source_updated_at AS event_source_updated_at,
            event.previous_state, event.next_state, event.created_at AS event_created_at
       FROM onetime.portal_households AS portal
       JOIN onetime.account_access_projections AS projection
         ON projection.account_key = portal.account_key
        AND projection.product_key = portal.product_key
        AND projection.household_key = portal.household_key
       JOIN onetime.account_access_source_states AS source
         ON source.account_key = projection.account_key
        AND source.product_key = projection.product_key
        AND source.household_key = projection.household_key
        AND source.last_event_key = projection.last_event_key
       JOIN onetime.account_access_events AS event
         ON event.event_key = projection.last_event_key
      WHERE portal.account_key = $1 AND portal.product_key = $2
        AND portal.household_key = $3 AND portal.status = 'active'`,
    [config.accountKey, config.productKey, keys.householdId],
  );
  const compatibilityRow = compatibility.rows[0] as Record<string, unknown> | undefined;
  const expectedCompatibilityReference = controllerDualRoleAccessSourceReference(keys.householdId);
  const accessTransition = transitions.rows.find(
    (transition) => transition.transition_key === keys.accessTransitionKey,
  );
  const accessTransitionCreatedAt = new Date(String(accessTransition?.created_at)).getTime();
  const audit = await db.query(
    `SELECT created_at
       FROM onetime.account_lifecycle_audit_events
      WHERE audit_key=$1 AND account_key=$2 AND product_key=$3
        AND actor_user_key IS NULL AND subject_user_key IS NULL AND token_key IS NULL
        AND action_type='controller_dual_role_adult_provisioned'
        AND success=true AND reason IS NULL AND metadata=$4::jsonb`,
    [
      keys.auditKey,
      config.accountKey,
      config.productKey,
      JSON.stringify(controllerDualRoleProvisionAuditMetadata(keys)),
    ],
  );
  const auditCreatedAt = new Date(String(audit.rows[0]?.created_at)).getTime();
  if (
    audit.rows.length !== 1 ||
    !Number.isFinite(auditCreatedAt) ||
    auditCreatedAt > now.getTime() ||
    auditCreatedAt !== accessTransitionCreatedAt
  ) {
    blockers.push('controller_provision_audit_mismatch');
  }
  const expectedCompatibilityRequestHash = Number.isFinite(accessTransitionCreatedAt)
    ? accountAccessRequestHash({
        accountKey: config.accountKey,
        productKey: config.productKey,
        sourceKind: 'admin_override',
        command: {
          household_key: keys.householdId,
          state: 'active',
          effective_at: new Date(accessTransitionCreatedAt).toISOString(),
          expires_at: new Date(CONTROLLER_DUAL_ROLE_ACCESS_EXPIRES_AT).toISOString(),
          opaque_source_reference: expectedCompatibilityReference,
          source_revision: 1,
          source_updated_at: new Date(accessTransitionCreatedAt).toISOString(),
          policy_version: CONTROLLER_DUAL_ROLE_PROVISIONING_POLICY,
          revocation_reason: null,
        },
      })
    : null;
  const compatibilityEffectiveAt = new Date(String(compatibilityRow?.effective_at)).getTime();
  const compatibilityUpdatedAt = new Date(String(compatibilityRow?.source_updated_at)).getTime();
  const compatibilityExpiresAt = new Date(String(compatibilityRow?.expires_at)).getTime();
  const compatibilityEventCreatedAt = new Date(
    String(compatibilityRow?.event_created_at),
  ).getTime();
  if (
    compatibility.rows.length !== 1 ||
    compatibilityRow?.portal_account_key !== config.accountKey ||
    compatibilityRow.portal_product_key !== config.productKey ||
    compatibilityRow.portal_display_name !== manifest.adult.household_display_name ||
    compatibilityRow.portal_status !== 'active' ||
    Number(compatibilityRow.portal_version) !== 1 ||
    compatibilityRow?.state !== 'active' ||
    compatibilityRow.source_kind !== 'admin_override' ||
    !Number.isFinite(compatibilityEffectiveAt) ||
    compatibilityEffectiveAt > now.getTime() ||
    compatibilityEffectiveAt !== accessTransitionCreatedAt ||
    !Number.isFinite(compatibilityUpdatedAt) ||
    compatibilityUpdatedAt > now.getTime() ||
    compatibilityRow.source_slot !== 'complimentary' ||
    compatibilityRow.source_kind_state !== compatibilityRow.source_kind ||
    compatibilityRow.source_state !== 'active' ||
    new Date(String(compatibilityRow.source_effective_at)).getTime() !== compatibilityEffectiveAt ||
    new Date(String(compatibilityRow.source_expires_at)).getTime() !== compatibilityExpiresAt ||
    new Date(String(compatibilityRow.source_updated_at_state)).getTime() !==
      compatibilityUpdatedAt ||
    compatibilityExpiresAt !== Date.parse(CONTROLLER_DUAL_ROLE_ACCESS_EXPIRES_AT) ||
    compatibilityExpiresAt <= now.getTime() ||
    Number(compatibilityRow.source_revision) !== 1 ||
    Number(compatibilityRow.source_revision_state) !== 1 ||
    compatibilityRow.policy_version !== CONTROLLER_DUAL_ROLE_PROVISIONING_POLICY ||
    compatibilityRow.source_policy_version !== CONTROLLER_DUAL_ROLE_PROVISIONING_POLICY ||
    compatibilityRow.opaque_source_reference !== expectedCompatibilityReference ||
    compatibilityRow.source_reference_state !== expectedCompatibilityReference ||
    compatibilityRow.revocation_reason !== null ||
    compatibilityRow.source_revocation_reason !== null ||
    compatibilityRow.projection_request_hash !== expectedCompatibilityRequestHash ||
    compatibilityRow.source_request_hash !== expectedCompatibilityRequestHash ||
    compatibilityRow.source_last_event_key !== compatibilityRow.last_event_key ||
    compatibilityRow.event_account_key !== config.accountKey ||
    compatibilityRow.event_product_key !== config.productKey ||
    compatibilityRow.event_household_key !== keys.householdId ||
    compatibilityRow.actor_kind !== 'provisioner' ||
    compatibilityRow.decision !== 'applied' ||
    compatibilityRow.event_request_hash !== expectedCompatibilityRequestHash ||
    compatibilityRow.event_source_kind !== 'admin_override' ||
    compatibilityRow.source_reference_digest !== sha256(expectedCompatibilityReference) ||
    Number(compatibilityRow.event_source_revision) !== 1 ||
    new Date(String(compatibilityRow.event_source_updated_at)).getTime() !==
      compatibilityUpdatedAt ||
    compatibilityRow.previous_state !== null ||
    compatibilityRow.next_state !== 'active' ||
    !Number.isFinite(compatibilityEventCreatedAt) ||
    compatibilityEventCreatedAt > now.getTime() ||
    compatibilityRow.idempotency_key !== controllerDualRoleAccessIdempotencyKey(keys.householdId) ||
    !expectedCompatibilityRequestHash
  ) {
    blockers.push('compatibility_access_mismatch');
  }
  return {
    disposition: blockers.length ? 'blocked' : 'exact_replay',
    adult_rows: adults.rows.length,
    active_memberships: activeMemberships,
    family_households: households.rows.length,
    canonical_access_state: accessState ? String(accessState.current_state) : null,
    compatibility_access_state: compatibilityRow ? String(compatibilityRow.state) : null,
    legacy_account_users: legacy,
    local_contacts: contacts,
    canonical_collision_candidates: canonicalCollisionCandidates,
    legacy_collision_candidates: legacyCollisionCandidates,
    local_contact_collision_candidates: localContactCollisionCandidates,
    credentialState: credentialState ?? null,
    blockers: [...new Set(blockers)],
  };
}

async function prohibitedCounts(db: Queryable, manifest: Manifest, keys: TargetKeys) {
  const values = [
    keys.householdId,
    manifest.scope.product_key,
    manifest.scope.runtime_tier,
    manifest.scope.verification_environment_id,
  ];
  return {
    signupRequests: await countQuery(
      db,
      `SELECT count(*)::integer AS count FROM onetime.family_signup_requests
        WHERE household_id=$1 AND product=$2 AND runtime_tier=$3 AND verification_environment_id=$4`,
      values,
    ),
    signupReceipts: await countQuery(
      db,
      `SELECT count(*)::integer AS count FROM onetime.family_signup_receipts
        WHERE household_id=$1 AND product=$2 AND runtime_tier=$3 AND verification_environment_id=$4`,
      values,
    ),
    signupOutbox: await countQuery(
      db,
      `SELECT count(*)::integer AS count FROM onetime.family_signup_outbox
        WHERE household_id=$1 AND product=$2 AND runtime_tier=$3 AND verification_environment_id=$4`,
      values,
    ),
    signupConsents: await countQuery(
      db,
      `SELECT count(*)::integer AS count FROM onetime.family_signup_consents AS consent
        JOIN onetime.family_signup_requests AS request
          ON request.idempotency_key=consent.idempotency_key
         AND request.product=consent.product
         AND request.runtime_tier=consent.runtime_tier
         AND request.verification_environment_id=consent.verification_environment_id
       WHERE request.household_id=$1 AND request.product=$2
         AND request.runtime_tier=$3 AND request.verification_environment_id=$4`,
      values,
    ),
    portalGuardianConsents: await countQuery(
      db,
      `SELECT count(*)::integer AS count FROM onetime.portal_guardian_consents
        WHERE household_key=$1 AND account_key=$2 AND product_key=$3`,
      [keys.householdId, manifest.scope.account_key, manifest.scope.product_key],
    ),
    privacyConsentEvents: await countQuery(
      db,
      `SELECT count(*)::integer AS count FROM onetime.privacy_consent_event
        WHERE actor_adult_id=$1 OR household_id=$2`,
      [keys.adultId, keys.householdId],
    ),
    v21Students: await countQuery(
      db,
      `SELECT count(*)::integer AS count FROM onetime.v21_student_profiles
        WHERE household_id=$1 AND product_key=$2
          AND runtime_tier=$3 AND verification_environment_id=$4`,
      values,
    ),
    portalLearners: await countQuery(
      db,
      `SELECT count(*)::integer AS count FROM onetime.portal_learners
        WHERE household_key=$1 AND account_key=$2 AND product_key=$3`,
      [keys.householdId, manifest.scope.account_key, manifest.scope.product_key],
    ),
    portalStudentAccess: await countQuery(
      db,
      `SELECT count(*)::integer AS count FROM onetime.portal_student_access_state
        WHERE household_key=$1 AND account_key=$2 AND product_key=$3`,
      [keys.householdId, manifest.scope.account_key, manifest.scope.product_key],
    ),
    learnerIdentityLinks: await countQuery(
      db,
      `SELECT count(*)::integer AS count FROM onetime.account_learner_identity_links
        WHERE household_key=$1 AND account_key=$2 AND product_key=$3`,
      [keys.householdId, manifest.scope.account_key, manifest.scope.product_key],
    ),
    adultContactLinks: await countQuery(
      db,
      `SELECT count(*)::integer AS count FROM onetime.adult_household_contact_links
        WHERE household_key=$1 AND account_key=$2 AND product_key=$3`,
      [keys.householdId, manifest.scope.account_key, manifest.scope.product_key],
    ),
    adultGhlLinks: await countQuery(
      db,
      `SELECT count(*)::integer AS count FROM onetime.adult_ghl_identity_link
        WHERE adult_id=$1 AND product_key=$2
          AND runtime_tier=$3 AND verification_environment_id=$4`,
      [
        keys.adultId,
        manifest.scope.product_key,
        manifest.scope.runtime_tier,
        manifest.scope.verification_environment_id,
      ],
    ),
    householdProviderMappings: await countQuery(
      db,
      `SELECT count(*)::integer AS count FROM onetime.household_provider_mapping
        WHERE household_id=$1 AND product_key=$2
          AND runtime_tier=$3 AND verification_environment_id=$4`,
      values,
    ),
    providerOperationBindings: await countQuery(
      db,
      `SELECT count(*)::integer AS count FROM onetime.provider_operation_binding
        WHERE household_id=$1`,
      [keys.householdId],
    ),
    ghlSyncOperations: await countQuery(
      db,
      `SELECT count(*)::integer AS count FROM onetime.ghl_identity_sync_operation
        WHERE adult_id=$1 AND household_id=$2 AND product_key=$3
          AND runtime_tier=$4 AND verification_environment_id=$5`,
      [
        keys.adultId,
        keys.householdId,
        manifest.scope.product_key,
        manifest.scope.runtime_tier,
        manifest.scope.verification_environment_id,
      ],
    ),
    ghlHouseholdProjections: await countQuery(
      db,
      `SELECT count(*)::integer AS count FROM onetime.ghl_household_identity_projection
        WHERE household_id=$1 AND adult_id=$2 AND product_key=$3
          AND runtime_tier=$4 AND verification_environment_id=$5`,
      [
        keys.householdId,
        keys.adultId,
        manifest.scope.product_key,
        manifest.scope.runtime_tier,
        manifest.scope.verification_environment_id,
      ],
    ),
    ghlReviewCases: await countQuery(
      db,
      `SELECT count(*)::integer AS count FROM onetime.ghl_identity_review_case
        WHERE household_id=$1 AND adult_id=$2 AND product_key=$3
          AND runtime_tier=$4 AND verification_environment_id=$5`,
      [
        keys.householdId,
        keys.adultId,
        manifest.scope.product_key,
        manifest.scope.runtime_tier,
        manifest.scope.verification_environment_id,
      ],
    ),
    v21BillingPortalSessions: await countQuery(
      db,
      `SELECT count(*)::integer AS count FROM onetime.v21_billing_portal_sessions
        WHERE household_id=$1 AND product_key=$2
          AND runtime_tier=$3 AND verification_environment_id=$4`,
      values,
    ),
    v21ProviderReassociationIntents: await countQuery(
      db,
      `SELECT count(*)::integer AS count FROM onetime.v21_provider_reassociation_intents
        WHERE household_id=$1 AND product_key=$2
          AND runtime_tier=$3 AND verification_environment_id=$4`,
      values,
    ),
    billingGhlIntents: await countQuery(
      db,
      `SELECT count(*)::integer AS count FROM onetime.billing_ghl_lifecycle_intents
        WHERE household_key=$1 AND account_key=$2 AND product_key=$3`,
      [keys.householdId, manifest.scope.account_key, manifest.scope.product_key],
    ),
    billingAccessAuthorities: await countQuery(
      db,
      `SELECT count(*)::integer AS count FROM onetime.billing_access_episode_authority
        WHERE household_key=$1 AND account_key=$2 AND product_key=$3`,
      [keys.householdId, manifest.scope.account_key, manifest.scope.product_key],
    ),
    billingAccessEvents: await countQuery(
      db,
      `SELECT count(*)::integer AS count FROM onetime.billing_access_episode_events
        WHERE household_key=$1 AND account_key=$2 AND product_key=$3`,
      [keys.householdId, manifest.scope.account_key, manifest.scope.product_key],
    ),
    billingCheckoutAbandonmentIntents: await countQuery(
      db,
      `SELECT count(*)::integer AS count FROM onetime.billing_checkout_abandonment_intents
        WHERE household_key=$1 AND adult_id=$2 AND account_key=$3 AND product_key=$4`,
      [keys.householdId, keys.adultId, manifest.scope.account_key, manifest.scope.product_key],
    ),
    billingPrincipalCustomers: await billingPrincipalCount(
      db,
      'billing_principal_customers',
      manifest,
      keys,
    ),
    billingCheckoutSessions: await billingPrincipalCount(
      db,
      'billing_checkout_sessions',
      manifest,
      keys,
    ),
    billingSubscriptions: await billingPrincipalCount(
      db,
      'billing_subscription_projections',
      manifest,
      keys,
    ),
    billingInvoices: await billingPrincipalCount(db, 'billing_invoice_summaries', manifest, keys),
    billingReconciliationJobs: await billingPrincipalCount(
      db,
      'billing_reconciliation_jobs',
      manifest,
      keys,
    ),
    billingEntitlements: await billingPrincipalCount(
      db,
      'billing_entitlement_projections',
      manifest,
      keys,
    ),
    billingAuditEvents: await billingPrincipalCount(db, 'billing_audit_events', manifest, keys),
  };
}

async function billingPrincipalCount(
  db: Queryable,
  table:
    | 'billing_principal_customers'
    | 'billing_checkout_sessions'
    | 'billing_subscription_projections'
    | 'billing_invoice_summaries'
    | 'billing_reconciliation_jobs'
    | 'billing_entitlement_projections'
    | 'billing_audit_events',
  manifest: Manifest,
  keys: TargetKeys,
) {
  return countQuery(
    db,
    `SELECT count(*)::integer AS count FROM onetime.${table}
      WHERE account_key=$1 AND product_key=$2
        AND principal_key IN ($3,$4,$5)`,
    [
      manifest.scope.account_key,
      manifest.scope.product_key,
      keys.adultId,
      keys.humanAccountId,
      keys.householdId,
    ],
  );
}

async function applyIdentity(
  pool: DbPool,
  config: AppConfig,
  manifest: Manifest,
  keys: TargetKeys,
  now: Date,
  testOnlyFailStage?: ControllerDualRoleApplyStage,
) {
  let stage: ControllerDualRoleApplyStage = 'transaction_begin';
  const atStage = async <T>(nextStage: ControllerDualRoleApplyStage, run: () => Promise<T>) => {
    stage = nextStage;
    if (testOnlyFailStage === nextStage) {
      throw new Error('TEST_ONLY_RAW_FAILURE INSERT INTO hidden@example.test database-id');
    }
    return run();
  };

  try {
    await atStage('transaction_begin', async () => undefined);
    return await inTransaction(pool, async (db) => {
      await atStage('advisory_lock', async () => {
        await db.query('SELECT pg_advisory_xact_lock(hashtext($1))', [
          `dual-role-adult-provision:${manifest.adult.email}`,
        ]);
      });
      const locked = await atStage('locked_preflight', () =>
        inspectIdentity(db, config, manifest, keys, now),
      );
      if (locked.disposition === 'exact_replay') {
        await atStage('transaction_commit', async () => undefined);
        return false;
      }
      if (locked.disposition !== 'absent') throw new Error('Target identity preflight changed.');
      const scope = [
        manifest.scope.product_key,
        manifest.scope.runtime_tier,
        manifest.scope.verification_environment_id,
      ] as const;
      const occurredAt = now.toISOString();
      await atStage('adult_identity_insert', () =>
        exactlyOne(
          db,
          `INSERT INTO onetime.v21_adult_identities
             (adult_id, normalized_email, display_name, state, version, product_key,
              runtime_tier, verification_environment_id, created_at, updated_at)
           VALUES ($1,$2,$3,'active',1,$4,$5,$6,$7,$7)`,
          [keys.adultId, manifest.adult.email, manifest.adult.display_name, ...scope, occurredAt],
          'adult identity',
        ),
      );
      await atStage('human_account_insert', () =>
        exactlyOne(
          db,
          `INSERT INTO onetime.v21_human_accounts
             (human_account_id, adult_id, state, security_version, version, product_key,
              runtime_tier, verification_environment_id, created_at, updated_at)
           VALUES ($1,$2,'active',1,1,$3,$4,$5,$6,$6)`,
          [keys.humanAccountId, keys.adultId, ...scope, occurredAt],
          'HumanAccount',
        ),
      );
      await atStage('role_memberships_insert', () =>
        exactlyOne(
          db,
          `INSERT INTO onetime.v21_human_account_role_memberships
             (human_account_id, role, granted_at, granted_reason, product_key,
              runtime_tier, verification_environment_id)
           VALUES ($1,'admin',$2,$3,$4,$5,$6),($1,'parent',$2,$3,$4,$5,$6)`,
          [keys.humanAccountId, occurredAt, CONTROLLER_DUAL_ROLE_PROVISIONING_ACTOR, ...scope],
          'dual-role memberships',
          2,
        ),
      );
      await atStage('family_household_insert', () =>
        exactlyOne(
          db,
          `INSERT INTO onetime.v21_households
             (household_id, owner_adult_id, owner_human_account_id, classification,
              state, seat_limit, active_seat_count, access_aggregate_ref, version,
              product_key, runtime_tier, verification_environment_id, created_at, updated_at)
           VALUES ($1,$2,$3,'family','active',3,0,$4,1,$5,$6,$7,$8,$8)`,
          [
            keys.householdId,
            keys.adultId,
            keys.humanAccountId,
            `access:${keys.householdId}`,
            ...scope,
            occurredAt,
          ],
          'Family household',
        ),
      );
      const passwordHash = await atStage('credential_hash', async () =>
        hashAuthPassword(randomBytes(48).toString('base64url')),
      );
      await atStage('adult_credential_insert', () =>
        exactlyOne(
          db,
          `INSERT INTO onetime.v21_adult_credentials
             (human_account_id, adult_id, credential_kind, password_hash,
              credential_state, credential_version, product_key, runtime_tier,
              verification_environment_id, created_at, updated_at)
           VALUES ($1,$2,'adult_email_password',$3,'reset_required',1,$4,$5,$6,$7,$7)`,
          [keys.humanAccountId, keys.adultId, passwordHash, ...scope, occurredAt],
          'adult credential',
        ),
      );
      await atStage('human_transition_insert', () =>
        insertCanonicalCreation(db, {
          transitionKey: keys.humanTransitionKey,
          aggregateKind: 'human_account',
          aggregateKey: keys.humanAccountId,
          nextState: 'active',
          accessCause: null,
          manifest,
          requestHash: keys.canonicalRequestHash,
          occurredAt,
        }),
      );
      await atStage('access_transition_insert', () =>
        insertCanonicalCreation(db, {
          transitionKey: keys.accessTransitionKey,
          aggregateKind: 'access',
          aggregateKey: keys.householdId,
          nextState: 'free',
          accessCause: 'free_period',
          manifest,
          requestHash: keys.canonicalRequestHash,
          occurredAt,
        }),
      );
      await atStage('portal_household_insert', () =>
        exactlyOne(
          db,
          `INSERT INTO onetime.portal_households
             (household_key, account_key, product_key, display_name, status, version,
              created_at, updated_at)
           VALUES ($1,$2,$3,$4,'active',1,$5,$5)`,
          [
            keys.householdId,
            config.accountKey,
            config.productKey,
            manifest.adult.household_display_name,
            occurredAt,
          ],
          'portal Family household',
        ),
      );
      await atStage('access_projection_apply', async () => {
        await applyHouseholdAccessStateWithClient({
          db,
          accountKey: config.accountKey,
          productKey: config.productKey,
          sourceKind: 'admin_override',
          actorKind: 'provisioner',
          idempotencyKey: keys.accessIdempotencyKey,
          now,
          command: {
            household_key: keys.householdId,
            state: 'active',
            effective_at: occurredAt,
            expires_at: new Date(CONTROLLER_DUAL_ROLE_ACCESS_EXPIRES_AT).toISOString(),
            opaque_source_reference: keys.accessSourceReference,
            source_revision: 1,
            source_updated_at: occurredAt,
            policy_version: CONTROLLER_DUAL_ROLE_PROVISIONING_POLICY,
            revocation_reason: null,
          },
        });
      });
      await atStage('provision_audit_insert', () =>
        exactlyOne(
          db,
          `INSERT INTO onetime.account_lifecycle_audit_events
             (audit_key, account_key, product_key, action_type, success, metadata, created_at)
           VALUES ($1,$2,$3,'controller_dual_role_adult_provisioned',true,$4::jsonb,$5)`,
          [
            keys.auditKey,
            config.accountKey,
            config.productKey,
            JSON.stringify(controllerDualRoleProvisionAuditMetadata(keys)),
            occurredAt,
          ],
          'controller provisioning audit',
        ),
      );
      const readback = await atStage('transactional_readback', () =>
        inspectIdentity(db, config, manifest, keys, now),
      );
      if (readback.disposition !== 'exact_replay') {
        throw new Error('Provisioned identity failed transactional readback.');
      }
      await atStage('transaction_commit', async () => undefined);
      return true;
    });
  } catch {
    throw new ControllerDualRoleApplyStageError(stage);
  }
}

async function insertCanonicalCreation(
  db: Queryable,
  input: {
    transitionKey: string;
    aggregateKind: 'human_account' | 'access';
    aggregateKey: string;
    nextState: 'active' | 'free';
    accessCause: 'free_period' | null;
    manifest: Manifest;
    requestHash: string;
    occurredAt: string;
  },
) {
  await exactlyOne(
    db,
    `INSERT INTO onetime.canonical_state_transition_events
       (transition_key, aggregate_kind, aggregate_key, previous_state, next_state,
        expected_version, resulting_version, product_key, runtime_tier,
        verification_environment_id, actor_kind, actor_key, idempotency_key,
        canonical_request_hash, access_cause, created_at)
     VALUES ($1,$2,$3,NULL,$4,0,1,$5,$6,$7,'system',$8,$9,$10,$11,$12)`,
    [
      input.transitionKey,
      input.aggregateKind,
      input.aggregateKey,
      input.nextState,
      input.manifest.scope.product_key,
      input.manifest.scope.runtime_tier,
      input.manifest.scope.verification_environment_id,
      CONTROLLER_DUAL_ROLE_PROVISIONING_ACTOR,
      `${CONTROLLER_DUAL_ROLE_PROVISIONING_ACTOR}:${input.aggregateKind}`,
      input.requestHash,
      input.accessCause,
      input.occurredAt,
    ],
    `${input.aggregateKind} canonical transition`,
  );
}

async function reconcileFailedIdentityApply(
  pool: DbPool,
  config: AppConfig,
  manifest: Manifest,
  keys: TargetKeys,
  now: Date,
  failureBlocker: string,
  initial: IdentityInspection,
  initialSetup: SetupInspection,
): Promise<DualRoleAdultProvisionReport> {
  try {
    const identity = await inspectIdentity(pool, config, manifest, keys, now);
    const setupState = await inspectSetup(pool, config, manifest, keys, now);
    const setupStillAbsent =
      setupState.token_rows === 0 &&
      setupState.intent_rows === 0 &&
      setupState.outbox_rows === 0 &&
      setupState.blockers.length === 0;
    if (identity.disposition === 'absent' && !identity.blockers.length && setupStillAbsent) {
      return report(now, true, 'blocked', [failureBlocker], identity, setupState);
    }
    if (identity.disposition === 'exact_replay' && !identity.blockers.length) {
      return report(
        now,
        true,
        'identity_applied_setup_pending',
        [failureBlocker, ...setupState.blockers],
        identity,
        setupState,
      );
    }
    return report(
      now,
      true,
      'blocked',
      [
        failureBlocker,
        'apply_identity_post_failure_state_not_absent',
        ...identity.blockers,
        ...setupState.blockers,
      ],
      identity,
      setupState,
    );
  } catch {
    return report(
      now,
      true,
      'blocked',
      [failureBlocker, 'apply_identity_reconciliation_unavailable'],
      initial,
      initialSetup,
    );
  }
}

async function inspectSetup(
  db: Queryable,
  config: AppConfig,
  manifest: Manifest,
  keys: TargetKeys,
  now: Date,
): Promise<SetupInspection> {
  const competingActiveTokens = await countQuery(
    db,
    `SELECT count(*)::integer AS count
       FROM onetime.account_lifecycle_tokens
      WHERE account_key=$1 AND product_key=$2 AND token_type='password_reset'
        AND token_key<>$3
        AND (subject_human_account_id=$4 OR email_normalized=$5)
        AND consumed_at IS NULL AND revoked_at IS NULL
        AND expires_at>$6::timestamptz`,
    [
      config.accountKey,
      config.productKey,
      keys.setupTokenKey,
      keys.humanAccountId,
      manifest.adult.email,
      now,
    ],
  );
  const competingDeliveryEffects = await countQuery(
    db,
    `SELECT count(*)::integer AS count
       FROM onetime.account_lifecycle_delivery_outbox
      WHERE account_key=$1 AND product_key=$2 AND purpose='password_reset'
        AND delivery_key<>$3 AND destination_ref=$4
        AND state NOT IN ('superseded','expired','cleared')`,
    [config.accountKey, config.productKey, keys.setupDeliveryKey, keys.setupDestinationRef],
  );
  const competingBlockers =
    competingActiveTokens || competingDeliveryEffects ? ['competing_setup_reset_present'] : [];
  const result = await db.query(
    `SELECT token.token_key, token.token_type, token.target_role,
            token.subject_human_account_id, token.email_normalized,
            token.display_name, token.subject_user_key, token.household_key,
            token.relationship_key, token.learner_key, token.created_by_user_key,
            token.created_at AS token_created_at, token.expires_at, token.consumed_at,
            token.revoked_at, intent.intent_key, intent.intent_type, intent.channel AS intent_channel,
            intent.recipient_email, intent.delivery_state AS intent_state,
            intent.idempotency_key AS intent_idempotency_key,
            intent.request_hash AS intent_request_hash,
            intent.created_at AS intent_created_at,
            outbox.delivery_key, outbox.intent_key AS outbox_intent_key,
            outbox.purpose AS outbox_purpose, outbox.channel AS outbox_channel,
            outbox.transport_mode, outbox.destination_ref,
            outbox.idempotency_key AS outbox_idempotency_key,
            outbox.encrypted_payload_expires_at, outbox.state AS outbox_state,
            outbox.created_at AS outbox_created_at
       FROM onetime.account_lifecycle_tokens AS token
       LEFT JOIN onetime.account_lifecycle_delivery_intents AS intent
         ON intent.account_key = token.account_key
        AND intent.product_key = token.product_key
        AND intent.token_key = token.token_key
       LEFT JOIN onetime.account_lifecycle_delivery_outbox AS outbox
         ON outbox.account_key = token.account_key
        AND outbox.product_key = token.product_key
        AND outbox.token_key = token.token_key
      WHERE token.account_key = $1 AND token.product_key = $2 AND token.token_key = $3`,
    [config.accountKey, config.productKey, keys.setupTokenKey],
  );
  if (!result.rows.length) {
    return setup(competingBlockers.length ? 'blocked' : 'planned', 0, 0, 0, competingBlockers);
  }
  const blockers: string[] = [...competingBlockers];
  if (result.rows.length !== 1) blockers.push('setup_delivery_ambiguous');
  const row = result.rows[0] as Record<string, unknown>;
  const tokenCreatedAt = new Date(String(row.token_created_at)).getTime();
  const tokenExpiresAt = new Date(String(row.expires_at)).getTime();
  const intentCreatedAt = new Date(String(row.intent_created_at)).getTime();
  const outboxCreatedAt = new Date(String(row.outbox_created_at)).getTime();
  const encryptedPayloadExpiresAt = new Date(String(row.encrypted_payload_expires_at)).getTime();
  if (
    row.token_type !== 'password_reset' ||
    row.target_role !== 'parent' ||
    row.subject_human_account_id !== keys.humanAccountId ||
    row.email_normalized !== manifest.adult.email ||
    row.display_name !== manifest.adult.display_name ||
    row.subject_user_key !== null ||
    row.household_key !== null ||
    row.relationship_key !== null ||
    row.learner_key !== null ||
    row.created_by_user_key !== null ||
    !Number.isFinite(tokenCreatedAt) ||
    tokenCreatedAt > now.getTime() ||
    tokenExpiresAt - tokenCreatedAt !== SETUP_TOKEN_TTL_MINUTES * 60_000 ||
    row.intent_key !== keys.setupIntentKey ||
    row.intent_type !== 'password_reset' ||
    row.intent_channel !== 'email' ||
    row.recipient_email !== manifest.adult.email ||
    !['sink_queued', 'sink_delivered'].includes(String(row.intent_state)) ||
    row.intent_idempotency_key !== keys.setupIdempotencyKey ||
    row.intent_request_hash !== keys.setupRequestHash ||
    intentCreatedAt !== tokenCreatedAt ||
    intentCreatedAt > now.getTime() ||
    row.delivery_key !== keys.setupDeliveryKey ||
    row.outbox_intent_key !== keys.setupIntentKey ||
    row.outbox_purpose !== 'password_reset' ||
    row.outbox_channel !== 'email' ||
    row.transport_mode !== 'sink' ||
    row.destination_ref !== keys.setupDestinationRef ||
    row.outbox_idempotency_key !== keys.setupIdempotencyKey ||
    encryptedPayloadExpiresAt !== tokenExpiresAt ||
    outboxCreatedAt !== tokenCreatedAt ||
    outboxCreatedAt > now.getTime()
  ) {
    blockers.push('setup_delivery_mismatch');
  }
  const outboxState = String(row.outbox_state ?? '');
  const pendingStates = new Set(['queued', 'leased', 'retry']);
  const achievedStates = new Set(['provider_accepted', 'provider_delivered', 'delivered']);
  const isolatedSinkDelivered =
    outboxState === 'sink_delivered' && manifest.scope.runtime_tier === 'isolated_staging';
  if (
    !pendingStates.has(outboxState) &&
    !achievedStates.has(outboxState) &&
    !isolatedSinkDelivered
  ) {
    blockers.push(
      outboxState === 'unknown'
        ? 'setup_delivery_provider_effect_unknown'
        : 'setup_delivery_terminal_or_unavailable',
    );
  }
  const disposition: SetupDisposition = row.consumed_at
    ? 'completed'
    : row.revoked_at || tokenExpiresAt <= now.getTime()
      ? 'blocked'
      : outboxState === 'provider_accepted'
        ? 'provider_accepted'
        : outboxState === 'provider_delivered' || outboxState === 'delivered'
          ? 'delivered'
          : isolatedSinkDelivered
            ? 'sink_delivered'
            : 'queued';
  if (disposition === 'blocked') blockers.push('setup_delivery_expired_or_revoked');
  return setup(
    blockers.length ? 'blocked' : disposition,
    result.rows.length,
    row.intent_key ? 1 : 0,
    row.delivery_key ? 1 : 0,
    blockers,
  );
}

function setup(
  disposition: SetupDisposition,
  tokenRows: number,
  intentRows: number,
  outboxRows: number,
  blockers: string[],
): SetupInspection {
  return {
    purpose: 'password_reset',
    ttl_minutes: SETUP_TOKEN_TTL_MINUTES,
    disposition,
    token_rows: tokenRows,
    intent_rows: intentRows,
    outbox_rows: outboxRows,
    external_send_performed_inline: false,
    blockers,
  };
}

function report(
  now: Date,
  apply: boolean,
  status: DualRoleAdultProvisionReport['status'],
  blockers: string[],
  identity: IdentityInspection,
  setupInspection: SetupInspection,
): DualRoleAdultProvisionReport {
  const safeIdentity: DualRoleAdultProvisionReport['identity'] = {
    disposition: identity.disposition,
    adult_rows: identity.adult_rows,
    active_memberships: identity.active_memberships,
    family_households: identity.family_households,
    canonical_access_state: identity.canonical_access_state,
    compatibility_access_state: identity.compatibility_access_state,
    legacy_account_users: identity.legacy_account_users,
    local_contacts: identity.local_contacts,
    canonical_collision_candidates: identity.canonical_collision_candidates,
    legacy_collision_candidates: identity.legacy_collision_candidates,
    local_contact_collision_candidates: identity.local_contact_collision_candidates,
  };
  const safeSetup: DualRoleAdultProvisionReport['setup_delivery'] = {
    purpose: setupInspection.purpose,
    ttl_minutes: setupInspection.ttl_minutes,
    disposition: setupInspection.disposition,
    token_rows: setupInspection.token_rows,
    intent_rows: setupInspection.intent_rows,
    outbox_rows: setupInspection.outbox_rows,
    external_send_performed_inline: setupInspection.external_send_performed_inline,
  };
  return {
    schema: SCHEMA,
    generated_at: now.toISOString(),
    apply,
    status,
    blockers: [...new Set(blockers)].sort(),
    identity: safeIdentity,
    setup_delivery: safeSetup,
    safety: {
      dry_run_default: true,
      strict_private_manifest: true,
      exact_source_and_runtime_required: true,
      ephemeral_authorization_required_for_apply: true,
      read_only_apply_prerequisite_check: true,
      sanitized_stage_failure_reporting: true,
      advisory_transaction_lock: true,
      one_adult_credential: true,
      no_legacy_adult: true,
      no_contact_or_ghl_effect: true,
      no_student_effect: true,
      no_billing_or_payment_claim: true,
      no_terms_privacy_or_marketing_claim: true,
      unrelated_event_registrations_ignored: true,
      compatibility_access_expires_at: CONTROLLER_DUAL_ROLE_ACCESS_EXPIRES_AT,
      durable_access_source_required_before_expiry: true,
      raw_email_name_token_hash_url_or_database_ids_printed: false,
    },
  };
}

async function exactlyOne(
  db: Queryable,
  text: string,
  values: unknown[],
  label: string,
  expectedRows = 1,
) {
  const result = await db.query(text, values);
  if (result.rowCount !== expectedRows) throw new Error(`The ${label} write was not exact.`);
}

async function countQuery(db: Queryable, text: string, values: unknown[]) {
  const result = await db.query(text, values);
  return Number(result.rows[0]?.count ?? 0);
}

function sha256(value: string) {
  return createHash('sha256').update(value, 'utf8').digest('hex');
}

function sha256Equals(value: string, expected: string) {
  const actualBuffer = Buffer.from(sha256(value), 'hex');
  const expectedBuffer = Buffer.from(expected, 'hex');
  return (
    actualBuffer.length === expectedBuffer.length && timingSafeEqual(actualBuffer, expectedBuffer)
  );
}

function normalizedAddress(value?: string) {
  const normalized = value?.trim().toLowerCase() ?? '';
  return normalized.match(/<([^<>]+)>/)?.[1]?.trim() ?? normalized;
}

function parseArgs(argv: string[]) {
  const result: Record<string, string | boolean> = {};
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--apply') {
      result.apply = true;
      continue;
    }
    if (arg === '--manifest' || arg === '--out') {
      const value = argv[index + 1];
      if (!value) throw new Error(`Missing value for ${arg}.`);
      result[arg.slice(2)] = value;
      index += 1;
      continue;
    }
    throw new Error('Unsupported controller argument.');
  }
  return result;
}

function isCliEntrypoint() {
  return process.argv[1] ? import.meta.url === pathToFileURL(process.argv[1]).href : false;
}

function requestedOutputPath(argv: string[]) {
  const index = argv.lastIndexOf('--out');
  const candidate = index >= 0 ? argv[index + 1] : undefined;
  return candidate && !candidate.startsWith('--') ? candidate : undefined;
}

export async function runDualRoleAdultProvisionCli(
  argv: string[],
  emit: (output: string) => void = (output) => process.stdout.write(output),
) {
  let outputPath = requestedOutputPath(argv);
  try {
    const args = parseArgs(argv);
    outputPath = typeof args.out === 'string' ? args.out : outputPath;
    const result = await runDualRoleAdultProvision({
      ...(typeof args.manifest === 'string' ? { manifestPath: args.manifest } : {}),
      apply: args.apply === true,
      ...(process.env[AUTHORIZATION_ENV]
        ? { authorizationPhrase: process.env[AUTHORIZATION_ENV] }
        : {}),
    });
    const output = `${JSON.stringify(result, null, 2)}\n`;
    if (outputPath) await writeFile(outputPath, output, 'utf8');
    emit(output);
    if (result.status === 'blocked' || result.status === 'identity_applied_setup_pending') {
      return 2;
    }
    return 0;
  } catch {
    const output = `${JSON.stringify({
      schema: SCHEMA,
      status: 'blocked',
      blockers: ['controller_preflight_failed'],
    })}\n`;
    if (outputPath) {
      try {
        await writeFile(outputPath, output, 'utf8');
      } catch {
        // The result remains available on stdout without exposing the path or write failure.
      }
    }
    emit(output);
    return 2;
  }
}

if (isCliEntrypoint()) {
  process.exitCode = await runDualRoleAdultProvisionCli(process.argv.slice(2));
}
