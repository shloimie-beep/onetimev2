import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import { loadConfig, type AppConfig } from '../../../packages/config/src/index.ts';
import {
  createPgPool,
  inTransaction,
  type DbPool,
  type Queryable,
} from '../../../packages/db/src/index.ts';
import {
  AccountLifecycleError,
  createOwnerAdminInvitation,
  createParentActivation,
  createStudentSetup,
} from '../../../packages/domain/src/accounts/lifecycle.ts';
import { hashPassword } from '../../../packages/domain/src/auth/service.ts';
import { normalizeEmail, stableKey } from '../../../packages/domain/src/lead/normalize.ts';

export type IdentityProvisioningEnvironment = 'local' | 'test' | 'staging' | 'production';
export type ProvisioningOutcomeStatus =
  'created' | 'already_exists' | 'update_blocked' | 'conflict';

type StaffIdentity = {
  role: 'owner' | 'admin';
  email: string;
  display_name: string;
  idempotency_key: string;
};

type ParentIdentity = {
  email: string;
  display_name: string;
  relationship_key: string;
  relationship_label: string;
  authority: 'primary_guardian' | 'guardian';
  idempotency_key: string;
};

type LearnerIdentity = {
  learner_key: string;
  access_state_key: string;
  email: string;
  display_name: string;
  grade_label: string;
  idempotency_key: string;
};

export type OneTimeIdentitySetManifest = {
  identity_set_key: string;
  display_label: string;
  household: {
    household_key: string;
    display_name: string;
  };
  owner: StaffIdentity;
  admin: StaffIdentity;
  parent: ParentIdentity;
  learners: LearnerIdentity[];
};

type RedactedRef = {
  kind: string;
  sha256: string;
};

export type ProvisioningOutcome = {
  resource: string;
  status: ProvisioningOutcomeStatus;
  ref: RedactedRef;
  count: number;
  reason_code: string | null;
  actor_role: 'system' | 'owner' | 'admin' | 'parent' | null;
  delivery_state?: 'sink_queued' | 'sink_delivered' | 'suppressed' | 'revoked';
  external_send_performed?: false;
  secret_material_included: false;
};

export type IdentityProvisioningReport = {
  schema_version: 'onetime.w12_100.identity_provisioning.v1';
  generated_at: string;
  environment: Exclude<IdentityProvisioningEnvironment, 'production'>;
  scope: {
    account: RedactedRef;
    product: RedactedRef;
    identity_set: RedactedRef;
  };
  outcomes: ProvisioningOutcome[];
  counts: Record<ProvisioningOutcomeStatus, number> & {
    total_outcomes: number;
    audit_entries_recorded: number;
    external_actions: 0;
    production_mutations: 0;
  };
  safety: {
    production_rejected: true;
    explicit_account_product_scope: true;
    isolated_environment_confirmed: true;
    delivery_transport: 'sink_only';
    external_actions: 0;
    production_mutations: 0;
    secret_material_printed: false;
    default_credentials_used_for_target_identities: false;
    admin_parent_student_impersonation: false;
  };
};

export type IdentityProvisioningSafety = {
  apply: boolean;
  provisioningEnabled: boolean;
  confirmIsolatedEnvironment: boolean;
};

export type IdentityProvisioningInput = {
  pool: DbPool;
  config: AppConfig;
  environment: IdentityProvisioningEnvironment;
  requestedAccountKey: string;
  requestedProductKey: string;
  manifest?: OneTimeIdentitySetManifest;
  safety: IdentityProvisioningSafety;
  now?: Date;
};

export class IdentityProvisioningSafetyError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.code = code;
  }
}

type BootstrapActor = {
  userKey: string;
  status: ProvisioningOutcomeStatus;
};

type ActiveParentActor = {
  userKey: string;
};

type ExistingRow = Record<string, unknown>;

