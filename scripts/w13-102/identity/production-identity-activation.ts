import { createHash, randomUUID, timingSafeEqual } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { z } from 'zod';
import { loadConfig, type AppConfig } from '../../../packages/config/src/index.ts';
import { createPgPool, type DbPool } from '../../../packages/db/src/index.ts';
import {
  createOwnerAdminInvitation,
  createParentActivation,
  createStudentSetup,
  requestPasswordReset,
} from '../../../packages/domain/src/accounts/lifecycle.ts';
import { normalizeEmail, stableKey } from '../../../packages/domain/src/lead/normalize.ts';

const DEFAULT_RUN_ID = 'W13-102';
const DEFAULT_RUNTIME_SOURCE_SHA = '466d8489bb8c7a3a57f7590929b58e7857420e86';
const DEFAULT_RAILWAY_PROJECT_ID = 'ce55ef20-1418-4ad3-aafa-f877fb992dc8';
const DEFAULT_RAILWAY_ENVIRONMENT_ID = 'f911acfc-e206-44df-a569-9d69d709b94b';
const DEFAULT_RAILWAY_WEB_SERVICE_ID = 'd175ad94-5e3c-41c2-8cbc-daa1a299077d';
const COMMAND_LOCK_ID = 13102;

const roles = ['owner', 'administrator', 'parent', 'student'] as const;
type W13IdentityRole = (typeof roles)[number];
type EmailLaneStatus = 'not_proven' | 'proven' | 'blocked_with_fallback';

type Actor = {
  userKey: string;
  role: 'owner' | 'admin' | 'parent';
};

type PlanEntry = {
  role: W13IdentityRole;
  lifecycle_role: 'owner' | 'admin' | 'parent' | 'student';
  destination_ref: string | null;
  operation:
    | 'password_reset'
    | 'owner_admin_invitation'
    | 'parent_activation'
    | 'student_setup'
    | 'blocked'
    | 'not_requested';
  status: 'planned' | 'blocked' | 'not_requested' | 'applied' | 'already_issued';
  reason_code: string | null;
  idempotency_key: string | null;
  token_ref?: string | null;
  delivery_state?: string | null;
  external_send_performed?: false;
  actor_ref?: string | null;
  subject_ref?: string | null;
};

export type W13ProductionIdentityReport = {
  schema: 'onetime.w13_102.production_identity_activation.v1';
  generated_at: string;
  run_id: string;
  apply: boolean;
  status:
    'blocked' | 'dry_run_planned' | 'dry_run_blocked' | 'applied' | 'applied_with_role_blockers';
  runtime_source_sha: string;
  railway: {
    project_id: string;
    environment_id: string;
    web_service_id: string;
  };
  missing_field_names_only: string[];
  blockers: string[];
  roles: PlanEntry[];
  external_effects: {
    production_database_writes: number;
    external_sends: 0;
    private_fallback_links: number;
  };
  safety: {
    dry_run_default: true;
    exact_railway_identity_required: true;
    expected_runtime_sha_required: true;
    ephemeral_authorization_required_for_apply: true;
    private_manifest_required: true;
    advisory_lock_required_for_apply: true;
    raw_tokens_printed: false;
    raw_urls_printed: false;
    secrets_printed: false;
    pii_printed: false;
  };
};

export type W13ProductionIdentityOptions = {
  manifestPath?: string | undefined;
  manifest?: unknown;
  apply?: boolean;
  allowPartialRoles?: boolean;
  roles?: W13IdentityRole[] | undefined;
  expectedRuntimeSha?: string | undefined;
  railwayProjectId?: string | undefined;
  railwayEnvironmentId?: string | undefined;
  railwayWebServiceId?: string | undefined;
  emailLaneStatus?: EmailLaneStatus | undefined;
  fallbackOutputPath?: string | undefined;
  authorizationPhrase?: string | undefined;
  now?: Date;
  pool?: DbPool;
  config?: AppConfig;
};

const recipientSchema = z
  .object({
    role: z.string().optional(),
    destination: z.string().optional(),
    operator_controls_destination: z.boolean().optional(),
    send_now: z.boolean().optional(),
    max_message_count: z.number().int().min(0).max(1).optional(),
    authorization_notes: z.string().optional(),
    display_name: z.string().optional(),
    household_key: z.string().optional(),
    relationship_key: z.string().optional(),
    relationship_label: z.string().optional(),
    authority: z.enum(['primary_guardian', 'guardian']).optional(),
  })
  .passthrough();

const studentRecipientSchema = recipientSchema.extend({
  learner_display_identity: z.string().optional(),
  parent_managed_destination: z.string().optional(),
  learner_key: z.string().optional(),
});

