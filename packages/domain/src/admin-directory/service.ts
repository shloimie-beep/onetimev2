import { createHash, randomUUID } from 'node:crypto';
import { z } from 'zod';
import type { AppConfig } from '../../../config/src/index.ts';
import type { DbPool, Queryable } from '../../../db/src/index.ts';
import { inTransaction } from '../../../db/src/index.ts';
import {
  createOwnerAdminInvitation,
  createStudentSetup,
  issueParentActivationWithClient,
  requestPasswordReset,
} from '../accounts/lifecycle.ts';
import {
  ContactOperationsError,
  requestStudentResetForHousehold,
} from '../contact-operations/service.ts';
import { normalizeEmail } from '../lead/normalize.ts';

const MAX_ACTIVE_LEARNERS = 3;

const opaqueKeySchema = z.string().trim().min(3).max(180);
const displayNameSchema = z.string().trim().min(2).max(180);
const optionalLabelSchema = z
  .string()
  .trim()
  .max(180)
  .nullable()
  .optional()
  .transform((value) => value || null);
const idempotencyKeySchema = z.string().trim().min(8).max(160);
const versionSchema = z.coerce.number().int().positive();

export const adminDirectoryListQuerySchema = z
  .object({
    search: z.string().trim().max(120).optional().default(''),
    status: z.string().trim().max(40).optional().default(''),
  })
  .strict();

export const createHouseholdPayloadSchema = z
  .object({
    display_name: displayNameSchema,
    idempotency_key: idempotencyKeySchema,
  })
  .strict();

export const updateHouseholdPayloadSchema = z
  .object({
    display_name: displayNameSchema,
    version: versionSchema,
  })
  .strict();

export const versionPayloadSchema = z.object({ version: versionSchema }).strict();

export const attachGuardianPayloadSchema = z
  .object({
    user_key: opaqueKeySchema,
    relationship_label: z.string().trim().min(1).max(80).default('Parent'),
    authority: z.enum(['primary_guardian', 'guardian', 'support_only']).default('guardian'),
  })
  .strict();

export const inviteUserPayloadSchema = z
  .object({
    display_name: displayNameSchema,
    email: z.string().trim().email().max(254),
    role: z.enum(['admin', 'rabbi', 'parent']),
    household_key: opaqueKeySchema.optional(),
    relationship_label: z.string().trim().min(1).max(80).default('Parent'),
    authority: z.enum(['primary_guardian', 'guardian']).default('guardian'),
    idempotency_key: idempotencyKeySchema,
  })
  .strict()
  .superRefine((payload, ctx) => {
    if (payload.role === 'parent' && !payload.household_key) {
      ctx.addIssue({
        code: 'custom',
        path: ['household_key'],
        message: 'Choose a household for a Parent account.',
      });
    }
    if (payload.role !== 'parent' && payload.household_key) {
      ctx.addIssue({
        code: 'custom',
        path: ['household_key'],
        message: 'Staff accounts are not attached to a household.',
      });
    }
  });

export const updateUserPayloadSchema = z
  .object({
    display_name: displayNameSchema,
    role: z.enum(['admin', 'rabbi', 'parent']),
    version: versionSchema,
  })
  .strict();

export const createLearnerPayloadSchema = z
  .object({
    household_key: opaqueKeySchema,
    display_name: displayNameSchema,
    hebrew_name: optionalLabelSchema,
    grade_label: optionalLabelSchema,
    idempotency_key: idempotencyKeySchema,
  })
  .strict();

export const updateLearnerPayloadSchema = z
  .object({
    display_name: displayNameSchema,
    hebrew_name: optionalLabelSchema,
    grade_label: optionalLabelSchema,
    version: versionSchema,
  })
  .strict();

export const studentSetupPayloadSchema = z
  .object({
    email: z.string().trim().email().max(254),
    idempotency_key: idempotencyKeySchema,
  })
  .strict();

export const passwordResetPayloadSchema = z
  .object({ idempotency_key: idempotencyKeySchema })
  .strict();

export type AdminDirectoryActor = {
  userKey: string;
  role: string;
};

export type AdminHousehold = {
  household_key: string;
  display_name: string;
  status: 'active' | 'archived';
  version: number;
  active_learner_count: number;
  learner_count: number;
  guardian_count: number;
  access_state: string;
  setup_state: string;
  updated_at: string;
};

export type AdminUser = {
  user_key: string;
  display_name: string;
  email: string;
  role: string;
  status: 'active' | 'disabled' | 'pending_setup' | 'expired_setup';
  version: number;
  household_key: string | null;
  household_name: string | null;
  relationship_label: string | null;
  last_successful_login_at: string | null;
  setup_expires_at: string | null;
  learner_key: string | null;
};

export type AdminLearner = {
  learner_key: string;
  household_key: string;
  household_name: string;
  display_name: string;
  hebrew_name: string | null;
  grade_label: string | null;
  learner_status: 'active' | 'archived' | 'suspended';
  version: number;
  student_access_status: string;
  student_user_ref: string | null;
  enrollment_count: number;
  updated_at: string;
};

export type AdminAuditEvent = {
  event_key: string;
  action: string;
  actor_user_key: string | null;
  actor_label: string;
  actor_role: string;
  subject_type: 'household' | 'learner' | 'contact' | 'system';
  subject_key: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
};

export type AdminDirectoryErrorCode =
  | 'DUPLICATE'
  | 'FORBIDDEN'
  | 'IDENTITY_CONFLICT'
  | 'IDEMPOTENCY_CONFLICT'
  | 'LEARNER_LIMIT_REACHED'
  | 'NOT_FOUND'
  | 'VERSION_CONFLICT';

export class AdminDirectoryError extends Error {
  constructor(
    readonly code: AdminDirectoryErrorCode,
    message: string,
    readonly currentVersion?: number,
  ) {
    super(message);
  }
}