export function buildDefaultSyntheticIdentitySet(
  identitySetKey: string,
): OneTimeIdentitySetManifest {
  const key = normalizedKey(identitySetKey);
  const emailPrefix = key.replaceAll('_', '.').replaceAll(':', '.').replaceAll('-', '.');
  const idempotencyKey = (scope: string) => `w12-100-${sha256Hex(`${key}:${scope}`).slice(0, 32)}`;

  return {
    identity_set_key: key,
    display_label: 'W12-100 first identity readiness set',
    household: {
      household_key: `${key}_household`,
      display_name: 'W12-100 Synthetic Household',
    },
    owner: {
      role: 'owner',
      email: `${emailPrefix}.owner@example.test`,
      display_name: 'W12-100 Synthetic Owner',
      idempotency_key: idempotencyKey('owner'),
    },
    admin: {
      role: 'admin',
      email: `${emailPrefix}.admin@example.test`,
      display_name: 'W12-100 Synthetic Admin',
      idempotency_key: idempotencyKey('admin'),
    },
    parent: {
      email: `${emailPrefix}.parent@example.test`,
      display_name: 'W12-100 Synthetic Guardian',
      relationship_key: `${key}_guardian`,
      relationship_label: 'Guardian',
      authority: 'primary_guardian',
      idempotency_key: idempotencyKey('parent'),
    },
    learners: [1, 2, 3].map((ordinal) => ({
      learner_key: `${key}_learner_${String(ordinal).padStart(3, '0')}`,
      access_state_key: `${key}_access_${String(ordinal).padStart(3, '0')}`,
      email: `${emailPrefix}.student.${ordinal}@example.test`,
      display_name: `W12-100 Synthetic Student ${ordinal}`,
      grade_label: String(7 - ordinal),
      idempotency_key: idempotencyKey(`student-${ordinal}`),
    })),
  };
}

export function validateIdentityProvisioningSafety(input: {
  config: AppConfig;
  environment: IdentityProvisioningEnvironment;
  requestedAccountKey: string | undefined;
  requestedProductKey: string | undefined;
  safety: IdentityProvisioningSafety;
}) {
  if (!input.safety.apply) {
    throw new IdentityProvisioningSafetyError(
      'apply_flag_required',
      'Identity provisioning requires an explicit apply flag.',
    );
  }
  if (!input.safety.provisioningEnabled) {
    throw new IdentityProvisioningSafetyError(
      'provisioning_gate_required',
      'Set ONE_TIME_IDENTITY_PROVISIONING_ENABLED=true before running identity provisioning.',
    );
  }
  if (!input.safety.confirmIsolatedEnvironment) {
    throw new IdentityProvisioningSafetyError(
      'isolated_environment_confirmation_required',
      'Identity provisioning requires an explicit isolated-environment confirmation.',
    );
  }
  if (!input.requestedAccountKey || !input.requestedProductKey) {
    throw new IdentityProvisioningSafetyError(
      'explicit_scope_required',
      'Identity provisioning requires explicit account and product scope.',
    );
  }
  if (
    input.requestedAccountKey !== input.config.accountKey ||
    input.requestedProductKey !== input.config.productKey
  ) {
    throw new IdentityProvisioningSafetyError(
      'scope_mismatch',
      'Requested account/product scope does not match loaded runtime configuration.',
    );
  }
  if (input.environment === 'production' || input.config.isProduction) {
    throw new IdentityProvisioningSafetyError(
      'production_rejected',
      'Identity provisioning refuses production configuration.',
    );
  }
  if (!['local', 'test', 'staging'].includes(input.environment)) {
    throw new IdentityProvisioningSafetyError(
      'environment_not_allowed',
      'Identity provisioning only allows local, test, or isolated staging.',
    );
  }
  if (input.config.outboxTransportMode !== 'sink') {
    throw new IdentityProvisioningSafetyError(
      'sink_delivery_required',
      'Identity provisioning requires sink delivery mode.',
    );
  }
  if (input.config.deliveryProviderTransportEnabled || input.config.resendTransportEnabled) {
    throw new IdentityProvisioningSafetyError(
      'provider_delivery_rejected',
      'Identity provisioning does not send activation delivery.',
    );
  }
  if (looksProductionLike(input.config.databaseUrl)) {
    throw new IdentityProvisioningSafetyError(
      'production_database_rejected',
      'Identity provisioning refuses production-like database targets.',
    );
  }
}