const manifestSchema = z
  .object({
    schema_version: z.string().optional(),
    run_id: z.string().optional(),
    expires_at: z.string().optional(),
    expected_runtime_source_sha: z.string().optional(),
    authorization_phrase_sha256: z.string().optional(),
    account_key: z.string().optional(),
    product_key: z.string().optional(),
    railway: z
      .object({
        project_id: z.string().optional(),
        environment_id: z.string().optional(),
        web_service_id: z.string().optional(),
      })
      .optional(),
    recipients: z
      .object({
        owner: recipientSchema.optional(),
        administrator: recipientSchema.optional(),
        parent: recipientSchema.optional(),
        student: studentRecipientSchema.optional(),
      })
      .optional(),
  })
  .passthrough();

type IdentityManifest = z.infer<typeof manifestSchema>;

export async function runW13ProductionIdentityActivation(
  options: W13ProductionIdentityOptions,
): Promise<W13ProductionIdentityReport> {
  const now = options.now ?? new Date();
  const apply = options.apply === true;
  const selectedRoles = options.roles?.length ? options.roles : [...roles];
  const expectedRuntimeSha = options.expectedRuntimeSha ?? DEFAULT_RUNTIME_SOURCE_SHA;
  const railwayProjectId = options.railwayProjectId ?? DEFAULT_RAILWAY_PROJECT_ID;
  const railwayEnvironmentId = options.railwayEnvironmentId ?? DEFAULT_RAILWAY_ENVIRONMENT_ID;
  const railwayWebServiceId = options.railwayWebServiceId ?? DEFAULT_RAILWAY_WEB_SERVICE_ID;
  const manifest = manifestSchema.parse(
    options.manifest ?? (await readJsonFile(requiredManifestPath(options.manifestPath))),
  );
  const runId = manifest.run_id?.trim() || DEFAULT_RUN_ID;
  const config = options.config ?? loadConfig(process.env);
  const missing = missingFieldNames(manifest, selectedRoles, apply);
  const blockers = envelopeBlockers(manifest, {
    apply,
    now,
    runId,
    config,
    expectedRuntimeSha,
    railwayProjectId,
    railwayEnvironmentId,
    railwayWebServiceId,
    authorizationPhrase: options.authorizationPhrase,
  });

  const base = baseReport({
    now,
    runId,
    apply,
    expectedRuntimeSha,
    railwayProjectId,
    railwayEnvironmentId,
    railwayWebServiceId,
    missing,
    blockers,
  });

  if (missing.length || blockers.length) {
    return {
      ...base,
      status: apply ? 'blocked' : 'dry_run_blocked',
      roles: selectedRoles.map((role) => blockedRole(role, 'manifest_or_gate_blocker')),
    };
  }

  const pool: DbPool = options.pool ?? createPgPool(config);
  const shouldClosePool = !options.pool;
  try {
    const plan = await buildPlan(pool, config, manifest, selectedRoles, runId, now);
    const roleBlockers = plan
      .filter((entry) => entry.status === 'blocked')
      .map((entry) => `${entry.role}:${entry.reason_code ?? 'blocked'}`);
    const applyBlockers = apply
      ? applyReadinessBlockers(plan, {
          allowPartialRoles: options.allowPartialRoles === true,
          emailLaneStatus: options.emailLaneStatus ?? 'not_proven',
          fallbackOutputPath: options.fallbackOutputPath,
        })
      : [];

    if (!apply) {
      return {
        ...base,
        status: roleBlockers.length ? 'dry_run_blocked' : 'dry_run_planned',
        blockers: roleBlockers,
        roles: plan,
      };
    }

    if (applyBlockers.length) {
      return {
        ...base,
        status: 'blocked',
        blockers: [...roleBlockers, ...applyBlockers],
        roles: plan,
      };
    }

    const applied = await withCommandLock(pool, () =>
      applyPlan(pool, config, manifest, plan, {
        runId,
        now,
        emailLaneStatus: options.emailLaneStatus ?? 'not_proven',
        fallbackOutputPath: options.fallbackOutputPath,
      }),
    );
    return {
      ...base,
      status: roleBlockers.length ? 'applied_with_role_blockers' : 'applied',
      blockers: roleBlockers,
      roles: applied.roles,
      external_effects: applied.externalEffects,
    };
  } finally {
    if (shouldClosePool) await pool.end();
  }
}

function requiredManifestPath(manifestPath: string | undefined) {
  if (!manifestPath) {
    throw new Error('A private identity authorization manifest path is required.');
  }
  return manifestPath;
}

async function readJsonFile(filePath: string) {
  const text = (await readFile(filePath, 'utf8')).replace(/^\uFEFF/, '');
  return JSON.parse(text) as unknown;
}