export async function listAdminAuditHistory(input: {
  pool: DbPool;
  config: AppConfig;
  query?: unknown;
}): Promise<AdminAuditEvent[]> {
  const query = adminDirectoryListQuerySchema.parse(input.query ?? {});
  const [portal, crm, users] = await Promise.all([
    input.pool.query(
      `SELECT audit_key, actor_user_ref, actor_role, household_key, learner_key,
              action_type, metadata, created_at
         FROM onetime.portal_audit_actions
        WHERE account_key = $1 AND product_key = $2
        ORDER BY created_at DESC
        LIMIT 100`,
      [input.config.accountKey, input.config.productKey],
    ),
    input.pool.query(
      `SELECT event_key, contact_key, event_type, metadata, created_at
         FROM onetime.audit_events
        WHERE account_key = $1 AND product_key = $2
        ORDER BY created_at DESC
        LIMIT 100`,
      [input.config.accountKey, input.config.productKey],
    ),
    input.pool.query(
      `SELECT user_key, display_name, role
         FROM onetime.account_users
        WHERE account_key = $1 AND product_key = $2`,
      [input.config.accountKey, input.config.productKey],
    ),
  ]);
  const userByKey = new Map(
    users.rows.map((row) => [
      String(row.user_key),
      { label: String(row.display_name), role: String(row.role) },
    ]),
  );
  const events: AdminAuditEvent[] = [
    ...portal.rows.map((row) => {
      const actorKey = String(row.actor_user_ref);
      const actor = userByKey.get(actorKey);
      const learnerKey = nullableString(row.learner_key);
      const householdKey = nullableString(row.household_key);
      return {
        event_key: String(row.audit_key),
        action: String(row.action_type),
        actor_user_key: actorKey,
        actor_label: actor?.label ?? 'Former user',
        actor_role: actor?.role ?? String(row.actor_role),
        subject_type: (learnerKey
          ? 'learner'
          : householdKey
            ? 'household'
            : 'system') as AdminAuditEvent['subject_type'],
        subject_key: learnerKey ?? householdKey,
        metadata: recordValue(row.metadata),
        created_at: toIso(row.created_at),
      };
    }),
    ...crm.rows.map((row) => {
      const metadata = recordValue(row.metadata);
      const actorKey = typeof metadata.actor_user_key === 'string' ? metadata.actor_user_key : null;
      const actor = actorKey ? userByKey.get(actorKey) : undefined;
      return {
        event_key: String(row.event_key),
        action: String(row.event_type),
        actor_user_key: actorKey,
        actor_label: actor?.label ?? (actorKey ? 'Former user' : 'System'),
        actor_role: actor?.role ?? 'system',
        subject_type: (row.contact_key ? 'contact' : 'system') as AdminAuditEvent['subject_type'],
        subject_key: nullableString(row.contact_key),
        metadata,
        created_at: toIso(row.created_at),
      };
    }),
  ];
  const search = query.search.toLowerCase();
  return events
    .filter(
      (event) =>
        !search ||
        [event.action, event.actor_label, event.actor_role, event.subject_type, event.subject_key]
          .filter(Boolean)
          .some((value) => String(value).toLowerCase().includes(search)),
    )
    .sort((left, right) => right.created_at.localeCompare(left.created_at))
    .slice(0, 100);
}

export async function listAdminHouseholds(input: {
  pool: DbPool;
  config: AppConfig;
  query?: unknown;
}): Promise<AdminHousehold[]> {
  const query = adminDirectoryListQuerySchema.parse(input.query ?? {});
  const params: unknown[] = [input.config.accountKey, input.config.productKey];
  const where = [
    'households.account_key = $1',
    'households.product_key = $2',
    `households.household_key NOT LIKE 'live_demo_household_%'`,
    `households.household_key NOT LIKE 'full_app_preview_%'`,
  ];
  if (query.search) {
    params.push(`%${query.search.toLowerCase()}%`);
    where.push(`lower(households.display_name) LIKE $${params.length}`);
  }
  if (query.status === 'active' || query.status === 'archived') {
    params.push(query.status);
    where.push(`households.status = $${params.length}`);
  }
  const result = await input.pool.query(
    `SELECT households.household_key,
            households.display_name,
            households.status,
            households.version,
            households.updated_at
       FROM onetime.portal_households AS households
      WHERE ${where.join(' AND ')}
      ORDER BY households.updated_at DESC, households.household_key`,
    params,
  );
  const [learnerCounts, guardianCounts, accessRows, setupTokens, activeGuardians] =
    await Promise.all([
      input.pool.query(
        `SELECT household_key, count(*)::int AS learner_count,
                count(*) FILTER (WHERE learner_status = 'active')::int AS active_learner_count
           FROM onetime.portal_learners
          WHERE account_key = $1 AND product_key = $2
          GROUP BY household_key`,
        [input.config.accountKey, input.config.productKey],
      ),
      input.pool.query(
        `SELECT household_key, count(*)::int AS guardian_count
           FROM onetime.portal_guardian_relationships
          WHERE account_key = $1 AND product_key = $2 AND status = 'active'
          GROUP BY household_key`,
        [input.config.accountKey, input.config.productKey],
      ),
      input.pool.query(
        `SELECT household_key, state, updated_at
           FROM onetime.account_access_projections
          WHERE account_key = $1 AND product_key = $2
          ORDER BY updated_at DESC`,
        [input.config.accountKey, input.config.productKey],
      ),
      input.pool.query(
        `SELECT household_key, expires_at, consumed_at, revoked_at
           FROM onetime.account_lifecycle_tokens
          WHERE account_key = $1 AND product_key = $2 AND target_role = 'parent'
            AND household_key IS NOT NULL`,
        [input.config.accountKey, input.config.productKey],
      ),
      input.pool.query(
        `SELECT guardians.household_key
           FROM onetime.portal_guardian_relationships AS guardians
           JOIN onetime.account_users AS users
             ON users.account_key = guardians.account_key
            AND users.product_key = guardians.product_key
            AND users.user_key = guardians.guardian_user_ref
          WHERE guardians.account_key = $1 AND guardians.product_key = $2
            AND guardians.status = 'active' AND users.status = 'active'
          GROUP BY guardians.household_key`,
        [input.config.accountKey, input.config.productKey],
      ),
    ]);
  const learnerByHousehold = new Map(
    learnerCounts.rows.map((row) => [String(row.household_key), row]),
  );
  const guardiansByHousehold = new Map(
    guardianCounts.rows.map((row) => [String(row.household_key), row]),
  );
  const accessByHousehold = new Map<string, Record<string, unknown>>();
  for (const row of accessRows.rows) {
    const key = String(row.household_key);
    if (!accessByHousehold.has(key)) accessByHousehold.set(key, row);
  }
  const activeGuardianHouseholds = new Set(
    activeGuardians.rows.map((row) => String(row.household_key)),
  );
  const setupByHousehold = new Map<string, 'pending_setup' | 'expired_setup'>();
  for (const row of setupTokens.rows) {
    const key = String(row.household_key);
    const pending =
      !row.consumed_at &&
      !row.revoked_at &&
      new Date(String(row.expires_at)).getTime() > Date.now();
    if (pending || !setupByHousehold.has(key)) {
      setupByHousehold.set(key, pending ? 'pending_setup' : 'expired_setup');
    }
  }
  return result.rows.map((row) => {
    const key = String(row.household_key);
    const learner = learnerByHousehold.get(key);
    const guardian = guardiansByHousehold.get(key);
    return mapHousehold({
      ...row,
      learner_count: learner?.learner_count ?? 0,
      active_learner_count: learner?.active_learner_count ?? 0,
      guardian_count: guardian?.guardian_count ?? 0,
      access_state: accessByHousehold.get(key)?.state ?? 'pending',
      setup_state: activeGuardianHouseholds.has(key)
        ? 'active'
        : (setupByHousehold.get(key) ?? 'not_started'),
    });
  });
}