export async function provisionOneTimeIdentitySet(
  input: IdentityProvisioningInput,
): Promise<IdentityProvisioningReport> {
  validateIdentityProvisioningSafety(input);
  const now = input.now ?? new Date();
  const manifest = input.manifest ?? buildDefaultSyntheticIdentitySet('w12_100_first_identity_set');
  const outcomes: ProvisioningOutcome[] = [];

  const bootstrap = await ensureBootstrapOwnerActor(input.pool, input.config, manifest, now);
  outcomes.push(
    outcome('bootstrap_operator', bootstrap.status, 'bootstrap_operator', bootstrap.userKey, {
      actorRole: 'system',
      reasonCode: bootstrap.status === 'created' ? null : 'bootstrap_actor_reused',
    }),
  );

  outcomes.push(
    await issueStaffInvite(input.pool, input.config, manifest.owner, bootstrap.userKey, now),
  );
  outcomes.push(
    await issueStaffInvite(input.pool, input.config, manifest.admin, bootstrap.userKey, now),
  );
  outcomes.push(await ensureHousehold(input.pool, input.config, manifest));
  outcomes.push(
    await issueParentActivation(input.pool, input.config, manifest, bootstrap.userKey, now),
  );

  for (const learner of manifest.learners) {
    outcomes.push(await ensureLearner(input.pool, input.config, manifest, learner, now));
    outcomes.push(await ensureAccessState(input.pool, input.config, manifest, learner, now));
  }

  const activeParent = await findActiveParentActor(input.pool, input.config, manifest);
  for (const learner of manifest.learners) {
    if (!activeParent) {
      outcomes.push(
        outcome('student_setup', 'update_blocked', 'learner', learner.learner_key, {
          actorRole: null,
          reasonCode: 'parent_activation_required',
        }),
      );
      continue;
    }
    outcomes.push(
      await issueStudentSetup(input.pool, input.config, manifest, learner, activeParent, now),
    );
  }

  const report = reportFromOutcomes(input, manifest, outcomes, now);
  await recordProvisioningAudit(input.pool, input.config, bootstrap.userKey, report);
  return {
    ...report,
    counts: { ...report.counts, audit_entries_recorded: 1 },
  };
}

export function serializeIdentityProvisioningReport(report: IdentityProvisioningReport) {
  const serialized = JSON.stringify(report, null, 2);
  assertReportIsRedacted(serialized);
  return `${serialized}\n`;
}

async function ensureBootstrapOwnerActor(
  pool: DbPool,
  config: AppConfig,
  manifest: OneTimeIdentitySetManifest,
  now: Date,
): Promise<BootstrapActor> {
  const email = `w12-100-bootstrap-${sha256Hex(manifest.identity_set_key).slice(0, 18)}@example.test`;
  const emailNormalized = normalizeEmail(email);
  const userKey = stableKey('user', [config.accountKey, config.productKey, emailNormalized]);
  const existing = await queryOne(pool, {
    text: `SELECT user_key, email_normalized, role, status
             FROM onetime.account_users
            WHERE account_key = $1
              AND product_key = $2
              AND user_key = $3
            LIMIT 1`,
    values: [config.accountKey, config.productKey, userKey],
  });

  if (existing) {
    if (
      existing.email_normalized === emailNormalized &&
      existing.role === 'owner' &&
      existing.status === 'active'
    ) {
      return { userKey, status: 'already_exists' };
    }
    return { userKey, status: 'conflict' };
  }

  await pool.query(
    `INSERT INTO onetime.account_users
       (user_key, account_key, product_key, email_normalized, display_name, role, password_hash,
        mfa_capable, status, created_at, updated_at)
     VALUES ($1,$2,$3,$4,'W12-100 Bootstrap Operator','owner',$5,true,'active',$6,$6)`,
    [
      userKey,
      config.accountKey,
      config.productKey,
      emailNormalized,
      hashPassword(randomBytes(48).toString('base64url')),
      now,
    ],
  );
  return { userKey, status: 'created' };
}