function baseReport(input: {
  now: Date;
  runId: string;
  apply: boolean;
  expectedRuntimeSha: string;
  railwayProjectId: string;
  railwayEnvironmentId: string;
  railwayWebServiceId: string;
  missing: string[];
  blockers: string[];
}): W13ProductionIdentityReport {
  return {
    schema: 'onetime.w13_102.production_identity_activation.v1',
    generated_at: input.now.toISOString(),
    run_id: input.runId,
    apply: input.apply,
    status: input.apply ? 'blocked' : 'dry_run_blocked',
    runtime_source_sha: input.expectedRuntimeSha,
    railway: {
      project_id: input.railwayProjectId,
      environment_id: input.railwayEnvironmentId,
      web_service_id: input.railwayWebServiceId,
    },
    missing_field_names_only: input.missing,
    blockers: input.blockers,
    roles: [],
    external_effects: {
      production_database_writes: 0,
      external_sends: 0,
      private_fallback_links: 0,
    },
    safety: {
      dry_run_default: true,
      exact_railway_identity_required: true,
      expected_runtime_sha_required: true,
      ephemeral_authorization_required_for_apply: true,
      private_manifest_required: true,
      advisory_lock_required_for_apply: true,
      raw_tokens_printed: false,
      raw_urls_printed: false,
      secrets_printed: false,
      pii_printed: false,
    },
  };
}

function missingFieldNames(
  manifest: IdentityManifest,
  selectedRoles: W13IdentityRole[],
  apply: boolean,
) {
  const missing: string[] = [];
  if (!nonEmpty(manifest.expires_at)) missing.push('identity_authorization.expires_at');
  if (!nonEmpty(manifest.expected_runtime_source_sha)) {
    missing.push('identity_authorization.expected_runtime_source_sha');
  }
  if (apply && !nonEmpty(manifest.authorization_phrase_sha256)) {
    missing.push('identity_authorization.authorization_phrase_sha256');
  }

  for (const role of selectedRoles) {
    const recipient = manifest.recipients?.[role];
    if (!recipient) {
      missing.push(`recipients.${role}`);
      continue;
    }
    if (role === 'student') {
      const student = recipient as z.infer<typeof studentRecipientSchema>;
      if (!nonEmpty(student.learner_display_identity)) {
        missing.push('recipients.student.learner_display_identity');
      }
      if (!nonEmpty(student.parent_managed_destination)) {
        missing.push('recipients.student.parent_managed_destination');
      }
    } else if (!nonEmpty(recipient.destination)) {
      missing.push(`recipients.${role}.destination`);
    }
    if (typeof recipient.operator_controls_destination !== 'boolean') {
      missing.push(`recipients.${role}.operator_controls_destination`);
    }
    if (typeof recipient.send_now !== 'boolean') {
      missing.push(`recipients.${role}.send_now`);
    }
    if (typeof recipient.max_message_count !== 'number') {
      missing.push(`recipients.${role}.max_message_count`);
    }
  }
  return missing;
}

function envelopeBlockers(
  manifest: IdentityManifest,
  input: {
    apply: boolean;
    now: Date;
    runId: string;
    config: AppConfig;
    expectedRuntimeSha: string;
    railwayProjectId: string;
    railwayEnvironmentId: string;
    railwayWebServiceId: string;
    authorizationPhrase?: string | undefined;
  },
) {
  const blockers: string[] = [];
  if (manifest.run_id && manifest.run_id !== input.runId) blockers.push('run_id_mismatch');
  if (
    manifest.expected_runtime_source_sha &&
    manifest.expected_runtime_source_sha !== input.expectedRuntimeSha
  ) {
    blockers.push('manifest_runtime_sha_mismatch');
  }
  if (input.config.commitSha !== input.expectedRuntimeSha) blockers.push('runtime_sha_mismatch');
  if (manifest.account_key && manifest.account_key !== input.config.accountKey) {
    blockers.push('account_scope_mismatch');
  }
  if (manifest.product_key && manifest.product_key !== input.config.productKey) {
    blockers.push('product_scope_mismatch');
  }
  if (manifest.railway?.project_id && manifest.railway.project_id !== input.railwayProjectId) {
    blockers.push('railway_project_mismatch');
  }
  if (
    manifest.railway?.environment_id &&
    manifest.railway.environment_id !== input.railwayEnvironmentId
  ) {
    blockers.push('railway_environment_mismatch');
  }
  if (
    manifest.railway?.web_service_id &&
    manifest.railway.web_service_id !== input.railwayWebServiceId
  ) {
    blockers.push('railway_web_service_mismatch');
  }
  if (manifest.expires_at) {
    const expires = new Date(manifest.expires_at);
    if (Number.isNaN(expires.getTime())) blockers.push('authorization_expiry_invalid');
    else if (expires <= input.now) blockers.push('authorization_expired');
  }
  if (input.apply) {
    if (!input.authorizationPhrase) blockers.push('ephemeral_authorization_missing');
    else if (
      manifest.authorization_phrase_sha256 &&
      !sha256Equals(input.authorizationPhrase, manifest.authorization_phrase_sha256)
    ) {
      blockers.push('ephemeral_authorization_mismatch');
    }
  }
  return blockers;
}