export async function createAdminHousehold(input: {
  pool: DbPool;
  config: AppConfig;
  actor: AdminDirectoryActor;
  payload: unknown;
}): Promise<AdminHousehold> {
  requireOwnerAdmin(input.actor);
  const payload = createHouseholdPayloadSchema.parse(input.payload);
  return inTransaction(input.pool, async (client) => {
    const replay = await readIdempotency<AdminHousehold>(
      client,
      input.config,
      input.actor,
      'admin-directory.household.create',
      payload.idempotency_key,
      payload,
    );
    if (replay) return replay;
    await assertHouseholdNameAvailable(client, input.config, payload.display_name);
    const householdKey = `household_${randomUUID()}`;
    const result = await client.query(
      `INSERT INTO onetime.portal_households
         (household_key, account_key, product_key, display_name)
       VALUES ($1,$2,$3,$4)
       RETURNING household_key, display_name, status, version, updated_at`,
      [householdKey, input.config.accountKey, input.config.productKey, payload.display_name],
    );
    await recordAudit(client, input.config, input.actor, {
      householdKey,
      action: 'admin_household_created',
      metadata: { no_external_side_effects: true },
    });
    const household = {
      ...mapHousehold(result.rows[0] ?? {}),
      active_learner_count: 0,
      learner_count: 0,
      guardian_count: 0,
      access_state: 'pending',
      setup_state: 'not_started',
    };
    await writeIdempotency(
      client,
      input.config,
      input.actor,
      'admin-directory.household.create',
      payload.idempotency_key,
      payload,
      household,
    );
    return household;
  });
}

export function updateAdminHousehold(input: {
  pool: DbPool;
  config: AppConfig;
  actor: AdminDirectoryActor;
  householdKey: string;
  payload: unknown;
}) {
  requireOwnerAdmin(input.actor);
  const householdKey = opaqueKeySchema.parse(input.householdKey);
  const payload = updateHouseholdPayloadSchema.parse(input.payload);
  return inTransaction(input.pool, async (client) => {
    const current = await lockHousehold(client, input.config, householdKey);
    assertVersion(current, payload.version);
    await assertHouseholdNameAvailable(client, input.config, payload.display_name, householdKey);
    const result = await client.query(
      `UPDATE onetime.portal_households
          SET display_name = $4,
              version = version + 1,
              updated_at = now()
        WHERE account_key = $1 AND product_key = $2 AND household_key = $3
        RETURNING household_key, display_name, status, version, updated_at`,
      [input.config.accountKey, input.config.productKey, householdKey, payload.display_name],
    );
    await recordAudit(client, input.config, input.actor, {
      householdKey,
      action: 'admin_household_updated',
    });
    return mapHousehold(result.rows[0] ?? {});
  });
}

export function setAdminHouseholdStatus(input: {
  pool: DbPool;
  config: AppConfig;
  actor: AdminDirectoryActor;
  householdKey: string;
  status: 'active' | 'archived';
  payload: unknown;
}) {
  requireOwnerAdmin(input.actor);
  const householdKey = opaqueKeySchema.parse(input.householdKey);
  const payload = versionPayloadSchema.parse(input.payload);
  return inTransaction(input.pool, async (client) => {
    const current = await lockHousehold(client, input.config, householdKey);
    assertVersion(current, payload.version);
    if (input.status === 'archived') {
      const dependent = await client.query(
        `SELECT
           (SELECT count(*)::int FROM onetime.portal_learners
             WHERE account_key = $1 AND product_key = $2 AND household_key = $3
               AND learner_status <> 'archived') AS learner_count,
           (SELECT count(*)::int FROM onetime.portal_guardian_relationships
             WHERE account_key = $1 AND product_key = $2 AND household_key = $3
               AND status = 'active') AS guardian_count`,
        [input.config.accountKey, input.config.productKey, householdKey],
      );
      const row = dependent.rows[0] ?? {};
      if (Number(row.learner_count ?? 0) > 0 || Number(row.guardian_count ?? 0) > 0) {
        throw new AdminDirectoryError(
          'IDENTITY_CONFLICT',
          'Archive learners and revoke active guardian relationships before archiving this household.',
        );
      }
    }
    const result = await client.query(
      `UPDATE onetime.portal_households
          SET status = $4,
              version = version + 1,
              updated_at = now()
        WHERE account_key = $1 AND product_key = $2 AND household_key = $3
        RETURNING household_key, display_name, status, version, updated_at`,
      [input.config.accountKey, input.config.productKey, householdKey, input.status],
    );
    await recordAudit(client, input.config, input.actor, {
      householdKey,
      action: input.status === 'archived' ? 'admin_household_archived' : 'admin_household_restored',
      metadata: { protected_action: input.status === 'archived' },
    });
    return mapHousehold(result.rows[0] ?? {});
  });
}

export function attachAdminGuardian(input: {
  pool: DbPool;
  config: AppConfig;
  actor: AdminDirectoryActor;
  householdKey: string;
  payload: unknown;
}) {
  requireOwnerAdmin(input.actor);
  const householdKey = opaqueKeySchema.parse(input.householdKey);
  const payload = attachGuardianPayloadSchema.parse(input.payload);
  return inTransaction(input.pool, async (client) => {
    await lockHousehold(client, input.config, householdKey, true);
    const user = await client.query(
      `SELECT role, status
         FROM onetime.account_users
        WHERE account_key = $1 AND product_key = $2 AND user_key = $3
        LIMIT 1`,
      [input.config.accountKey, input.config.productKey, payload.user_key],
    );
    if (!user.rowCount) throw new AdminDirectoryError('NOT_FOUND', 'The user was not found.');
    if (String(user.rows[0]?.role) !== 'parent') {
      throw new AdminDirectoryError(
        'IDENTITY_CONFLICT',
        'Only an active Parent account can be attached as a guardian.',
      );
    }
    if (String(user.rows[0]?.status) !== 'active') {
      throw new AdminDirectoryError(
        'IDENTITY_CONFLICT',
        'Reactivate the Parent account before attaching it.',
      );
    }
    const existing = await client.query(
      `SELECT relationship_key, status
         FROM onetime.portal_guardian_relationships
        WHERE account_key = $1 AND product_key = $2 AND household_key = $3
          AND guardian_user_ref = $4
        FOR UPDATE`,
      [input.config.accountKey, input.config.productKey, householdKey, payload.user_key],
    );
    const relationshipKey = existing.rows[0]?.relationship_key
      ? String(existing.rows[0].relationship_key)
      : `guardian_${randomUUID()}`;
    if (existing.rowCount) {
      await client.query(
        `UPDATE onetime.portal_guardian_relationships
            SET relationship_label = $5,
                authority = $6,
                status = 'active',
                version = version + 1,
                updated_at = now()
          WHERE account_key = $1 AND product_key = $2 AND household_key = $3
            AND guardian_user_ref = $4`,
        [
          input.config.accountKey,
          input.config.productKey,
          householdKey,
          payload.user_key,
          payload.relationship_label,
          payload.authority,
        ],
      );
    } else {
      await client.query(
        `INSERT INTO onetime.portal_guardian_relationships
           (relationship_key, account_key, product_key, household_key, guardian_user_ref,
            relationship_label, authority)
         VALUES ($1,$2,$3,$4,$5,$6,$7)`,
        [
          relationshipKey,
          input.config.accountKey,
          input.config.productKey,
          householdKey,
          payload.user_key,
          payload.relationship_label,
          payload.authority,
        ],
      );
    }
    await recordAudit(client, input.config, input.actor, {
      householdKey,
      action: 'admin_guardian_attached',
      metadata: { guardian_user_ref: payload.user_key, authority: payload.authority },
    });
    return {
      relationship_key: relationshipKey,
      household_key: householdKey,
      user_key: payload.user_key,
      status: 'active' as const,
    };
  });
}