async function issueStaffInvite(
  pool: DbPool,
  config: AppConfig,
  staff: StaffIdentity,
  actorUserKey: string,
  now: Date,
): Promise<ProvisioningOutcome> {
  const existed = await lifecycleIntentExists(pool, config, {
    intentType: 'owner_admin_invitation',
    idempotencyKey: staff.idempotency_key,
  });
  try {
    const issued = await createOwnerAdminInvitation({
      pool,
      config,
      actor: { userKey: actorUserKey, role: 'owner' },
      payload: {
        idempotency_key: staff.idempotency_key,
        email: staff.email,
        display_name: staff.display_name,
        role: staff.role,
      },
      now,
    });
    return outcome(
      `owner_admin_${staff.role}_invitation`,
      existed ? 'already_exists' : 'created',
      'staff',
      staff.role,
      {
        actorRole: 'owner',
        deliveryState: issued.delivery.delivery_state,
        externalSendPerformed: issued.delivery.external_send_performed,
      },
    );
  } catch (error) {
    return conflictOutcome(error, `owner_admin_${staff.role}_invitation`, 'staff', staff.role);
  }
}

async function issueParentActivation(
  pool: DbPool,
  config: AppConfig,
  manifest: OneTimeIdentitySetManifest,
  actorUserKey: string,
  now: Date,
): Promise<ProvisioningOutcome> {
  const existed = await lifecycleIntentExists(pool, config, {
    intentType: 'parent_activation',
    idempotencyKey: manifest.parent.idempotency_key,
  });
  try {
    const issued = await createParentActivation({
      pool,
      config,
      actor: { userKey: actorUserKey, role: 'owner' },
      payload: {
        idempotency_key: manifest.parent.idempotency_key,
        email: manifest.parent.email,
        display_name: manifest.parent.display_name,
        household_key: manifest.household.household_key,
        relationship_key: manifest.parent.relationship_key,
        relationship_label: manifest.parent.relationship_label,
        authority: manifest.parent.authority,
      },
      now,
    });
    return outcome(
      'parent_activation',
      existed ? 'already_exists' : 'created',
      'relationship',
      manifest.parent.relationship_key,
      {
        actorRole: 'owner',
        deliveryState: issued.delivery.delivery_state,
        externalSendPerformed: issued.delivery.external_send_performed,
      },
    );
  } catch (error) {
    return conflictOutcome(
      error,
      'parent_activation',
      'relationship',
      manifest.parent.relationship_key,
    );
  }
}

async function issueStudentSetup(
  pool: DbPool,
  config: AppConfig,
  manifest: OneTimeIdentitySetManifest,
  learner: LearnerIdentity,
  activeParent: ActiveParentActor,
  now: Date,
): Promise<ProvisioningOutcome> {
  const existed = await lifecycleIntentExists(pool, config, {
    intentType: 'student_setup',
    idempotencyKey: learner.idempotency_key,
  });
  try {
    const issued = await createStudentSetup({
      pool,
      config,
      actor: { userKey: activeParent.userKey, role: 'parent' },
      payload: {
        idempotency_key: learner.idempotency_key,
        email: learner.email,
        display_name: learner.display_name,
        household_key: manifest.household.household_key,
        learner_key: learner.learner_key,
      },
      now,
    });
    return outcome(
      'student_setup',
      existed ? 'already_exists' : 'created',
      'learner',
      learner.learner_key,
      {
        actorRole: 'parent',
        deliveryState: issued.delivery.delivery_state,
        externalSendPerformed: issued.delivery.external_send_performed,
      },
    );
  } catch (error) {
    return conflictOutcome(error, 'student_setup', 'learner', learner.learner_key);
  }
}

async function ensureHousehold(
  pool: DbPool,
  config: AppConfig,
  manifest: OneTimeIdentitySetManifest,
): Promise<ProvisioningOutcome> {
  const existing = await queryOne(pool, {
    text: `SELECT household_key, display_name, status
             FROM onetime.portal_households
            WHERE account_key = $1
              AND product_key = $2
              AND household_key = $3
            LIMIT 1`,
    values: [config.accountKey, config.productKey, manifest.household.household_key],
  });
  if (existing) {
    const matches =
      existing.display_name === manifest.household.display_name && existing.status === 'active';
    return outcome(
      'household',
      matches ? 'already_exists' : 'update_blocked',
      'household',
      manifest.household.household_key,
      {
        actorRole: 'owner',
        reasonCode: matches ? null : 'existing_household_differs',
      },
    );
  }
  await pool.query(
    `INSERT INTO onetime.portal_households
       (household_key, account_key, product_key, display_name, status)
     VALUES ($1,$2,$3,$4,'active')`,
    [
      manifest.household.household_key,
      config.accountKey,
      config.productKey,
      manifest.household.display_name,
    ],
  );
  return outcome('household', 'created', 'household', manifest.household.household_key, {
    actorRole: 'owner',
  });
}