async function buildPlan(
  pool: DbPool,
  config: AppConfig,
  manifest: IdentityManifest,
  selectedRoles: W13IdentityRole[],
  runId: string,
  now: Date,
): Promise<PlanEntry[]> {
  const actor = await discoverOwnerAdminActor(pool, config);
  const parentActor = await discoverParentActor(pool, config);
  const entries: PlanEntry[] = [];
  for (const role of selectedRoles) {
    entries.push(await planRole(pool, config, manifest, role, runId, now, actor, parentActor));
  }
  return entries;
}

async function planRole(
  pool: DbPool,
  config: AppConfig,
  manifest: IdentityManifest,
  role: W13IdentityRole,
  runId: string,
  now: Date,
  ownerAdminActor: Actor | null,
  parentActor: Actor | null,
): Promise<PlanEntry> {
  const recipient = manifest.recipients?.[role];
  if (!recipient) return blockedRole(role, 'recipient_missing');
  if (recipient.send_now !== true || recipient.max_message_count !== 1) {
    return blockedRole(role, 'recipient_not_currently_authorized');
  }

  const destination = destinationForRole(role, recipient);
  if (!destination) return blockedRole(role, 'destination_missing');
  const email = normalizeEmail(destination);
  const user = await findAccountUserByEmail(pool, config, email);
  const lifecycleRole = lifecycleRoleFor(role);
  const idempotencyKey = idempotencyKeyFor(runId, role, email);
  const common = {
    role,
    lifecycle_role: lifecycleRole,
    destination_ref: digestRef('email', email),
    idempotency_key: idempotencyKey,
  };

  if (user) {
    if (user.role !== lifecycleRole) {
      return { ...common, operation: 'blocked', status: 'blocked', reason_code: 'role_conflict' };
    }
    if (user.status !== 'active') {
      return {
        ...common,
        operation: 'blocked',
        status: 'blocked',
        reason_code: 'identity_not_active',
      };
    }
    return {
      ...common,
      operation: 'password_reset',
      status: 'planned',
      reason_code: null,
      subject_ref: digestRef('user', user.userKey),
    };
  }

  if (role === 'owner' || role === 'administrator') {
    if (!ownerAdminActor)
      return {
        ...common,
        operation: 'blocked',
        status: 'blocked',
        reason_code: 'active_owner_admin_actor_missing',
      };
    if (!nonEmpty(recipient.display_name)) {
      return {
        ...common,
        operation: 'blocked',
        status: 'blocked',
        reason_code: 'display_name_missing_for_new_identity',
      };
    }
    return {
      ...common,
      operation: 'owner_admin_invitation',
      status: 'planned',
      reason_code: null,
      actor_ref: digestRef('user', ownerAdminActor.userKey),
    };
  }

  if (role === 'parent') {
    if (!ownerAdminActor)
      return {
        ...common,
        operation: 'blocked',
        status: 'blocked',
        reason_code: 'active_owner_admin_actor_missing',
      };
    const missing = firstMissing(recipient, ['display_name', 'household_key', 'relationship_key']);
    if (missing)
      return {
        ...common,
        operation: 'blocked',
        status: 'blocked',
        reason_code: `${missing}_missing_for_parent_activation`,
      };
    if (!(await householdExists(pool, config, String(recipient.household_key)))) {
      return {
        ...common,
        operation: 'blocked',
        status: 'blocked',
        reason_code: 'household_not_found',
      };
    }
    return {
      ...common,
      operation: 'parent_activation',
      status: 'planned',
      reason_code: null,
      actor_ref: digestRef('user', ownerAdminActor.userKey),
    };
  }

  const student = recipient as z.infer<typeof studentRecipientSchema>;
  const studentActor = parentActor ?? ownerAdminActor;
  if (!studentActor)
    return {
      ...common,
      operation: 'blocked',
      status: 'blocked',
      reason_code: 'student_actor_missing',
    };
  const missing = firstMissing(student, ['display_name', 'household_key', 'learner_key']);
  if (missing)
    return {
      ...common,
      operation: 'blocked',
      status: 'blocked',
      reason_code: `${missing}_missing_for_student_setup`,
    };
  if (
    !(await learnerExists(pool, config, String(student.household_key), String(student.learner_key)))
  ) {
    return { ...common, operation: 'blocked', status: 'blocked', reason_code: 'learner_not_found' };
  }
  return {
    ...common,
    operation: 'student_setup',
    status: 'planned',
    reason_code: null,
    actor_ref: digestRef('user', studentActor.userKey),
  };
}