export async function listAdminUsers(input: {
  pool: DbPool;
  config: AppConfig;
  query?: unknown;
}): Promise<AdminUser[]> {
  const query = adminDirectoryListQuerySchema.parse(input.query ?? {});
  const params: unknown[] = [input.config.accountKey, input.config.productKey];
  const where = ['users.account_key = $1', 'users.product_key = $2'];
  if (query.search) {
    params.push(`%${query.search.toLowerCase()}%`);
    where.push(
      `(lower(users.display_name) LIKE $${params.length}
        OR lower(users.email_normalized) LIKE $${params.length})`,
    );
  }
  if (query.status === 'active' || query.status === 'disabled') {
    params.push(query.status);
    where.push(`users.status = $${params.length}`);
  }
  const users = await input.pool.query(
    `SELECT users.user_key, users.display_name, users.email_normalized, users.role,
            users.status, users.security_version,
            guardians.household_key, households.display_name AS household_name,
            guardians.relationship_label, links.learner_key,
            max(CASE WHEN auth.event_type IN (
              'login_succeeded', 'login_succeeded_trusted_device', 'student_login_succeeded'
            ) AND auth.success THEN auth.created_at END) AS last_successful_login_at
       FROM onetime.account_users AS users
       LEFT JOIN onetime.portal_guardian_relationships AS guardians
         ON guardians.account_key = users.account_key
        AND guardians.product_key = users.product_key
        AND guardians.guardian_user_ref = users.user_key
        AND guardians.status = 'active'
       LEFT JOIN onetime.portal_households AS households
         ON households.account_key = guardians.account_key
        AND households.product_key = guardians.product_key
        AND households.household_key = guardians.household_key
       LEFT JOIN onetime.account_learner_identity_links AS links
         ON links.account_key = users.account_key
        AND links.product_key = users.product_key
        AND links.user_key = users.user_key
       LEFT JOIN onetime.auth_audit_events AS auth
         ON auth.account_key = users.account_key
        AND auth.product_key = users.product_key
        AND auth.user_key = users.user_key
      WHERE ${where.join(' AND ')}
      GROUP BY users.user_key, users.display_name, users.email_normalized, users.role,
               users.status, users.security_version, guardians.household_key,
               households.display_name, guardians.relationship_label, links.learner_key
      ORDER BY users.display_name, users.user_key`,
    params,
  );
  const rows = users.rows.map(mapUser);

  if (query.status !== 'active' && query.status !== 'disabled') {
    const pendingParams: unknown[] = [input.config.accountKey, input.config.productKey];
    const pendingWhere = [
      'tokens.account_key = $1',
      'tokens.product_key = $2',
      'tokens.consumed_at IS NULL',
      'tokens.revoked_at IS NULL',
      `tokens.target_role IN ('admin', 'rabbi', 'parent')`,
    ];
    if (query.search) {
      pendingParams.push(`%${query.search.toLowerCase()}%`);
      pendingWhere.push(
        `(lower(tokens.display_name) LIKE $${pendingParams.length}
          OR lower(tokens.email_normalized) LIKE $${pendingParams.length})`,
      );
    }
    const pending = await input.pool.query(
      `SELECT DISTINCT ON (tokens.email_normalized, tokens.target_role)
              tokens.token_key, tokens.display_name, tokens.email_normalized,
              tokens.target_role, tokens.expires_at, tokens.household_key,
              households.display_name AS household_name
         FROM onetime.account_lifecycle_tokens AS tokens
         LEFT JOIN onetime.portal_households AS households
           ON households.account_key = tokens.account_key
          AND households.product_key = tokens.product_key
          AND households.household_key = tokens.household_key
        WHERE ${pendingWhere.join(' AND ')}
        ORDER BY tokens.email_normalized, tokens.target_role, tokens.created_at DESC`,
      pendingParams,
    );
    const existingEmails = await input.pool.query(
      `SELECT email_normalized
         FROM onetime.account_users
        WHERE account_key = $1 AND product_key = $2`,
      [input.config.accountKey, input.config.productKey],
    );
    const existingEmailSet = new Set(
      existingEmails.rows.map((row) => String(row.email_normalized)),
    );
    rows.push(
      ...pending.rows
        .filter((row) => !existingEmailSet.has(String(row.email_normalized)))
        .map((row) => ({
          user_key: `pending:${String(row.token_key)}`,
          display_name: String(row.display_name),
          email: String(row.email_normalized),
          role: String(row.target_role),
          status:
            new Date(String(row.expires_at)).getTime() > Date.now()
              ? ('pending_setup' as const)
              : ('expired_setup' as const),
          version: 1,
          household_key: nullableString(row.household_key),
          household_name: nullableString(row.household_name),
          relationship_label: null,
          last_successful_login_at: null,
          setup_expires_at: toIso(row.expires_at),
          learner_key: null,
        })),
    );
  }
  return rows;
}

export async function inviteAdminUser(input: {
  pool: DbPool;
  config: AppConfig;
  actor: AdminDirectoryActor;
  payload: unknown;
}) {
  requireOwnerAdmin(input.actor);
  const payload = inviteUserPayloadSchema.parse(input.payload);
  const email = normalizeEmail(payload.email);
  const existing = await input.pool.query(
    `SELECT user_key, role
       FROM onetime.account_users
      WHERE account_key = $1 AND product_key = $2 AND email_normalized = $3
      LIMIT 1`,
    [input.config.accountKey, input.config.productKey, email],
  );
  if (existing.rowCount) {
    throw new AdminDirectoryError(
      'DUPLICATE',
      `An existing ${String(existing.rows[0]?.role)} account already uses this email.`,
    );
  }
  if (payload.role === 'admin' || payload.role === 'rabbi') {
    const result = await createOwnerAdminInvitation({
      pool: input.pool,
      config: input.config,
      actor: { userKey: input.actor.userKey, role: input.actor.role },
      payload: {
        idempotency_key: payload.idempotency_key,
        email,
        display_name: payload.display_name,
        role: payload.role,
      },
    });
    return {
      user_key: `pending:${result.token_key}`,
      role: payload.role,
      status: 'pending_setup' as const,
      expires_at: result.expires_at,
      external_send_performed: false as const,
    };
  }
  const householdKey = payload.household_key!;
  const result = await inTransaction(input.pool, (client) =>
    issueParentActivationWithClient({
      client,
      config: input.config,
      actor: { userKey: input.actor.userKey, role: input.actor.role },
      payload: {
        idempotency_key: payload.idempotency_key,
        email,
        display_name: payload.display_name,
        household_key: householdKey,
        relationship_key: `guardian_${randomUUID()}`,
        relationship_label: payload.relationship_label,
        authority: payload.authority,
      },
      now: new Date(),
      queueHighLevelPortalEvent: false,
    }),
  );
  return {
    user_key: `pending:${result.token_key}`,
    role: 'parent' as const,
    status: 'pending_setup' as const,
    household_key: householdKey,
    expires_at: result.expires_at,
    external_send_performed: false as const,
  };
}