async function ensureLearner(
  pool: DbPool,
  config: AppConfig,
  manifest: OneTimeIdentitySetManifest,
  learner: LearnerIdentity,
  now: Date,
): Promise<ProvisioningOutcome> {
  const existing = await queryOne(pool, {
    text: `SELECT learner_key, household_key, display_name, grade_label, learner_status
             FROM onetime.portal_learners
            WHERE account_key = $1
              AND product_key = $2
              AND learner_key = $3
            LIMIT 1`,
    values: [config.accountKey, config.productKey, learner.learner_key],
  });
  if (existing) {
    if (existing.household_key !== manifest.household.household_key) {
      return outcome('learner', 'conflict', 'learner', learner.learner_key, {
        actorRole: 'owner',
        reasonCode: 'learner_key_owned_by_different_household',
      });
    }
    const matches =
      existing.display_name === learner.display_name &&
      existing.grade_label === learner.grade_label &&
      existing.learner_status === 'active';
    return outcome(
      'learner',
      matches ? 'already_exists' : 'update_blocked',
      'learner',
      learner.learner_key,
      {
        actorRole: 'owner',
        reasonCode: matches ? null : 'existing_learner_differs',
      },
    );
  }
  await pool.query(
    `INSERT INTO onetime.portal_learners
       (learner_key, account_key, product_key, household_key, display_name, grade_label,
        learner_status, created_at, updated_at)
     VALUES ($1,$2,$3,$4,$5,$6,'active',$7,$7)`,
    [
      learner.learner_key,
      config.accountKey,
      config.productKey,
      manifest.household.household_key,
      learner.display_name,
      learner.grade_label,
      now,
    ],
  );
  return outcome('learner', 'created', 'learner', learner.learner_key, { actorRole: 'owner' });
}

async function ensureAccessState(
  pool: DbPool,
  config: AppConfig,
  manifest: OneTimeIdentitySetManifest,
  learner: LearnerIdentity,
  now: Date,
): Promise<ProvisioningOutcome> {
  const existing = await queryOne(pool, {
    text: `SELECT access_state_key, household_key, learner_key, status
             FROM onetime.portal_student_access_state
            WHERE account_key = $1
              AND product_key = $2
              AND learner_key = $3
            LIMIT 1`,
    values: [config.accountKey, config.productKey, learner.learner_key],
  });
  if (existing) {
    const matches =
      existing.access_state_key === learner.access_state_key &&
      existing.household_key === manifest.household.household_key;
    return outcome(
      'student_access_state',
      matches ? 'already_exists' : 'conflict',
      'access_state',
      learner.access_state_key,
      {
        actorRole: 'owner',
        reasonCode: matches ? null : 'access_state_key_mismatch',
      },
    );
  }
  await pool.query(
    `INSERT INTO onetime.portal_student_access_state
       (access_state_key, account_key, product_key, household_key, learner_key, status,
        created_at, updated_at)
     VALUES ($1,$2,$3,$4,$5,'not_configured',$6,$6)`,
    [
      learner.access_state_key,
      config.accountKey,
      config.productKey,
      manifest.household.household_key,
      learner.learner_key,
      now,
    ],
  );
  return outcome('student_access_state', 'created', 'access_state', learner.access_state_key, {
    actorRole: 'owner',
  });
}

async function findActiveParentActor(
  pool: DbPool,
  config: AppConfig,
  manifest: OneTimeIdentitySetManifest,
): Promise<ActiveParentActor | null> {
  const row = await queryOne(pool, {
    text: `SELECT relationships.guardian_user_ref
             FROM onetime.portal_guardian_relationships AS relationships
             JOIN onetime.account_users AS users
               ON users.account_key = relationships.account_key
              AND users.product_key = relationships.product_key
              AND users.user_key = relationships.guardian_user_ref
            WHERE relationships.account_key = $1
              AND relationships.product_key = $2
              AND relationships.household_key = $3
              AND relationships.relationship_key = $4
              AND relationships.status = 'active'
              AND relationships.guardian_user_ref NOT LIKE 'pending_parent_%'
              AND users.role = 'parent'
              AND users.status = 'active'
            LIMIT 1`,
    values: [
      config.accountKey,
      config.productKey,
      manifest.household.household_key,
      manifest.parent.relationship_key,
    ],
  });
  return typeof row?.guardian_user_ref === 'string' ? { userKey: row.guardian_user_ref } : null;
}