function applyReadinessBlockers(
  plan: PlanEntry[],
  input: {
    allowPartialRoles: boolean;
    emailLaneStatus: EmailLaneStatus;
    fallbackOutputPath?: string | undefined;
  },
) {
  const blockers: string[] = [];
  const roleBlockers = plan.filter((entry) => entry.status === 'blocked');
  if (roleBlockers.length && !input.allowPartialRoles) blockers.push('role_blockers_present');
  const planned = plan.filter((entry) => entry.status === 'planned');
  if (!planned.length) blockers.push('no_role_operations_planned');
  if (input.emailLaneStatus === 'not_proven') blockers.push('transactional_email_lane_not_proven');
  if (input.emailLaneStatus === 'blocked_with_fallback') {
    if (!input.fallbackOutputPath) blockers.push('private_fallback_output_path_missing');
    for (const entry of planned) {
      if (entry.role !== 'administrator' && entry.role !== 'parent') {
        blockers.push(`${entry.role}_private_fallback_not_allowed`);
      }
    }
  }
  return blockers;
}

async function applyPlan(
  pool: DbPool,
  config: AppConfig,
  manifest: IdentityManifest,
  plan: PlanEntry[],
  input: {
    runId: string;
    now: Date;
    emailLaneStatus: EmailLaneStatus;
    fallbackOutputPath?: string | undefined;
  },
) {
  const rolesOut: PlanEntry[] = [];
  const fallbackLinks: Array<{ role: W13IdentityRole; url: string; token_type: string }> = [];
  let writes = 0;
  for (const entry of plan) {
    if (entry.status !== 'planned') {
      rolesOut.push(entry);
      continue;
    }
    const recipient = manifest.recipients?.[entry.role];
    if (!recipient) throw new Error(`Missing recipient for ${entry.role}.`);
    const destination = requiredDestinationForRole(entry.role, recipient);
    const includeLocalProof =
      input.emailLaneStatus === 'blocked_with_fallback' &&
      (entry.role === 'administrator' || entry.role === 'parent');
    const result = await applyPlanEntry(pool, config, entry, recipient, destination, {
      now: input.now,
      includeLocalProof,
    });
    writes += result.writeCount;
    rolesOut.push(result.entry);
    if (result.privateFallbackUrl) {
      fallbackLinks.push({
        role: entry.role,
        url: result.privateFallbackUrl,
        token_type: result.tokenType,
      });
    }
    await auditCommandEvent(pool, config, {
      runId: input.runId,
      role: entry.role,
      operation: entry.operation,
      destinationRef: entry.destination_ref,
      tokenRef: result.entry.token_ref ?? null,
      now: input.now,
    });
    writes += 1;
  }
  if (fallbackLinks.length) {
    if (!input.fallbackOutputPath) throw new Error('Private fallback output path missing.');
    await writePrivateFallback(input.fallbackOutputPath, input.runId, input.now, fallbackLinks);
  }
  return {
    roles: rolesOut,
    externalEffects: {
      production_database_writes: writes,
      external_sends: 0 as const,
      private_fallback_links: fallbackLinks.length,
    },
  };
}

type ApplyPlanEntryResult = {
  writeCount: number;
  tokenType: string;
  privateFallbackUrl: string | null;
  entry: PlanEntry;
};