export function updateAdminUser(input: {
  pool: DbPool;
  config: AppConfig;
  actor: AdminDirectoryActor;
  userKey: string;
  payload: unknown;
}) {
  requireOwnerAdmin(input.actor);
  const userKey = opaqueKeySchema.parse(input.userKey);
  const payload = updateUserPayloadSchema.parse(input.payload);
  return inTransaction(input.pool, async (client) => {
    const current = await lockUser(client, input.config, userKey);
    assertVersion({ version: current.security_version }, payload.version);
    if (String(current.role) === 'owner') {
      throw new AdminDirectoryError('FORBIDDEN', 'The Owner role cannot be changed here.');
    }
    if (String(current.role) === 'student') {
      throw new AdminDirectoryError(
        'IDENTITY_CONFLICT',
        'Student roles are managed from the linked learner.',
      );
    }
    if (payload.role === 'admin' || payload.role === 'rabbi') {
      const guardians = await client.query(
        `SELECT 1 FROM onetime.portal_guardian_relationships
          WHERE account_key = $1 AND product_key = $2 AND guardian_user_ref = $3
            AND status = 'active' LIMIT 1`,
        [input.config.accountKey, input.config.productKey, userKey],
      );
      if (guardians.rowCount) {
        throw new AdminDirectoryError(
          'IDENTITY_CONFLICT',
          'Revoke active household guardian relationships before assigning a staff role.',
        );
      }
    }
    const result = await client.query(
      `UPDATE onetime.account_users
          SET display_name = $4,
              role = $5,
              security_version = security_version + 1,
              security_policy_updated_at = now(),
              updated_at = now()
        WHERE account_key = $1 AND product_key = $2 AND user_key = $3
        RETURNING user_key, display_name, email_normalized, role, status, security_version`,
      [
        input.config.accountKey,
        input.config.productKey,
        userKey,
        payload.display_name,
        payload.role,
      ],
    );
    await revokeUserSessions(client, input.config, userKey);
    return mapUser(result.rows[0] ?? {});
  });
}

export function setAdminUserStatus(input: {
  pool: DbPool;
  config: AppConfig;
  actor: AdminDirectoryActor;
  userKey: string;
  status: 'active' | 'disabled';
  payload: unknown;
}) {
  requireOwnerAdmin(input.actor);
  const userKey = opaqueKeySchema.parse(input.userKey);
  const payload = versionPayloadSchema.parse(input.payload);
  if (userKey === input.actor.userKey && input.status === 'disabled') {
    throw new AdminDirectoryError('FORBIDDEN', 'You cannot disable your own account.');
  }
  return inTransaction(input.pool, async (client) => {
    const current = await lockUser(client, input.config, userKey);
    assertVersion({ version: current.security_version }, payload.version);
    if (String(current.role) === 'owner') {
      throw new AdminDirectoryError('FORBIDDEN', 'The Owner account cannot be disabled here.');
    }
    const result = await client.query(
      `UPDATE onetime.account_users
          SET status = $4,
              security_version = security_version + 1,
              security_policy_updated_at = now(),
              updated_at = now()
        WHERE account_key = $1 AND product_key = $2 AND user_key = $3
        RETURNING user_key, display_name, email_normalized, role, status, security_version`,
      [input.config.accountKey, input.config.productKey, userKey, input.status],
    );
    if (input.status === 'disabled') await revokeUserSessions(client, input.config, userKey);
    await recordAudit(client, input.config, input.actor, {
      action: input.status === 'disabled' ? 'admin_user_disabled' : 'admin_user_reactivated',
      metadata: { subject_user_key: userKey },
    });
    return mapUser(result.rows[0] ?? {});
  });
}

export async function requestAdminUserPasswordReset(input: {
  pool: DbPool;
  config: AppConfig;
  actor: AdminDirectoryActor;
  userKey: string;
  payload: unknown;
}) {
  requireOwnerAdmin(input.actor);
  const userKey = opaqueKeySchema.parse(input.userKey);
  const payload = passwordResetPayloadSchema.parse(input.payload);
  const result = await input.pool.query(
    `SELECT users.email_normalized, users.role,
            links.learner_key, links.household_key, links.link_state,
            access.student_user_ref AS access_student_user_ref,
            access.status AS access_status
       FROM onetime.account_users AS users
       LEFT JOIN onetime.account_learner_identity_links AS links
         ON links.account_key = users.account_key
         AND links.product_key = users.product_key
         AND links.user_key = users.user_key
       LEFT JOIN onetime.portal_student_access_state AS access
         ON access.account_key = links.account_key
        AND access.product_key = links.product_key
        AND access.household_key = links.household_key
        AND access.learner_key = links.learner_key
      WHERE users.account_key = $1
        AND users.product_key = $2
        AND users.user_key = $3
      LIMIT 2`,
    [input.config.accountKey, input.config.productKey, userKey],
  );
  if (!result.rowCount) throw new AdminDirectoryError('NOT_FOUND', 'The user was not found.');
  const user = result.rows[0] as Record<string, unknown>;
  if (String(user.role) === 'student') {
    if (
      result.rows.length !== 1 ||
      !nullableString(user.learner_key) ||
      !nullableString(user.household_key) ||
      String(user.link_state) !== 'active' ||
      String(user.access_status) !== 'active' ||
      String(user.access_student_user_ref) !== userKey
    ) {
      throw new AdminDirectoryError(
        'IDENTITY_CONFLICT',
        'The Student PIN reset target is unavailable.',
      );
    }
    try {
      const reset = await requestStudentResetForHousehold({
        pool: input.pool,
        config: input.config,
        actor: { userKey: input.actor.userKey, role: input.actor.role as 'owner' | 'admin' },
        householdKey: String(user.household_key),
        learnerKey: String(user.learner_key),
        expectedStudentUserKey: userKey,
        idempotencyKey: payload.idempotency_key,
      });
      return {
        user_key: userKey,
        reset_kind: 'student_pin' as const,
        request_accepted: true as const,
        external_send_performed: reset.delivery.external_send_performed,
      };
    } catch (error) {
      if (!(error instanceof ContactOperationsError)) throw error;
      throw new AdminDirectoryError(
        'IDENTITY_CONFLICT',
        'The Student PIN reset target is unavailable.',
      );
    }
  }
  const reset = await requestPasswordReset({
    pool: input.pool,
    config: input.config,
    payload: {
      idempotency_key: payload.idempotency_key,
      email: String(result.rows[0]?.email_normalized),
    },
  });
  return {
    user_key: userKey,
    reset_kind: 'adult_password' as const,
    request_accepted: true as const,
    external_send_performed:
      'delivery' in reset ? reset.delivery.external_send_performed : (false as const),
  };
}