async function lifecycleIntentExists(
  pool: DbPool,
  config: AppConfig,
  input: { intentType: string; idempotencyKey: string },
) {
  const row = await queryOne(pool, {
    text: `SELECT intent_key
             FROM onetime.account_lifecycle_delivery_intents
            WHERE account_key = $1
              AND product_key = $2
              AND intent_type = $3
              AND idempotency_key = $4
            LIMIT 1`,
    values: [config.accountKey, config.productKey, input.intentType, input.idempotencyKey],
  });
  return Boolean(row);
}

async function recordProvisioningAudit(
  pool: DbPool,
  config: AppConfig,
  actorUserKey: string,
  report: IdentityProvisioningReport,
) {
  await inTransaction(pool, async (client) => {
    await client.query(
      `INSERT INTO onetime.account_lifecycle_audit_events
         (audit_key, account_key, product_key, actor_user_key, action_type, success, metadata)
       VALUES ($1,$2,$3,$4,'w12_100_identity_provisioning_run',true,$5::jsonb)`,
      [
        stableKey('w12_100_identity_provisioning_audit', [
          config.accountKey,
          config.productKey,
          randomUUID(),
        ]),
        config.accountKey,
        config.productKey,
        actorUserKey,
        JSON.stringify({
          schema_version: report.schema_version,
          scope: report.scope,
          counts: report.counts,
          safety: report.safety,
        }),
      ],
    );
  });
}

function reportFromOutcomes(
  input: IdentityProvisioningInput,
  manifest: OneTimeIdentitySetManifest,
  outcomes: ProvisioningOutcome[],
  now: Date,
): IdentityProvisioningReport {
  const counts = {
    created: outcomes.filter((entry) => entry.status === 'created').length,
    already_exists: outcomes.filter((entry) => entry.status === 'already_exists').length,
    update_blocked: outcomes.filter((entry) => entry.status === 'update_blocked').length,
    conflict: outcomes.filter((entry) => entry.status === 'conflict').length,
  };
  return {
    schema_version: 'onetime.w12_100.identity_provisioning.v1',
    generated_at: now.toISOString(),
    environment: input.environment as Exclude<IdentityProvisioningEnvironment, 'production'>,
    scope: {
      account: redactedRef('account', input.config.accountKey),
      product: redactedRef('product', input.config.productKey),
      identity_set: redactedRef('identity_set', manifest.identity_set_key),
    },
    outcomes,
    counts: {
      ...counts,
      total_outcomes: outcomes.length,
      audit_entries_recorded: 0,
      external_actions: 0,
      production_mutations: 0,
    },
    safety: {
      production_rejected: true,
      explicit_account_product_scope: true,
      isolated_environment_confirmed: true,
      delivery_transport: 'sink_only',
      external_actions: 0,
      production_mutations: 0,
      secret_material_printed: false,
      default_credentials_used_for_target_identities: false,
      admin_parent_student_impersonation: false,
    },
  };
}

function outcome(
  resource: string,
  status: ProvisioningOutcomeStatus,
  refKind: string,
  refValue: string,
  options: {
    actorRole: ProvisioningOutcome['actor_role'];
    reasonCode?: string | null;
    deliveryState?: ProvisioningOutcome['delivery_state'];
    externalSendPerformed?: false;
  },
): ProvisioningOutcome {
  return {
    resource,
    status,
    ref: redactedRef(refKind, refValue),
    count: 1,
    reason_code: options.reasonCode ?? null,
    actor_role: options.actorRole,
    ...(options.deliveryState ? { delivery_state: options.deliveryState } : {}),
    ...(options.externalSendPerformed === false ? { external_send_performed: false } : {}),
    secret_material_included: false,
  };
}