async function applyPlanEntry(
  pool: DbPool,
  config: AppConfig,
  entry: PlanEntry,
  recipient: z.infer<typeof recipientSchema>,
  destination: string,
  input: { now: Date; includeLocalProof: boolean },
): Promise<ApplyPlanEntryResult> {
  if (entry.operation === 'password_reset') {
    const existing = await existingToken(
      pool,
      config,
      'password_reset',
      requiredIdempotency(entry),
    );
    if (existing) {
      return {
        writeCount: 0,
        tokenType: 'password_reset',
        privateFallbackUrl: null,
        entry: {
          ...entry,
          status: 'already_issued' as const,
          token_ref: tokenRef(existing.token_key),
          delivery_state: existing.delivery_state,
          external_send_performed: false as const,
        },
      };
    }
    const issue = await requestPasswordReset({
      pool,
      config,
      payload: { idempotency_key: requiredIdempotency(entry), email: destination },
      now: input.now,
      includeLocalProofToken: input.includeLocalProof,
    });
    if (!('token_key' in issue)) {
      return {
        writeCount: 1,
        tokenType: 'password_reset',
        privateFallbackUrl: null,
        entry: { ...entry, status: 'applied' as const, token_ref: null, delivery_state: null },
      };
    }
    return issuedResult(entry, issue, 'password_reset', input.includeLocalProof);
  }

  const ownerAdminActor = await discoverOwnerAdminActor(pool, config);
  if (!ownerAdminActor) throw new Error('Active owner/admin actor missing at apply time.');
  if (entry.operation === 'owner_admin_invitation') {
    const issue = await createOwnerAdminInvitation({
      pool,
      config,
      actor: ownerAdminActor,
      payload: {
        idempotency_key: requiredIdempotency(entry),
        email: destination,
        display_name: requiredString(recipient.display_name, 'display_name'),
        role: entry.lifecycle_role,
      },
      now: input.now,
      includeLocalProofToken: input.includeLocalProof,
    });
    return issuedResult(entry, issue, 'owner_admin_invitation', input.includeLocalProof);
  }
  if (entry.operation === 'parent_activation') {
    const issue = await createParentActivation({
      pool,
      config,
      actor: ownerAdminActor,
      payload: {
        idempotency_key: requiredIdempotency(entry),
        email: destination,
        display_name: requiredString(recipient.display_name, 'display_name'),
        household_key: requiredString(recipient.household_key, 'household_key'),
        relationship_key: requiredString(recipient.relationship_key, 'relationship_key'),
        relationship_label: recipient.relationship_label ?? 'Parent',
        authority: recipient.authority ?? 'primary_guardian',
      },
      now: input.now,
      includeLocalProofToken: input.includeLocalProof,
    });
    return issuedResult(entry, issue, 'parent_activation', input.includeLocalProof);
  }
  if (entry.operation === 'student_setup') {
    const student = recipient as z.infer<typeof studentRecipientSchema>;
    const actor = (await discoverParentActor(pool, config)) ?? ownerAdminActor;
    const issue = await createStudentSetup({
      pool,
      config,
      actor,
      payload: {
        idempotency_key: requiredIdempotency(entry),
        email: destination,
        display_name: requiredString(student.display_name, 'display_name'),
        household_key: requiredString(student.household_key, 'household_key'),
        learner_key: requiredString(student.learner_key, 'learner_key'),
      },
      now: input.now,
      includeLocalProofToken: input.includeLocalProof,
    });
    return issuedResult(entry, issue, 'student_setup', input.includeLocalProof);
  }
  throw new Error(`Unsupported operation: ${entry.operation}`);
}

function issuedResult(
  entry: PlanEntry,
  issue: {
    token_key: string;
    token_type: string;
    delivery: { delivery_state: string };
    token_for_local_proof?: string;
  },
  tokenType: string,
  includeLocalProof: boolean,
) {
  const privateFallbackUrl =
    includeLocalProof && issue.token_for_local_proof
      ? lifecycleUrl(tokenType, issue.token_for_local_proof)
      : undefined;
  return {
    writeCount: 1,
    tokenType,
    privateFallbackUrl: privateFallbackUrl ?? null,
    entry: {
      ...entry,
      status: 'applied' as const,
      token_ref: tokenRef(issue.token_key),
      delivery_state: issue.delivery.delivery_state,
      external_send_performed: false as const,
    },
  };
}

async function withCommandLock<T>(pool: DbPool, run: () => Promise<T>) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('SELECT pg_advisory_xact_lock($1)', [COMMAND_LOCK_ID]);
    const result = await run();
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

async function findAccountUserByEmail(pool: DbPool, config: AppConfig, email: string) {
  const result = await pool.query(
    `SELECT user_key, role, status
       FROM onetime.account_users
      WHERE account_key = $1
        AND product_key = $2
        AND email_normalized = $3
      LIMIT 1`,
    [config.accountKey, config.productKey, email],
  );
  const row = result.rows[0] as Record<string, unknown> | undefined;
  if (!row) return null;
  return {
    userKey: String(row.user_key),
    role: String(row.role),
    status: String(row.status),
  };
}

async function discoverOwnerAdminActor(pool: DbPool, config: AppConfig): Promise<Actor | null> {
  const result = await pool.query(
    `SELECT user_key, role
       FROM onetime.account_users
      WHERE account_key = $1
        AND product_key = $2
        AND role IN ('owner', 'admin')
        AND status = 'active'
      ORDER BY CASE role WHEN 'owner' THEN 0 ELSE 1 END, created_at ASC
      LIMIT 1`,
    [config.accountKey, config.productKey],
  );
  const row = result.rows[0] as Record<string, unknown> | undefined;
  if (!row) return null;
  return { userKey: String(row.user_key), role: String(row.role) as 'owner' | 'admin' };
}