export async function listAdminLearners(input: {
  pool: DbPool;
  config: AppConfig;
  query?: unknown;
}): Promise<AdminLearner[]> {
  const query = adminDirectoryListQuerySchema.parse(input.query ?? {});
  const params: unknown[] = [input.config.accountKey, input.config.productKey];
  const where = [
    'learners.account_key = $1',
    'learners.product_key = $2',
    `learners.learner_key NOT LIKE 'live_demo_learner_%'`,
    `learners.learner_key NOT LIKE 'full_app_preview_%'`,
  ];
  if (query.search) {
    params.push(`%${query.search.toLowerCase()}%`);
    where.push(
      `(lower(learners.display_name) LIKE $${params.length}
        OR lower(households.display_name) LIKE $${params.length})`,
    );
  }
  if (['active', 'archived', 'suspended'].includes(query.status)) {
    params.push(query.status);
    where.push(`learners.learner_status = $${params.length}`);
  }
  const result = await input.pool.query(
    `SELECT learners.learner_key, learners.household_key,
            households.display_name AS household_name,
            learners.display_name, learners.hebrew_name, learners.grade_label,
            learners.learner_status, learners.version, learners.updated_at,
            COALESCE(access.status, 'not_configured') AS student_access_status,
            access.student_user_ref,
            count(DISTINCT registrations.occurrence_key)::int AS enrollment_count
       FROM onetime.portal_learners AS learners
       JOIN onetime.portal_households AS households
         ON households.account_key = learners.account_key
        AND households.product_key = learners.product_key
        AND households.household_key = learners.household_key
       LEFT JOIN onetime.portal_student_access_state AS access
         ON access.account_key = learners.account_key
        AND access.product_key = learners.product_key
        AND access.learner_key = learners.learner_key
       LEFT JOIN onetime.classroom_zoom_registrants AS registrations
         ON registrations.account_key = learners.account_key
        AND registrations.product_key = learners.product_key
        AND registrations.learner_key = learners.learner_key
        AND registrations.registration_state = 'registered'
      WHERE ${where.join(' AND ')}
      GROUP BY learners.learner_key, learners.household_key, households.display_name,
               learners.display_name, learners.hebrew_name, learners.grade_label,
               learners.learner_status, learners.version, learners.updated_at,
               access.status, access.student_user_ref
      ORDER BY households.display_name, learners.display_name, learners.learner_key`,
    params,
  );
  return result.rows.map(mapLearner);
}

export function createAdminLearner(input: {
  pool: DbPool;
  config: AppConfig;
  actor: AdminDirectoryActor;
  payload: unknown;
}) {
  requireOwnerAdmin(input.actor);
  const payload = createLearnerPayloadSchema.parse(input.payload);
  return inTransaction(input.pool, async (client) => {
    const replay = await readIdempotency<AdminLearner>(
      client,
      input.config,
      input.actor,
      `admin-directory.learner.create:${payload.household_key}`,
      payload.idempotency_key,
      payload,
    );
    if (replay) return replay;
    await lockHousehold(client, input.config, payload.household_key, true);
    await requireLearnerSeat(client, input.config, payload.household_key);
    await assertLearnerNameAvailable(
      client,
      input.config,
      payload.household_key,
      payload.display_name,
    );
    const learnerKey = `learner_${randomUUID()}`;
    const result = await client.query(
      `INSERT INTO onetime.portal_learners
         (learner_key, account_key, product_key, household_key, display_name,
          hebrew_name, grade_label)
       VALUES ($1,$2,$3,$4,$5,$6,$7)
       RETURNING learner_key, household_key, display_name, hebrew_name, grade_label,
                 learner_status, version, updated_at`,
      [
        learnerKey,
        input.config.accountKey,
        input.config.productKey,
        payload.household_key,
        payload.display_name,
        payload.hebrew_name,
        payload.grade_label,
      ],
    );
    await client.query(
      `INSERT INTO onetime.portal_student_access_state
         (access_state_key, account_key, product_key, household_key, learner_key)
       VALUES ($1,$2,$3,$4,$5)`,
      [
        `student_access_${randomUUID()}`,
        input.config.accountKey,
        input.config.productKey,
        payload.household_key,
        learnerKey,
      ],
    );
    await recordAudit(client, input.config, input.actor, {
      householdKey: payload.household_key,
      learnerKey,
      action: 'admin_learner_created',
    });
    const learner = {
      ...mapLearner({
        ...result.rows[0],
        household_name: await householdName(client, input.config, payload.household_key),
      }),
      student_access_status: 'not_configured',
      student_user_ref: null,
      enrollment_count: 0,
    };
    await writeIdempotency(
      client,
      input.config,
      input.actor,
      `admin-directory.learner.create:${payload.household_key}`,
      payload.idempotency_key,
      payload,
      learner,
    );
    return learner;
  });
}

export function updateAdminLearner(input: {
  pool: DbPool;
  config: AppConfig;
  actor: AdminDirectoryActor;
  learnerKey: string;
  payload: unknown;
}) {
  requireOwnerAdmin(input.actor);
  const learnerKey = opaqueKeySchema.parse(input.learnerKey);
  const payload = updateLearnerPayloadSchema.parse(input.payload);
  return inTransaction(input.pool, async (client) => {
    const current = await lockLearner(client, input.config, learnerKey);
    assertVersion(current, payload.version);
    await assertLearnerNameAvailable(
      client,
      input.config,
      String(current.household_key),
      payload.display_name,
      learnerKey,
    );
    const result = await client.query(
      `UPDATE onetime.portal_learners
          SET display_name = $4,
              hebrew_name = $5,
              grade_label = $6,
              version = version + 1,
              updated_at = now()
        WHERE account_key = $1 AND product_key = $2 AND learner_key = $3
        RETURNING learner_key, household_key, display_name, hebrew_name, grade_label,
                  learner_status, version, updated_at`,
      [
        input.config.accountKey,
        input.config.productKey,
        learnerKey,
        payload.display_name,
        payload.hebrew_name,
        payload.grade_label,
      ],
    );
    await recordAudit(client, input.config, input.actor, {
      householdKey: String(current.household_key),
      learnerKey,
      action: 'admin_learner_updated',
    });
    return mapLearner({
      ...result.rows[0],
      household_name: await householdName(client, input.config, String(current.household_key)),
      student_access_status: current.student_access_status,
      student_user_ref: current.student_user_ref,
    });
  });
}

