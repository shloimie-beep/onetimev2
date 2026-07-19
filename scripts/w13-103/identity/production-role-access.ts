import { createCipheriv, createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import { writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { z } from 'zod';
import { loadConfig, type AppConfig } from '../../../packages/config/src/index.ts';
import { createPgPool, inTransaction, type DbPool } from '../../../packages/db/src/index.ts';
import {
  createOwnerAdminInvitation,
  createParentActivation,
  createStudentReset,
  createStudentSetup,
  requestPasswordReset,
} from '../../../packages/domain/src/accounts/lifecycle.ts';
import { revokeUserSessions } from '../../../packages/domain/src/auth/service.ts';
import { normalizeEmail, stableKey } from '../../../packages/domain/src/lead/normalize.ts';

const RUN_ID = 'W13-103';
const EXPECTED_RUNTIME_SHA = '007e0215d1186ca51163dea3b1c15303bf52a860';
const PRODUCTION_PROJECT_ID = 'ce55ef20-1418-4ad3-aafa-f877fb992dc8';
const PRODUCTION_ENVIRONMENT_ID = 'f911acfc-e206-44df-a569-9d69d709b94b';
const PRODUCTION_WEB_SERVICE_ID = 'd175ad94-5e3c-41c2-8cbc-daa1a299077d';
const COMMAND_LOCK_ID = 13103;

const modes = ['counts', 'dry-run', 'apply-initial', 'apply-student', 'final-reset'] as const;
type Mode = (typeof modes)[number];
type Role = 'administrator' | 'parent' | 'student';
type LinkPurpose =
  | 'password_reset'
  | 'owner_admin_invitation'
  | 'parent_activation'
  | 'student_setup'
  | 'student_reset';

const recipientSchema = z
  .object({
    destination: z.string().email().optional(),
    display_name: z.string().trim().min(1).max(160).optional(),
    operator_controlled: z.boolean().default(false),
    send_now: z.boolean().default(false),
    max_message_count: z.number().int().min(0).max(1).default(0),
    destination_source: z.string().trim().max(160).optional(),
    household_key: z.string().trim().min(3).max(180).optional(),
    relationship_key: z.string().trim().min(3).max(180).optional(),
    relationship_label: z.string().trim().min(1).max(80).optional(),
    authority: z.enum(['primary_guardian', 'guardian']).optional(),
    learner_key: z.string().trim().min(3).max(180).optional(),
    learner_display_identity: z.string().trim().min(1).max(160).optional(),
    grade_label: z.string().trim().max(80).optional(),
  })
  .strict();

const manifestSchema = z
  .object({
    schema_version: z.string().optional(),
    run_id: z.literal(RUN_ID),
    generated_at: z.string().optional(),
    expires_at: z.string(),
    expected_runtime_source_sha: z.literal(EXPECTED_RUNTIME_SHA),
    authorization_phrase_sha256: z.string().regex(/^[a-f0-9]{64}$/i),
    mutation_budget: z
      .object({
        users_created: z.number().int().min(0).max(3).default(3),
        households_created: z.number().int().min(0).max(1).default(1),
        learners_created: z.number().int().min(0).max(1).default(1),
        lifecycle_tokens_issued: z.number().int().min(0).max(6).default(6),
      })
      .default({
        users_created: 3,
        households_created: 1,
        learners_created: 1,
        lifecycle_tokens_issued: 6,
      }),
    account_key: z.string().min(1).default('one_time'),
    product_key: z.string().min(1).default('one_time_mishnah_class'),
    railway: z
      .object({
        project_id: z.literal(PRODUCTION_PROJECT_ID),
        environment_id: z.literal(PRODUCTION_ENVIRONMENT_ID),
        web_service_id: z.literal(PRODUCTION_WEB_SERVICE_ID),
      })
      .default({
        project_id: PRODUCTION_PROJECT_ID,
        environment_id: PRODUCTION_ENVIRONMENT_ID,
        web_service_id: PRODUCTION_WEB_SERVICE_ID,
      }),
    recipients: z.object({
      administrator: recipientSchema,
      parent: recipientSchema,
      student: recipientSchema,
    }),
  })
  .strict();

type Manifest = z.infer<typeof manifestSchema>;

type Candidate = {
  role: Role;
  destination_ref: string;
  user_present: boolean;
  user_role: string | null;
  user_status: string | null;
};

type SanitizedLink = {
  role: Role;
  purpose: LinkPurpose;
  token_ref: string;
  expires_at: string;
  url: string;
};

type RoleResult = {
  role: Role;
  operation: string;
  status: 'planned' | 'applied' | 'already_satisfied' | 'blocked';
  reason_code: string | null;
  destination_ref: string;
  token_ref?: string | undefined;
  delivery_state?: string | null | undefined;
  sessions_revoked?: number | undefined;
};

type ApplyResult = {
  roles: RoleResult[];
  links: SanitizedLink[];
  foundation?: boolean | undefined;
};

type Counts = {
  account_users_by_role_status: Array<{ role: string; status: string; count: number }>;
  household_count: number;
  learner_count: number;
  student_access_by_status: Array<{ status: string; count: number }>;
  lifecycle_tokens_by_type_state: Array<{ token_type: string; token_state: string; count: number }>;
  lifecycle_outbox_by_state: Array<{ state: string; count: number }>;
  active_sessions_by_role: Array<{ role: string; count: number }>;
  latest_migration: string | null;
};

export async function runW13ProductionRoleAccessTask(input: {
  mode: Mode;
  manifest?: unknown;
  authorizationPhrase?: string | undefined;
  handoffEncryptionKey?: string | undefined;
  now?: Date;
  config?: AppConfig;
  pool?: DbPool;
}) {
  const now = input.now ?? new Date();
  ensureDatabaseUrl();
  const config = input.config ?? loadConfig(process.env);
  const pool = input.pool ?? createPgPool(config);
  const shouldClosePool = !input.pool;
  try {
    const manifest = input.manifest ? manifestSchema.parse(input.manifest) : readManifestFromEnv();
    const blockers = gateBlockers({
      mode: input.mode,
      manifest,
      config,
      now,
      authorizationPhrase: input.authorizationPhrase,
    });
    const before = await countsOnly(pool, config);
    const candidates = await candidateSummary(pool, config, manifest);
    if (blockers.length) {
      return baseReport(input.mode, now, manifest, before, candidates, {
        status: input.mode === 'counts' ? 'counts_ready' : 'blocked',
        blockers,
      });
    }
    if (input.mode === 'counts') {
      return baseReport(input.mode, now, manifest, before, candidates, {
        status: 'counts_ready',
        blockers: [],
      });
    }

    if (input.mode === 'dry-run') {
      const plan = await dryRunPlan(pool, config, manifest);
      return baseReport(input.mode, now, manifest, before, candidates, {
        status: plan.some((entry) => entry.status === 'blocked') ? 'blocked' : 'dry_run_ready',
        blockers: plan
          .filter((entry) => entry.status === 'blocked')
          .map((entry) => `${entry.role}:${entry.reason_code ?? 'blocked'}`),
        roles: plan,
      });
    }

    const encryptedLinks =
      input.handoffEncryptionKey ?? process.env.W13_103_HANDOFF_ENCRYPTION_KEY_B64;
    if (!encryptedLinks) {
      return baseReport(input.mode, now, manifest, before, candidates, {
        status: 'blocked',
        blockers: ['handoff_encryption_key_missing'],
      });
    }

    const applied = await withCommandLock(pool, () =>
      applyMode(pool, config, manifest, input.mode as Exclude<Mode, 'counts' | 'dry-run'>, now),
    );
    const after = await countsOnly(pool, config);
    return {
      ...baseReport(input.mode, now, manifest, before, candidates, {
        status: 'applied',
        blockers: [],
        roles: applied.roles,
      }),
      counts_after: after,
      mutation_deltas: mutationDeltas(before, after, applied),
      encrypted_handoff: encryptHandoff(encryptedLinks, {
        schema: 'onetime.w13_103.encrypted_role_access_handoff.v1',
        generated_at: now.toISOString(),
        run_id: RUN_ID,
        mode: input.mode,
        production_login_url: 'https://join.onetimeonetime.com/login',
        links: applied.links,
        roles: applied.roles,
      }),
    };
  } finally {
    if (shouldClosePool) await pool.end();
  }
}

function ensureDatabaseUrl() {
  if (!process.env.DATABASE_URL && process.env.SOURCE_DATABASE_URL) {
    process.env.DATABASE_URL = process.env.SOURCE_DATABASE_URL;
  }
}

function readManifestFromEnv() {
  const encoded = process.env.W13_103_IDENTITY_AUTHORIZATION_JSON_B64;
  if (!encoded) throw new Error('W13_103_IDENTITY_AUTHORIZATION_JSON_B64 is required.');
  return manifestSchema.parse(JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8')));
}

function gateBlockers(input: {
  mode: Mode;
  manifest: Manifest;
  config: AppConfig;
  now: Date;
  authorizationPhrase?: string | undefined;
}) {
  const blockers: string[] = [];
  const expires = new Date(input.manifest.expires_at);
  if (Number.isNaN(expires.getTime())) blockers.push('authorization_expiry_invalid');
  else if (expires <= input.now) blockers.push('authorization_expired');
  if (input.config.commitSha !== EXPECTED_RUNTIME_SHA) blockers.push('runtime_sha_mismatch');
  if (input.config.accountKey !== input.manifest.account_key)
    blockers.push('account_scope_mismatch');
  if (input.config.productKey !== input.manifest.product_key)
    blockers.push('product_scope_mismatch');
  if (process.env.RAILWAY_PROJECT_ID && process.env.RAILWAY_PROJECT_ID !== PRODUCTION_PROJECT_ID) {
    blockers.push('railway_project_mismatch');
  }
  if (
    process.env.RAILWAY_ENVIRONMENT_ID &&
    process.env.RAILWAY_ENVIRONMENT_ID !== PRODUCTION_ENVIRONMENT_ID
  ) {
    blockers.push('railway_environment_mismatch');
  }
  if (input.mode !== 'counts' && input.mode !== 'dry-run') {
    if (!input.authorizationPhrase) blockers.push('ephemeral_authorization_missing');
    else if (!sha256Equals(input.authorizationPhrase, input.manifest.authorization_phrase_sha256)) {
      blockers.push('ephemeral_authorization_mismatch');
    }
  }
  for (const [role, recipient] of Object.entries(input.manifest.recipients) as Array<
    [Role, Manifest['recipients'][Role]]
  >) {
    if (!recipient.operator_controlled)
      blockers.push(`${role}_destination_not_operator_controlled`);
    if (!recipient.send_now || recipient.max_message_count !== 1) {
      blockers.push(`${role}_recipient_budget_not_authorized`);
    }
    if (!recipient.destination) blockers.push(`${role}_destination_missing`);
  }
  return blockers;
}

async function countsOnly(pool: DbPool, config: AppConfig): Promise<Counts> {
  const [users, households, learners, access, tokens, outbox, sessions, migration] =
    await Promise.all([
      pool.query(
        `SELECT role, status, count(*)::int AS count
           FROM onetime.account_users
          WHERE account_key = $1 AND product_key = $2
          GROUP BY role, status
          ORDER BY role, status`,
        [config.accountKey, config.productKey],
      ),
      pool.query(
        `SELECT count(*)::int AS count
           FROM onetime.portal_households
          WHERE account_key = $1 AND product_key = $2`,
        [config.accountKey, config.productKey],
      ),
      pool.query(
        `SELECT count(*)::int AS count
           FROM onetime.portal_learners
          WHERE account_key = $1 AND product_key = $2`,
        [config.accountKey, config.productKey],
      ),
      pool.query(
        `SELECT status, count(*)::int AS count
           FROM onetime.portal_student_access_state
          WHERE account_key = $1 AND product_key = $2
          GROUP BY status
          ORDER BY status`,
        [config.accountKey, config.productKey],
      ),
      pool.query(
        `SELECT token_type,
                CASE
                  WHEN consumed_at IS NOT NULL THEN 'consumed'
                  WHEN revoked_at IS NOT NULL THEN 'revoked'
                  WHEN expires_at <= now() THEN 'expired'
                  ELSE 'outstanding'
                END AS token_state,
                count(*)::int AS count
           FROM onetime.account_lifecycle_tokens
          WHERE account_key = $1 AND product_key = $2
          GROUP BY token_type, token_state
          ORDER BY token_type, token_state`,
        [config.accountKey, config.productKey],
      ),
      pool.query(
        `SELECT state, count(*)::int AS count
           FROM onetime.account_lifecycle_delivery_outbox
          WHERE account_key = $1 AND product_key = $2
          GROUP BY state
          ORDER BY state`,
        [config.accountKey, config.productKey],
      ),
      pool.query(
        `SELECT users.role, count(*)::int AS count
           FROM onetime.user_sessions AS sessions
           JOIN onetime.account_users AS users
             ON users.account_key = sessions.account_key
            AND users.product_key = sessions.product_key
            AND users.user_key = sessions.user_key
          WHERE sessions.account_key = $1
            AND sessions.product_key = $2
            AND sessions.revoked_at IS NULL
            AND sessions.expires_at > now()
          GROUP BY users.role
          ORDER BY users.role`,
        [config.accountKey, config.productKey],
      ),
      pool.query(`SELECT max(id) AS latest FROM onetime.schema_migrations`),
    ]);
  return {
    account_users_by_role_status: users.rows.map((row) => ({
      role: String(row.role),
      status: String(row.status),
      count: Number(row.count ?? 0),
    })),
    household_count: Number(households.rows[0]?.count ?? 0),
    learner_count: Number(learners.rows[0]?.count ?? 0),
    student_access_by_status: access.rows.map((row) => ({
      status: String(row.status),
      count: Number(row.count ?? 0),
    })),
    lifecycle_tokens_by_type_state: tokens.rows.map((row) => ({
      token_type: String(row.token_type),
      token_state: String(row.token_state),
      count: Number(row.count ?? 0),
    })),
    lifecycle_outbox_by_state: outbox.rows.map((row) => ({
      state: String(row.state),
      count: Number(row.count ?? 0),
    })),
    active_sessions_by_role: sessions.rows.map((row) => ({
      role: String(row.role),
      count: Number(row.count ?? 0),
    })),
    latest_migration: migration.rows[0]?.latest ? String(migration.rows[0].latest) : null,
  };
}

async function candidateSummary(
  pool: DbPool,
  config: AppConfig,
  manifest: Manifest,
): Promise<Candidate[]> {
  const candidates: Candidate[] = [];
  for (const role of ['administrator', 'parent', 'student'] as const) {
    const destination = manifest.recipients[role].destination;
    if (!destination) {
      candidates.push({
        role,
        destination_ref: 'missing',
        user_present: false,
        user_role: null,
        user_status: null,
      });
      continue;
    }
    const email = normalizeEmail(destination);
    const user = await findUserByEmail(pool, config, email);
    candidates.push({
      role,
      destination_ref: digestRef('email', email),
      user_present: Boolean(user),
      user_role: user?.role ?? null,
      user_status: user?.status ?? null,
    });
  }
  return candidates;
}

async function dryRunPlan(
  pool: DbPool,
  config: AppConfig,
  manifest: Manifest,
): Promise<RoleResult[]> {
  const ownerAdmin = await discoverOwnerAdminActor(pool, config);
  const parentUser = await findUserByEmail(
    pool,
    config,
    normalizeEmail(required(manifest.recipients.parent.destination, 'parent.destination')),
  );
  const studentUser = await findUserByEmail(
    pool,
    config,
    normalizeEmail(required(manifest.recipients.student.destination, 'student.destination')),
  );
  const administrator = await planAdministrator(pool, config, manifest, ownerAdmin);
  const parent = await planParent(pool, config, manifest, ownerAdmin);
  const student =
    parentUser?.status === 'active'
      ? await planStudent(pool, config, manifest, parentUser)
      : {
          role: 'student' as const,
          operation: studentUser
            ? 'student_reset_after_parent_acceptance'
            : 'student_setup_after_parent_acceptance',
          status: 'planned' as const,
          reason_code: null,
          destination_ref: digestRef(
            'email',
            normalizeEmail(
              required(manifest.recipients.student.destination, 'student.destination'),
            ),
          ),
        };
  return [administrator, parent, student];
}

async function applyMode(
  pool: DbPool,
  config: AppConfig,
  manifest: Manifest,
  mode: Exclude<Mode, 'counts' | 'dry-run'>,
  now: Date,
) {
  if (mode === 'apply-initial') return applyInitial(pool, config, manifest, now);
  if (mode === 'apply-student') return applyStudent(pool, config, manifest, now);
  return applyFinalReset(pool, config, manifest, now);
}

async function applyInitial(pool: DbPool, config: AppConfig, manifest: Manifest, now: Date) {
  const roles: RoleResult[] = [];
  const links: SanitizedLink[] = [];
  await ensureOperatorFoundation(pool, config, manifest, now);
  const ownerAdmin = await discoverOwnerAdminActor(pool, config);
  if (!ownerAdmin) throw new Error('active_owner_admin_actor_missing');
  const admin = await issueAdministrator(pool, config, manifest, ownerAdmin, now, 'initial');
  roles.push(admin.role);
  if (admin.link) links.push(admin.link);
  const parent = await issueParent(pool, config, manifest, ownerAdmin, now, 'initial');
  roles.push(parent.role);
  if (parent.link) links.push(parent.link);
  roles.push({
    role: 'student',
    operation: 'deferred_until_parent_acceptance',
    status: 'planned',
    reason_code: null,
    destination_ref: digestRef(
      'email',
      normalizeEmail(required(manifest.recipients.student.destination, 'student.destination')),
    ),
  });
  return { roles, links, foundation: true };
}

async function applyStudent(pool: DbPool, config: AppConfig, manifest: Manifest, now: Date) {
  await ensureOperatorFoundation(pool, config, manifest, now);
  const parent = await findUserByEmail(
    pool,
    config,
    normalizeEmail(required(manifest.recipients.parent.destination, 'parent.destination')),
  );
  if (!parent || parent.role !== 'parent' || parent.status !== 'active') {
    throw new Error('active_parent_required_for_student_setup');
  }
  const issued = await issueStudent(pool, config, manifest, parent, now, 'student');
  return { roles: [issued.role], links: issued.link ? [issued.link] : [], foundation: true };
}

async function applyFinalReset(pool: DbPool, config: AppConfig, manifest: Manifest, now: Date) {
  const roles: RoleResult[] = [];
  const links: SanitizedLink[] = [];
  const sessionsRevoked: Record<Role, number> = {
    administrator: 0,
    parent: 0,
    student: 0,
  };
  for (const role of ['administrator', 'parent', 'student'] as const) {
    const user = await findUserByEmail(
      pool,
      config,
      normalizeEmail(required(manifest.recipients[role].destination, `${role}.destination`)),
    );
    if (user?.userKey) {
      const activeBefore = await activeSessionCount(pool, config, user.userKey);
      await revokeUserSessions({
        pool,
        config,
        userKey: user.userKey,
        reason: `${RUN_ID}:final_reset`,
      });
      const activeAfter = await activeSessionCount(pool, config, user.userKey);
      sessionsRevoked[role] = Math.max(0, activeBefore - activeAfter);
    }
  }
  const ownerAdmin = await discoverOwnerAdminActor(pool, config);
  if (!ownerAdmin) throw new Error('active_owner_admin_actor_missing');
  const admin = await issueAdministrator(pool, config, manifest, ownerAdmin, now, 'final');
  roles.push({ ...admin.role, sessions_revoked: sessionsRevoked.administrator });
  if (admin.link) links.push(admin.link);
  const parent = await issueParent(pool, config, manifest, ownerAdmin, now, 'final');
  roles.push({ ...parent.role, sessions_revoked: sessionsRevoked.parent });
  if (parent.link) links.push(parent.link);
  const parentUser = await findUserByEmail(
    pool,
    config,
    normalizeEmail(required(manifest.recipients.parent.destination, 'parent.destination')),
  );
  if (!parentUser || parentUser.role !== 'parent' || parentUser.status !== 'active') {
    throw new Error('active_parent_required_for_student_final_reset');
  }
  const student = await issueStudent(pool, config, manifest, parentUser, now, 'final');
  roles.push({ ...student.role, sessions_revoked: sessionsRevoked.student });
  if (student.link) links.push(student.link);
  return { roles, links, foundation: false };
}

async function planAdministrator(
  pool: DbPool,
  config: AppConfig,
  manifest: Manifest,
  ownerAdmin: UserRecord | null,
): Promise<RoleResult> {
  const recipient = manifest.recipients.administrator;
  const email = normalizeEmail(required(recipient.destination, 'administrator.destination'));
  const user = await findUserByEmail(pool, config, email);
  const destination_ref = digestRef('email', email);
  if (user && !['owner', 'admin'].includes(user.role)) {
    return {
      role: 'administrator',
      operation: 'blocked',
      status: 'blocked',
      reason_code: 'role_conflict',
      destination_ref,
    };
  }
  if (user?.status && user.status !== 'active') {
    return {
      role: 'administrator',
      operation: 'blocked',
      status: 'blocked',
      reason_code: 'identity_not_active',
      destination_ref,
    };
  }
  if (user)
    return {
      role: 'administrator',
      operation: 'password_reset',
      status: 'planned',
      reason_code: null,
      destination_ref,
    };
  if (!ownerAdmin)
    return {
      role: 'administrator',
      operation: 'blocked',
      status: 'blocked',
      reason_code: 'active_owner_admin_actor_missing',
      destination_ref,
    };
  if (!recipient.display_name) {
    return {
      role: 'administrator',
      operation: 'blocked',
      status: 'blocked',
      reason_code: 'display_name_missing',
      destination_ref,
    };
  }
  return {
    role: 'administrator',
    operation: 'owner_admin_invitation',
    status: 'planned',
    reason_code: null,
    destination_ref,
  };
}

async function planParent(
  pool: DbPool,
  config: AppConfig,
  manifest: Manifest,
  ownerAdmin: UserRecord | null,
): Promise<RoleResult> {
  const recipient = manifest.recipients.parent;
  const email = normalizeEmail(required(recipient.destination, 'parent.destination'));
  const user = await findUserByEmail(pool, config, email);
  const destination_ref = digestRef('email', email);
  if (user && user.role !== 'parent') {
    return {
      role: 'parent',
      operation: 'blocked',
      status: 'blocked',
      reason_code: 'role_conflict',
      destination_ref,
    };
  }
  if (user?.status && user.status !== 'active') {
    return {
      role: 'parent',
      operation: 'blocked',
      status: 'blocked',
      reason_code: 'identity_not_active',
      destination_ref,
    };
  }
  if (user)
    return {
      role: 'parent',
      operation: 'password_reset',
      status: 'planned',
      reason_code: null,
      destination_ref,
    };
  if (!ownerAdmin)
    return {
      role: 'parent',
      operation: 'blocked',
      status: 'blocked',
      reason_code: 'active_owner_admin_actor_missing',
      destination_ref,
    };
  for (const key of ['display_name', 'household_key', 'relationship_key'] as const) {
    if (!recipient[key])
      return {
        role: 'parent',
        operation: 'blocked',
        status: 'blocked',
        reason_code: `${key}_missing`,
        destination_ref,
      };
  }
  return {
    role: 'parent',
    operation: 'parent_activation',
    status: 'planned',
    reason_code: null,
    destination_ref,
  };
}

async function planStudent(
  pool: DbPool,
  config: AppConfig,
  manifest: Manifest,
  parent: UserRecord,
): Promise<RoleResult> {
  const recipient = manifest.recipients.student;
  const email = normalizeEmail(required(recipient.destination, 'student.destination'));
  const user = await findUserByEmail(pool, config, email);
  const destination_ref = digestRef('email', email);
  if (user && user.role !== 'student') {
    return {
      role: 'student',
      operation: 'blocked',
      status: 'blocked',
      reason_code: 'role_conflict',
      destination_ref,
    };
  }
  if (user?.status && user.status !== 'active') {
    return {
      role: 'student',
      operation: 'blocked',
      status: 'blocked',
      reason_code: 'identity_not_active',
      destination_ref,
    };
  }
  if (parent.role !== 'parent' || parent.status !== 'active') {
    return {
      role: 'student',
      operation: 'blocked',
      status: 'blocked',
      reason_code: 'active_parent_required',
      destination_ref,
    };
  }
  return {
    role: 'student',
    operation: user ? 'student_reset' : 'student_setup',
    status: 'planned',
    reason_code: null,
    destination_ref,
  };
}

async function issueAdministrator(
  pool: DbPool,
  config: AppConfig,
  manifest: Manifest,
  ownerAdmin: UserRecord,
  now: Date,
  phase: 'initial' | 'final',
) {
  const recipient = manifest.recipients.administrator;
  const email = normalizeEmail(required(recipient.destination, 'administrator.destination'));
  const user = await findUserByEmail(pool, config, email);
  if (user && !['owner', 'admin'].includes(user.role))
    throw new Error('administrator_role_conflict');
  const destination_ref = digestRef('email', email);
  if (user?.status === 'active') {
    const issued = await requestPasswordReset({
      pool,
      config,
      payload: { idempotency_key: idempotencyKey('administrator', 'password_reset', phase), email },
      now,
      includeLocalProofToken: true,
    });
    if (!('token_key' in issued) || !issued.token_for_local_proof)
      throw new Error('administrator_reset_token_not_issued');
    return issuedPair('administrator', 'password_reset', destination_ref, issued);
  }
  const issued = await createOwnerAdminInvitation({
    pool,
    config,
    actor: { userKey: ownerAdmin.userKey, role: ownerAdmin.role },
    payload: {
      idempotency_key: idempotencyKey('administrator', 'owner_admin_invitation', phase),
      email,
      display_name: required(recipient.display_name, 'administrator.display_name'),
      role: 'admin',
    },
    now,
    includeLocalProofToken: true,
  });
  return issuedPair('administrator', 'owner_admin_invitation', destination_ref, issued);
}

async function issueParent(
  pool: DbPool,
  config: AppConfig,
  manifest: Manifest,
  ownerAdmin: UserRecord,
  now: Date,
  phase: 'initial' | 'final',
) {
  const recipient = manifest.recipients.parent;
  const email = normalizeEmail(required(recipient.destination, 'parent.destination'));
  const user = await findUserByEmail(pool, config, email);
  if (user && user.role !== 'parent') throw new Error('parent_role_conflict');
  const destination_ref = digestRef('email', email);
  if (user?.status === 'active') {
    const issued = await requestPasswordReset({
      pool,
      config,
      payload: { idempotency_key: idempotencyKey('parent', 'password_reset', phase), email },
      now,
      includeLocalProofToken: true,
    });
    if (!('token_key' in issued) || !issued.token_for_local_proof)
      throw new Error('parent_reset_token_not_issued');
    return issuedPair('parent', 'password_reset', destination_ref, issued);
  }
  const issued = await createParentActivation({
    pool,
    config,
    actor: { userKey: ownerAdmin.userKey, role: ownerAdmin.role },
    payload: {
      idempotency_key: idempotencyKey('parent', 'parent_activation', phase),
      email,
      display_name: required(recipient.display_name, 'parent.display_name'),
      household_key: required(recipient.household_key, 'parent.household_key'),
      relationship_key: required(recipient.relationship_key, 'parent.relationship_key'),
      relationship_label: recipient.relationship_label ?? 'Parent',
      authority: recipient.authority ?? 'primary_guardian',
    },
    now,
    includeLocalProofToken: true,
  });
  return issuedPair('parent', 'parent_activation', destination_ref, issued);
}

async function issueStudent(
  pool: DbPool,
  config: AppConfig,
  manifest: Manifest,
  parent: UserRecord,
  now: Date,
  phase: 'student' | 'final',
) {
  const recipient = manifest.recipients.student;
  const email = normalizeEmail(required(recipient.destination, 'student.destination'));
  const user = await findUserByEmail(pool, config, email);
  const destination_ref = digestRef('email', email);
  if (user && user.role !== 'student') throw new Error('student_role_conflict');
  if (user?.status === 'active') {
    const issued = await createStudentReset({
      pool,
      config,
      actor: { userKey: parent.userKey, role: 'parent' },
      payload: {
        idempotency_key: idempotencyKey('student', 'student_reset', phase),
        learner_key: required(recipient.learner_key, 'student.learner_key'),
        email,
      },
      now,
      includeLocalProofToken: true,
    });
    return issuedPair('student', 'student_reset', destination_ref, issued);
  }
  const issued = await createStudentSetup({
    pool,
    config,
    actor: { userKey: parent.userKey, role: 'parent' },
    payload: {
      idempotency_key: idempotencyKey('student', 'student_setup', phase),
      household_key: required(recipient.household_key, 'student.household_key'),
      learner_key: required(recipient.learner_key, 'student.learner_key'),
      email,
      display_name:
        recipient.learner_display_identity ??
        required(recipient.display_name, 'student.display_name'),
    },
    now,
    includeLocalProofToken: true,
  });
  return issuedPair('student', 'student_setup', destination_ref, issued);
}

function issuedPair(
  role: Role,
  purpose: LinkPurpose,
  destinationRef: string,
  issued: {
    token_key: string;
    token_type: string;
    expires_at: string;
    delivery: { delivery_state: string };
    token_ref: string;
    token_for_local_proof?: string;
  },
) {
  if (!issued.token_for_local_proof) throw new Error(`${role}_${purpose}_local_proof_missing`);
  return {
    role: {
      role,
      operation: purpose,
      status: 'applied' as const,
      reason_code: null,
      destination_ref: destinationRef,
      token_ref: issued.token_ref,
      delivery_state: issued.delivery.delivery_state,
    },
    link: {
      role,
      purpose,
      token_ref: issued.token_ref,
      expires_at: issued.expires_at,
      url: lifecycleUrl(purpose, issued.token_for_local_proof),
    },
  };
}

async function ensureOperatorFoundation(
  pool: DbPool,
  config: AppConfig,
  manifest: Manifest,
  now: Date,
) {
  const parent = manifest.recipients.parent;
  const student = manifest.recipients.student;
  const householdKey = required(parent.household_key, 'parent.household_key');
  const learnerKey = required(student.learner_key, 'student.learner_key');
  await inTransaction(pool, async (client) => {
    await client.query(
      `INSERT INTO onetime.portal_households
         (household_key, account_key, product_key, display_name, status, created_at, updated_at)
       VALUES ($1,$2,$3,$4,'active',$5,$5)
       ON CONFLICT (account_key, product_key, household_key)
       DO UPDATE SET status = 'active', updated_at = EXCLUDED.updated_at`,
      [householdKey, config.accountKey, config.productKey, 'Operator Test Household W13-103', now],
    );
    await client.query(
      `INSERT INTO onetime.portal_learners
         (learner_key, account_key, product_key, household_key, display_name, hebrew_name,
          grade_label, learner_status, created_at, updated_at)
       VALUES ($1,$2,$3,$4,$5,NULL,$6,'active',$7,$7)
       ON CONFLICT (account_key, product_key, learner_key)
       DO UPDATE SET learner_status = 'active', updated_at = EXCLUDED.updated_at`,
      [
        learnerKey,
        config.accountKey,
        config.productKey,
        householdKey,
        student.learner_display_identity ?? student.display_name ?? 'Operator Test Learner W13-103',
        student.grade_label ?? 'Operator test',
        now,
      ],
    );
    await client
      .query(
        `SELECT access_state_key, household_key, status
           FROM onetime.portal_student_access_state
          WHERE account_key = $1
            AND product_key = $2
            AND learner_key = $3
          LIMIT 1`,
        [config.accountKey, config.productKey, learnerKey],
      )
      .then((result) => {
        const existing = result.rows[0] as Record<string, unknown> | undefined;
        if (!existing) return;
        const expectedAccessStateKey = stableKey('w13_103_student_access', [
          config.accountKey,
          config.productKey,
          learnerKey,
        ]);
        if (
          existing.access_state_key !== expectedAccessStateKey ||
          existing.household_key !== householdKey
        ) {
          throw new Error('student_access_state_conflict');
        }
      });
    await client.query(
      `INSERT INTO onetime.portal_student_access_state
         (access_state_key, account_key, product_key, household_key, learner_key, status,
          created_at, updated_at)
       VALUES ($1,$2,$3,$4,$5,'not_configured',$6,$6)
       ON CONFLICT (access_state_key)
       DO NOTHING`,
      [
        stableKey('w13_103_student_access', [config.accountKey, config.productKey, learnerKey]),
        config.accountKey,
        config.productKey,
        householdKey,
        learnerKey,
        now,
      ],
    );
    await client.query(
      `INSERT INTO onetime.portal_audit_actions
         (audit_key, account_key, product_key, actor_user_ref, actor_role, household_key,
          learner_key, action_type, metadata, created_at)
       VALUES ($1,$2,$3,$4,'admin',$5,$6,'w13_103_operator_test_foundation_ready',$7::jsonb,$8)
       ON CONFLICT (audit_key) DO NOTHING`,
      [
        stableKey('portal_audit', [config.accountKey, config.productKey, RUN_ID, 'foundation']),
        config.accountKey,
        config.productKey,
        'w13_103_production_role_access_task',
        householdKey,
        learnerKey,
        JSON.stringify({
          run_id: RUN_ID,
          operator_test_data: true,
          excluded_from_billing_campaigns_imports_and_provider_delivery: true,
        }),
        now,
      ],
    );
  });
}

type UserRecord = {
  userKey: string;
  role: 'owner' | 'admin' | 'parent' | 'student';
  status: string;
};

async function findUserByEmail(
  pool: DbPool,
  config: AppConfig,
  email: string,
): Promise<UserRecord | null> {
  const result = await pool.query(
    `SELECT user_key, role, status
       FROM onetime.account_users
      WHERE account_key = $1 AND product_key = $2 AND email_normalized = $3
      LIMIT 1`,
    [config.accountKey, config.productKey, email],
  );
  const row = result.rows[0] as Record<string, unknown> | undefined;
  if (!row) return null;
  return {
    userKey: String(row.user_key),
    role: String(row.role) as UserRecord['role'],
    status: String(row.status),
  };
}

async function discoverOwnerAdminActor(
  pool: DbPool,
  config: AppConfig,
): Promise<UserRecord | null> {
  const result = await pool.query(
    `SELECT user_key, role, status
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
  return {
    userKey: String(row.user_key),
    role: String(row.role) as UserRecord['role'],
    status: String(row.status),
  };
}

async function activeSessionCount(pool: DbPool, config: AppConfig, userKey: string) {
  const result = await pool.query(
    `SELECT count(*)::int AS count
       FROM onetime.user_sessions
      WHERE account_key = $1
        AND product_key = $2
        AND user_key = $3
        AND revoked_at IS NULL
        AND expires_at > now()`,
    [config.accountKey, config.productKey, userKey],
  );
  return Number(result.rows[0]?.count ?? 0);
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

function baseReport(
  mode: Mode,
  now: Date,
  manifest: Manifest,
  counts: Counts,
  candidates: Candidate[],
  result: {
    status: string;
    blockers: string[];
    roles?: RoleResult[] | undefined;
  },
) {
  return {
    schema: 'onetime.w13_103.production_role_access_task.v1',
    generated_at: now.toISOString(),
    run_id: RUN_ID,
    mode,
    status: result.status,
    blockers: result.blockers,
    runtime_source_sha: EXPECTED_RUNTIME_SHA,
    railway: {
      project_id: manifest.railway.project_id,
      environment_id: manifest.railway.environment_id,
      web_service_id: manifest.railway.web_service_id,
      task_service_id: process.env.RAILWAY_SERVICE_ID
        ? digestRef('railway_service', process.env.RAILWAY_SERVICE_ID)
        : null,
    },
    counts_before: counts,
    candidates,
    roles: result.roles ?? [],
    safety: {
      raw_tokens_printed: false,
      raw_urls_printed: false,
      secrets_printed: false,
      pii_printed: false,
      external_sends: 0,
      rabbi_contacted: false,
    },
  };
}

function mutationDeltas(before: Counts, after: Counts, applied: ApplyResult) {
  return {
    account_users_delta: totalUsers(after) - totalUsers(before),
    household_delta: after.household_count - before.household_count,
    learner_delta: after.learner_count - before.learner_count,
    lifecycle_token_delta: totalTokenRows(after) - totalTokenRows(before),
    lifecycle_outbox_delta: totalOutboxRows(after) - totalOutboxRows(before),
    private_handoff_links: applied.links.length,
    external_sends: 0,
    foundation_checked: Boolean(applied.foundation),
  };
}

function totalUsers(counts: Counts) {
  return counts.account_users_by_role_status.reduce((sum, row) => sum + row.count, 0);
}

function totalTokenRows(counts: Counts) {
  return counts.lifecycle_tokens_by_type_state.reduce((sum, row) => sum + row.count, 0);
}

function totalOutboxRows(counts: Counts) {
  return counts.lifecycle_outbox_by_state.reduce((sum, row) => sum + row.count, 0);
}

function encryptHandoff(keyB64: string, payload: unknown) {
  const key = Buffer.from(keyB64, 'base64url');
  if (key.length !== 32) throw new Error('handoff_encryption_key_invalid_length');
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const ciphertext = Buffer.concat([
    cipher.update(JSON.stringify(payload), 'utf8'),
    cipher.final(),
  ]);
  return {
    alg: 'A256GCM',
    iv: iv.toString('base64url'),
    tag: cipher.getAuthTag().toString('base64url'),
    ciphertext: ciphertext.toString('base64url'),
  };
}

function lifecycleUrl(purpose: LinkPurpose, token: string) {
  const route =
    purpose === 'password_reset' || purpose === 'student_reset' ? '/reset-password' : '/activate';
  return `https://join.onetimeonetime.com${route}#token=${encodeURIComponent(token)}`;
}

function idempotencyKey(role: Role, purpose: string, phase: string) {
  return `w13-103-${phase}-${role}-${purpose}`;
}

function required(value: string | undefined, label: string) {
  if (!value) throw new Error(`${label}_missing`);
  return value;
}

function digestRef(kind: string, value: string) {
  return `${kind}:${sha256(value)}`;
}

function sha256(value: string) {
  return createHash('sha256').update(value).digest('hex');
}

function sha256Equals(value: string, expectedHex: string) {
  const actual = Buffer.from(sha256(value), 'hex');
  const expected = Buffer.from(expectedHex, 'hex');
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

function parseArgs(argv: string[]) {
  const args = new Map<string, string | true>();
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (!arg?.startsWith('--')) continue;
    const key = arg.slice(2);
    if (key === 'apply') {
      args.set(key, true);
      continue;
    }
    const value = argv[index + 1];
    if (!value) throw new Error(`Missing value for --${key}`);
    args.set(key, value);
    index += 1;
  }
  return args;
}

function parseMode(value: string | true | undefined): Mode {
  if (typeof value !== 'string' || !(modes as readonly string[]).includes(value)) {
    throw new Error(`Unsupported W13-103 task mode: ${String(value)}`);
  }
  return value as Mode;
}

function isCliEntrypoint() {
  return process.argv[1] ? import.meta.url === pathToFileURL(process.argv[1]).href : false;
}

if (isCliEntrypoint()) {
  const args = parseArgs(process.argv.slice(2));
  const report = await runW13ProductionRoleAccessTask({
    mode: parseMode(args.get('mode') ?? process.env.W13_103_TASK_MODE),
    authorizationPhrase: process.env.W13_103_PRODUCTION_ROLE_ACCESS_AUTHORIZATION,
    handoffEncryptionKey: process.env.W13_103_HANDOFF_ENCRYPTION_KEY_B64,
  });
  const output = `${JSON.stringify(report, null, 2)}\n`;
  if (typeof args.get('out') === 'string') await writeFile(String(args.get('out')), output, 'utf8');
  process.stdout.write(output);
  if (report.status === 'blocked') process.exitCode = 2;
}