async function discoverParentActor(pool: DbPool, config: AppConfig): Promise<Actor | null> {
  const result = await pool.query(
    `SELECT user_key, role
       FROM onetime.account_users
      WHERE account_key = $1
        AND product_key = $2
        AND role = 'parent'
        AND status = 'active'
      ORDER BY created_at ASC
      LIMIT 1`,
    [config.accountKey, config.productKey],
  );
  const row = result.rows[0] as Record<string, unknown> | undefined;
  if (!row) return null;
  return { userKey: String(row.user_key), role: 'parent' };
}

async function householdExists(pool: DbPool, config: AppConfig, householdKey: string) {
  const result = await pool.query(
    `SELECT 1
       FROM onetime.portal_households
      WHERE account_key = $1
        AND product_key = $2
        AND household_key = $3
        AND status = 'active'
      LIMIT 1`,
    [config.accountKey, config.productKey, householdKey],
  );
  return Boolean(result.rowCount);
}

async function learnerExists(
  pool: DbPool,
  config: AppConfig,
  householdKey: string,
  learnerKey: string,
) {
  const result = await pool.query(
    `SELECT 1
       FROM onetime.portal_learners
      WHERE account_key = $1
        AND product_key = $2
        AND household_key = $3
        AND learner_key = $4
        AND learner_status <> 'archived'
      LIMIT 1`,
    [config.accountKey, config.productKey, householdKey, learnerKey],
  );
  return Boolean(result.rowCount);
}

async function existingToken(
  pool: DbPool,
  config: AppConfig,
  tokenType: string,
  idempotencyKey: string,
) {
  const tokenKey = stableKey('account_lifecycle_token', [
    config.accountKey,
    config.productKey,
    tokenType,
    idempotencyKey,
  ]);
  const result = await pool.query(
    `SELECT tokens.token_key, intents.delivery_state
       FROM onetime.account_lifecycle_tokens AS tokens
       LEFT JOIN onetime.account_lifecycle_delivery_intents AS intents
         ON intents.account_key = tokens.account_key
        AND intents.product_key = tokens.product_key
        AND intents.token_key = tokens.token_key
      WHERE tokens.account_key = $1
        AND tokens.product_key = $2
        AND tokens.token_key = $3
      LIMIT 1`,
    [config.accountKey, config.productKey, tokenKey],
  );
  const row = result.rows[0] as Record<string, unknown> | undefined;
  if (!row) return null;
  return {
    token_key: String(row.token_key),
    delivery_state: row.delivery_state ? String(row.delivery_state) : null,
  };
}

async function auditCommandEvent(
  pool: DbPool,
  config: AppConfig,
  input: {
    runId: string;
    role: W13IdentityRole;
    operation: string;
    destinationRef: string | null;
    tokenRef: string | null;
    now: Date;
  },
) {
  await pool.query(
    `INSERT INTO onetime.account_lifecycle_audit_events
       (audit_key, account_key, product_key, action_type, success, metadata, created_at)
     VALUES ($1,$2,$3,'w13_102_identity_activation_command',true,$4::jsonb,$5)`,
    [
      stableKey('account_lifecycle_audit', [
        config.accountKey,
        config.productKey,
        'w13_102_identity_activation_command',
        randomUUID(),
      ]),
      config.accountKey,
      config.productKey,
      JSON.stringify({
        run_id: input.runId,
        role: input.role,
        operation: input.operation,
        destination_ref: input.destinationRef,
        token_ref: input.tokenRef,
        raw_token_included: false,
        raw_url_included: false,
      }),
      input.now,
    ],
  );
}

async function writePrivateFallback(
  outputPath: string,
  runId: string,
  now: Date,
  links: Array<{ role: W13IdentityRole; url: string; token_type: string }>,
) {
  await mkdir(path.dirname(outputPath), { recursive: true });
  await writeFile(
    outputPath,
    `${JSON.stringify(
      {
        schema: 'onetime.w13_102.private_identity_fallback.v1',
        generated_at: now.toISOString(),
        run_id: runId,
        links,
      },
      null,
      2,
    )}\n`,
    { encoding: 'utf8', mode: 0o600 },
  );
}

function destinationForRole(role: W13IdentityRole, recipient: z.infer<typeof recipientSchema>) {
  if (role === 'student') {
    return (recipient as z.infer<typeof studentRecipientSchema>).parent_managed_destination?.trim();
  }
  return recipient.destination?.trim();
}

function requiredDestinationForRole(
  role: W13IdentityRole,
  recipient: z.infer<typeof recipientSchema>,
) {
  const destination = destinationForRole(role, recipient);
  if (!destination) throw new Error(`Missing destination for ${role}.`);
  return destination;
}

function lifecycleRoleFor(role: W13IdentityRole): PlanEntry['lifecycle_role'] {
  if (role === 'administrator') return 'admin';
  return role;
}