export function setAdminLearnerStatus(input: {
  pool: DbPool;
  config: AppConfig;
  actor: AdminDirectoryActor;
  learnerKey: string;
  status: 'active' | 'archived';
  payload: unknown;
}) {
  requireOwnerAdmin(input.actor);
  const learnerKey = opaqueKeySchema.parse(input.learnerKey);
  const payload = versionPayloadSchema.parse(input.payload);
  return inTransaction(input.pool, async (client) => {
    const current = await lockLearner(client, input.config, learnerKey);
    assertVersion(current, payload.version);
    await lockHousehold(client, input.config, String(current.household_key), true);
    if (input.status === 'active' && String(current.learner_status) !== 'active') {
      await requireLearnerSeat(client, input.config, String(current.household_key));
      await assertLearnerNameAvailable(
        client,
        input.config,
        String(current.household_key),
        String(current.display_name),
        learnerKey,
      );
    }
    const result = await client.query(
      `UPDATE onetime.portal_learners
          SET learner_status = $4,
              archived_at = CASE WHEN $4 = 'archived' THEN now() ELSE NULL END,
              suspended_at = NULL,
              version = version + 1,
              updated_at = now()
        WHERE account_key = $1 AND product_key = $2 AND learner_key = $3
        RETURNING learner_key, household_key, display_name, hebrew_name, grade_label,
                  learner_status, version, updated_at`,
      [input.config.accountKey, input.config.productKey, learnerKey, input.status],
    );
    if (input.status === 'archived') {
      await client.query(
        `UPDATE onetime.portal_student_access_state
            SET status = 'disabled',
                version = version + 1,
                updated_at = now()
          WHERE account_key = $1 AND product_key = $2 AND learner_key = $3`,
        [input.config.accountKey, input.config.productKey, learnerKey],
      );
      const linked = await client.query(
        `SELECT user_key FROM onetime.account_learner_identity_links
          WHERE account_key = $1 AND product_key = $2 AND learner_key = $3`,
        [input.config.accountKey, input.config.productKey, learnerKey],
      );
      const userKey = nullableString(linked.rows[0]?.user_key);
      if (userKey) {
        await client.query(
          `UPDATE onetime.account_learner_identity_links
              SET link_state = 'disabled', disabled_at = now()
            WHERE account_key = $1 AND product_key = $2 AND learner_key = $3`,
          [input.config.accountKey, input.config.productKey, learnerKey],
        );
        await client.query(
          `UPDATE onetime.account_users
              SET status = 'disabled', security_version = security_version + 1,
                  security_policy_updated_at = now(), updated_at = now()
            WHERE account_key = $1 AND product_key = $2 AND user_key = $3`,
          [input.config.accountKey, input.config.productKey, userKey],
        );
        await revokeUserSessions(client, input.config, userKey);
      }
    }
    await recordAudit(client, input.config, input.actor, {
      householdKey: String(current.household_key),
      learnerKey,
      action: input.status === 'archived' ? 'admin_learner_archived' : 'admin_learner_restored',
    });
    return mapLearner({
      ...result.rows[0],
      household_name: await householdName(client, input.config, String(current.household_key)),
      student_access_status:
        input.status === 'archived' ? 'disabled' : current.student_access_status,
      student_user_ref: current.student_user_ref,
    });
  });
}

export async function requestAdminStudentSetup(input: {
  pool: DbPool;
  config: AppConfig;
  actor: AdminDirectoryActor;
  learnerKey: string;
  payload: unknown;
}) {
  requireOwnerAdmin(input.actor);
  const learnerKey = opaqueKeySchema.parse(input.learnerKey);
  const payload = studentSetupPayloadSchema.parse(input.payload);
  const learner = await input.pool.query(
    `SELECT learner_key, household_key, display_name, learner_status
       FROM onetime.portal_learners
      WHERE account_key = $1 AND product_key = $2 AND learner_key = $3
      LIMIT 1`,
    [input.config.accountKey, input.config.productKey, learnerKey],
  );
  if (!learner.rowCount) throw new AdminDirectoryError('NOT_FOUND', 'The learner was not found.');
  if (String(learner.rows[0]?.learner_status) !== 'active') {
    throw new AdminDirectoryError(
      'IDENTITY_CONFLICT',
      'Restore the learner before starting Student account setup.',
    );
  }
  const result = await createStudentSetup({
    pool: input.pool,
    config: input.config,
    actor: { userKey: input.actor.userKey, role: input.actor.role },
    payload: {
      idempotency_key: payload.idempotency_key,
      email: payload.email,
      display_name: String(learner.rows[0]?.display_name),
      household_key: String(learner.rows[0]?.household_key),
      learner_key: learnerKey,
    },
  });
  return {
    learner_key: learnerKey,
    status: 'setup_requested' as const,
    expires_at: result.expires_at,
    external_send_performed: false as const,
  };
}

async function lockHousehold(
  client: Queryable,
  config: AppConfig,
  householdKey: string,
  requireActive = false,
) {
  const result = await client.query(
    `SELECT household_key, display_name, status, version
       FROM onetime.portal_households
      WHERE account_key = $1 AND product_key = $2 AND household_key = $3
        ${requireActive ? `AND status = 'active'` : ''}
      FOR UPDATE`,
    [config.accountKey, config.productKey, householdKey],
  );
  const row = result.rows[0] as Record<string, unknown> | undefined;
  if (!row) throw new AdminDirectoryError('NOT_FOUND', 'The household was not found.');
  return row;
}

async function lockLearner(
  client: Queryable,
  config: AppConfig,
  learnerKey: string,
): Promise<Record<string, unknown>> {
  const result = await client.query(
    `SELECT *
       FROM onetime.portal_learners
      WHERE account_key = $1 AND product_key = $2 AND learner_key = $3
      FOR UPDATE`,
    [config.accountKey, config.productKey, learnerKey],
  );
  const row = result.rows[0] as Record<string, unknown> | undefined;
  if (!row) throw new AdminDirectoryError('NOT_FOUND', 'The learner was not found.');
  const access = await client.query(
    `SELECT status, student_user_ref
       FROM onetime.portal_student_access_state
      WHERE account_key = $1 AND product_key = $2 AND learner_key = $3
      LIMIT 1`,
    [config.accountKey, config.productKey, learnerKey],
  );
  return {
    ...row,
    student_access_status: access.rows[0]?.status ?? 'not_configured',
    student_user_ref: access.rows[0]?.student_user_ref ?? null,
  };
}

async function lockUser(client: Queryable, config: AppConfig, userKey: string) {
  const result = await client.query(
    `SELECT user_key, display_name, email_normalized, role, status, security_version
       FROM onetime.account_users
      WHERE account_key = $1 AND product_key = $2 AND user_key = $3
      FOR UPDATE`,
    [config.accountKey, config.productKey, userKey],
  );
  const row = result.rows[0] as Record<string, unknown> | undefined;
  if (!row) throw new AdminDirectoryError('NOT_FOUND', 'The user was not found.');
  return row;
}

async function requireLearnerSeat(client: Queryable, config: AppConfig, householdKey: string) {
  const result = await client.query(
    `SELECT count(*)::int AS count
       FROM onetime.portal_learners
      WHERE account_key = $1 AND product_key = $2 AND household_key = $3
        AND learner_status = 'active'`,
    [config.accountKey, config.productKey, householdKey],
  );
  if (Number(result.rows[0]?.count ?? 0) >= MAX_ACTIVE_LEARNERS) {
    throw new AdminDirectoryError(
      'LEARNER_LIMIT_REACHED',
      'This household already has three active learners. Archive one learner before adding another.',
    );
  }
}

async function assertHouseholdNameAvailable(
  client: Queryable,
  config: AppConfig,
  displayName: string,
  excludeKey?: string,
) {
  const result = await client.query(
    `SELECT household_key
       FROM onetime.portal_households
      WHERE account_key = $1 AND product_key = $2
        AND lower(display_name) = lower($3)
        AND ($4::text IS NULL OR household_key <> $4)
      LIMIT 1`,
    [config.accountKey, config.productKey, displayName, excludeKey ?? null],
  );
  if (result.rowCount) {
    throw new AdminDirectoryError(
      'DUPLICATE',
      'A household with this name already exists. Open the existing household instead.',
    );
  }
}