function conflictOutcome(
  error: unknown,
  resource: string,
  refKind: string,
  refValue: string,
): ProvisioningOutcome {
  const reasonCode =
    error instanceof AccountLifecycleError
      ? error.code.toLowerCase()
      : 'unexpected_provisioning_error';
  return outcome(resource, 'conflict', refKind, refValue, {
    actorRole: null,
    reasonCode,
  });
}

async function queryOne(
  pool: Pick<DbPool | Queryable, 'query'>,
  input: { text: string; values: unknown[] },
): Promise<ExistingRow | null> {
  const result = await pool.query(input.text, input.values);
  return (result.rows[0] as ExistingRow | undefined) ?? null;
}

function redactedRef(kind: string, value: string): RedactedRef {
  return { kind, sha256: sha256Hex(value) };
}

function normalizedKey(value: string) {
  const normalized = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_:-]+/g, '_')
    .replace(/^_+|_+$/g, '');
  if (normalized.length < 3) {
    throw new IdentityProvisioningSafetyError(
      'identity_set_key_required',
      'Identity set key must contain at least three safe characters.',
    );
  }
  return normalized.slice(0, 72);
}

function looksProductionLike(databaseUrl: string | undefined) {
  if (!databaseUrl) return false;
  return /join\.onetimeonetime\.com|one-time-production|production|prod/i.test(databaseUrl);
}

function assertReportIsRedacted(serialized: string) {
  if (/@example\.test|token_for_local_proof|activate#|reset-password#|password/i.test(serialized)) {
    throw new IdentityProvisioningSafetyError(
      'report_redaction_failed',
      'Identity provisioning report contains credential or destination material.',
    );
  }
}

function sha256Hex(value: string) {
  return createHash('sha256').update(value).digest('hex');
}

type CliArgs = {
  environment: IdentityProvisioningEnvironment;
  accountKey: string;
  productKey: string;
  identitySetKey: string;
  apply: boolean;
  confirmIsolated: boolean;
};

function parseCliArgs(argv: string[]): CliArgs {
  const values = new Map<string, string>();
  const flags = new Set<string>();
  for (const raw of argv) {
    if (!raw.startsWith('--')) continue;
    const [key, value] = raw.slice(2).split('=', 2);
    if (!key) continue;
    if (value === undefined) flags.add(key);
    else values.set(key, value);
  }
  return {
    environment: requiredValue(values, 'environment') as IdentityProvisioningEnvironment,
    accountKey: requiredValue(values, 'account-key'),
    productKey: requiredValue(values, 'product-key'),
    identitySetKey: requiredValue(values, 'identity-set-key'),
    apply: flags.has('apply'),
    confirmIsolated: flags.has('confirm-isolated'),
  };
}

function requiredValue(values: Map<string, string>, key: string) {
  const value = values.get(key);
  if (!value) {
    throw new IdentityProvisioningSafetyError(
      'cli_argument_required',
      `Missing required --${key}=... argument.`,
    );
  }
  return value;
}

async function main() {
  const args = parseCliArgs(process.argv.slice(2));
  const config = loadConfig(process.env);
  const manifest = buildDefaultSyntheticIdentitySet(args.identitySetKey);
  const safety: IdentityProvisioningSafety = {
    apply: args.apply,
    provisioningEnabled: process.env.ONE_TIME_IDENTITY_PROVISIONING_ENABLED === 'true',
    confirmIsolatedEnvironment: args.confirmIsolated,
  };

  validateIdentityProvisioningSafety({
    config,
    environment: args.environment,
    requestedAccountKey: args.accountKey,
    requestedProductKey: args.productKey,
    safety,
  });

  const pool = createPgPool(config);
  try {
    const report = await provisionOneTimeIdentitySet({
      pool,
      config,
      environment: args.environment,
      requestedAccountKey: args.accountKey,
      requestedProductKey: args.productKey,
      manifest,
      safety,
    });
    process.stdout.write(serializeIdentityProvisioningReport(report));
  } finally {
    await pool.end();
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error: unknown) => {
    const message = error instanceof Error ? error.message : String(error);
    process.stderr.write(`identity provisioning failed: ${message}\n`);
    process.exitCode = 1;
  });
}