function blockedRole(role: W13IdentityRole, reasonCode: string): PlanEntry {
  return {
    role,
    lifecycle_role: lifecycleRoleFor(role),
    destination_ref: null,
    operation: 'blocked',
    status: 'blocked',
    reason_code: reasonCode,
    idempotency_key: null,
  };
}

function idempotencyKeyFor(runId: string, role: W13IdentityRole, email: string) {
  return `w13-102-${role}-${sha256(`${runId}:${role}:${email}`).slice(0, 32)}`;
}

function requiredIdempotency(entry: PlanEntry) {
  if (!entry.idempotency_key) throw new Error(`Missing idempotency key for ${entry.role}.`);
  return entry.idempotency_key;
}

function firstMissing(record: Record<string, unknown>, keys: string[]) {
  return keys.find((key) => !nonEmpty(record[key]));
}

function nonEmpty(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function requiredString(value: unknown, key: string) {
  if (!nonEmpty(value)) throw new Error(`Missing ${key}.`);
  return value.trim();
}

function digestRef(kind: string, value: string) {
  return `${kind}:${sha256(value)}`;
}

function tokenRef(tokenKey: string) {
  return stableKey('account_lifecycle_token_ref', [tokenKey]).slice(0, 40);
}

function sha256(value: string) {
  return createHash('sha256').update(value).digest('hex');
}

function sha256Equals(value: string, expectedHex: string) {
  const actual = Buffer.from(sha256(value), 'hex');
  const expected = Buffer.from(expectedHex, 'hex');
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

function lifecycleUrl(tokenType: string, token: string) {
  const route = tokenType === 'password_reset' ? '/reset-password' : '/activate';
  return `https://join.onetimeonetime.com${route}#token=${encodeURIComponent(token)}`;
}

function isCliEntrypoint() {
  return process.argv[1] ? import.meta.url === pathToFileURL(process.argv[1]).href : false;
}

function parseArgs(argv: string[]) {
  const options: Record<string, string | boolean | string[]> = {};
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (!arg?.startsWith('--')) continue;
    const key = arg.slice(2);
    if (key === 'apply' || key === 'allow-partial-roles') {
      options[key] = true;
      continue;
    }
    const value = argv[index + 1];
    if (!value) throw new Error(`Missing value for --${key}`);
    index += 1;
    if (key === 'role') {
      const existing = options[key];
      options[key] = Array.isArray(existing) ? [...existing, value] : [value];
    } else {
      options[key] = value;
    }
  }
  return options;
}

async function loadRuntimeEnvJson(filePath: string | undefined) {
  if (!filePath) return;
  const parsed = (await readJsonFile(filePath)) as { env?: Record<string, unknown> };
  for (const [key, value] of Object.entries(parsed.env ?? {})) {
    process.env[key] = String(value);
  }
}

function parseRoles(value: string | boolean | string[] | undefined): W13IdentityRole[] | undefined {
  if (!value) return undefined;
  const values = Array.isArray(value) ? value : [String(value)];
  for (const role of values) {
    if (!(roles as readonly string[]).includes(role)) {
      throw new Error(`Unsupported role: ${role}`);
    }
  }
  return values as W13IdentityRole[];
}

if (isCliEntrypoint()) {
  const args = parseArgs(process.argv.slice(2));
  await loadRuntimeEnvJson(
    typeof args['runtime-env-json'] === 'string' ? args['runtime-env-json'] : undefined,
  );
  const report = await runW13ProductionIdentityActivation({
    manifestPath: typeof args.manifest === 'string' ? args.manifest : undefined,
    apply: args.apply === true,
    allowPartialRoles: args['allow-partial-roles'] === true,
    roles: parseRoles(args.role),
    expectedRuntimeSha:
      typeof args['expected-runtime-sha'] === 'string' ? args['expected-runtime-sha'] : undefined,
    railwayProjectId:
      typeof args['railway-project'] === 'string' ? args['railway-project'] : undefined,
    railwayEnvironmentId:
      typeof args['railway-environment'] === 'string' ? args['railway-environment'] : undefined,
    railwayWebServiceId:
      typeof args['railway-web-service'] === 'string' ? args['railway-web-service'] : undefined,
    emailLaneStatus:
      typeof args['email-lane-status'] === 'string'
        ? (args['email-lane-status'] as EmailLaneStatus)
        : undefined,
    fallbackOutputPath:
      typeof args['fallback-output'] === 'string' ? args['fallback-output'] : undefined,
    authorizationPhrase: process.env.W13_102_PRODUCTION_IDENTITY_AUTHORIZATION,
  });
  const output = `${JSON.stringify(report, null, 2)}\n`;
  if (typeof args.out === 'string') await writeFile(args.out, output, 'utf8');
  process.stdout.write(output);
  if (report.status === 'blocked' || report.status === 'dry_run_blocked') process.exitCode = 2;
}