async function assertLearnerNameAvailable(
  client: Queryable,
  config: AppConfig,
  householdKey: string,
  displayName: string,
  excludeKey?: string,
) {
  const result = await client.query(
    `SELECT learner_key
       FROM onetime.portal_learners
      WHERE account_key = $1 AND product_key = $2 AND household_key = $3
        AND lower(display_name) = lower($4)
        AND learner_status <> 'archived'
        AND ($5::text IS NULL OR learner_key <> $5)
      LIMIT 1`,
    [config.accountKey, config.productKey, householdKey, displayName, excludeKey ?? null],
  );
  if (result.rowCount) {
    throw new AdminDirectoryError(
      'DUPLICATE',
      'An active learner with this name already exists in the household.',
    );
  }
}

async function householdName(client: Queryable, config: AppConfig, householdKey: string) {
  const result = await client.query(
    `SELECT display_name FROM onetime.portal_households
      WHERE account_key = $1 AND product_key = $2 AND household_key = $3`,
    [config.accountKey, config.productKey, householdKey],
  );
  return String(result.rows[0]?.display_name ?? 'Household');
}

function assertVersion(row: Record<string, unknown>, expected: number) {
  const current = Number(row.version);
  if (current !== expected) {
    throw new AdminDirectoryError(
      'VERSION_CONFLICT',
      'This record changed in another session. Reload before saving.',
      current,
    );
  }
}

function requireOwnerAdmin(actor: AdminDirectoryActor) {
  if (actor.role !== 'owner' && actor.role !== 'admin') {
    throw new AdminDirectoryError('FORBIDDEN', 'This action requires an Administrator.');
  }
}

async function revokeUserSessions(client: Queryable, config: AppConfig, userKey: string) {
  await client.query(
    `UPDATE onetime.user_sessions
        SET revoked_at = COALESCE(revoked_at, now())
      WHERE account_key = $1 AND product_key = $2 AND user_key = $3
        AND revoked_at IS NULL`,
    [config.accountKey, config.productKey, userKey],
  );
}

async function readIdempotency<T>(
  client: Queryable,
  config: AppConfig,
  actor: AdminDirectoryActor,
  operationScope: string,
  idempotencyKey: string,
  payload: unknown,
) {
  await client.query('SELECT pg_advisory_xact_lock($1)', [
    advisoryLock(`${config.accountKey}:${config.productKey}:${operationScope}:${idempotencyKey}`),
  ]);
  const result = await client.query(
    `SELECT request_hash, response_json
       FROM onetime.portal_mutation_idempotency_records
      WHERE account_key = $1 AND product_key = $2 AND actor_user_ref = $3
        AND operation_scope = $4 AND idempotency_key = $5`,
    [config.accountKey, config.productKey, actor.userKey, operationScope, idempotencyKey],
  );
  if (!result.rowCount) return null;
  if (String(result.rows[0]?.request_hash) !== fingerprint(payload)) {
    throw new AdminDirectoryError(
      'IDEMPOTENCY_CONFLICT',
      'This request key was already used for different information.',
    );
  }
  return result.rows[0]?.response_json as T;
}

async function writeIdempotency(
  client: Queryable,
  config: AppConfig,
  actor: AdminDirectoryActor,
  operationScope: string,
  idempotencyKey: string,
  payload: unknown,
  response: unknown,
) {
  await client.query(
    `INSERT INTO onetime.portal_mutation_idempotency_records
       (account_key, product_key, actor_user_ref, operation_scope, idempotency_key,
        request_hash, response_json)
     VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb)`,
    [
      config.accountKey,
      config.productKey,
      actor.userKey,
      operationScope,
      idempotencyKey,
      fingerprint(payload),
      JSON.stringify(response),
    ],
  );
}

async function recordAudit(
  client: Queryable,
  config: AppConfig,
  actor: AdminDirectoryActor,
  input: {
    action: string;
    householdKey?: string;
    learnerKey?: string;
    metadata?: Record<string, unknown>;
  },
) {
  await client.query(
    `INSERT INTO onetime.portal_audit_actions
       (audit_key, account_key, product_key, actor_user_ref, actor_role,
        household_key, learner_key, action_type, metadata)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb)`,
    [
      `portal_audit_${randomUUID()}`,
      config.accountKey,
      config.productKey,
      actor.userKey,
      actor.role,
      input.householdKey ?? null,
      input.learnerKey ?? null,
      input.action,
      JSON.stringify(input.metadata ?? {}),
    ],
  );
}

function mapHousehold(row: Record<string, unknown>): AdminHousehold {
  return {
    household_key: String(row.household_key),
    display_name: String(row.display_name),
    status: row.status as AdminHousehold['status'],
    version: Number(row.version),
    active_learner_count: Number(row.active_learner_count ?? 0),
    learner_count: Number(row.learner_count ?? 0),
    guardian_count: Number(row.guardian_count ?? 0),
    access_state: String(row.access_state ?? 'pending'),
    setup_state: String(row.setup_state ?? 'not_started'),
    updated_at: toIso(row.updated_at),
  };
}

function mapUser(row: Record<string, unknown>): AdminUser {
  return {
    user_key: String(row.user_key),
    display_name: String(row.display_name),
    email: String(row.email_normalized),
    role: String(row.role),
    status: row.status as AdminUser['status'],
    version: Number(row.security_version ?? 1),
    household_key: nullableString(row.household_key),
    household_name: nullableString(row.household_name),
    relationship_label: nullableString(row.relationship_label),
    last_successful_login_at: nullableIso(row.last_successful_login_at),
    setup_expires_at: nullableIso(row.setup_expires_at),
    learner_key: nullableString(row.learner_key),
  };
}

function mapLearner(row: Record<string, unknown>): AdminLearner {
  return {
    learner_key: String(row.learner_key),
    household_key: String(row.household_key),
    household_name: String(row.household_name ?? 'Household'),
    display_name: String(row.display_name),
    hebrew_name: nullableString(row.hebrew_name),
    grade_label: nullableString(row.grade_label),
    learner_status: row.learner_status as AdminLearner['learner_status'],
    version: Number(row.version),
    student_access_status: String(row.student_access_status ?? 'not_configured'),
    student_user_ref: nullableString(row.student_user_ref),
    enrollment_count: Number(row.enrollment_count ?? 0),
    updated_at: toIso(row.updated_at),
  };
}

function toIso(value: unknown) {
  return value instanceof Date ? value.toISOString() : new Date(String(value)).toISOString();
}

function nullableIso(value: unknown) {
  return value ? toIso(value) : null;
}

function nullableString(value: unknown) {
  return typeof value === 'string' && value.length > 0 ? value : null;
}

function recordValue(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function fingerprint(value: unknown) {
  return createHash('sha256').update(JSON.stringify(value)).digest('hex');
}

function advisoryLock(value: string) {
  const parsed = Number.parseInt(createHash('sha256').update(value).digest('hex').slice(0, 8), 16);
  return parsed > 0x7fffffff ? parsed - 0x100000000 : parsed;
}
