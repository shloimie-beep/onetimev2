import { createHash, scryptSync } from 'node:crypto';
import type { AppConfig } from '../../../config/src/index.ts';
import { inTransaction, type DbPool, type Queryable } from '../../../db/src/index.ts';
import {
  normalizeStudentUsername,
  type LearnerProfile,
  type PortalActorContext,
  type StudentAccessOperationPayload,
} from '../../../contracts/src/portals/index.ts';
import { hashPassword } from '../auth/service.ts';
import {
  AccountLifecycleError,
  revokeStudentIdentitySessions,
  restoreStudentIdentity,
  suspendStudentIdentity,
} from '../accounts/lifecycle.ts';
import {
  PortalServiceError,
  type CredentialLifecycleResult,
  type StudentAccessOperationType,
  type StudentCredentialLifecycleAdapter,
} from './services.ts';

export function createAccountLifecycleCredentialAdapter(input: {
  pool: DbPool;
  config: AppConfig;
}): StudentCredentialLifecycleAdapter {
  return {
    requestSetup: async ({ actor, learner, payload }) =>
      mapLifecycleErrors(async () => {
        return parentManagedCredentialResult(
          'setup',
          input.pool,
          input.config,
          actor,
          learner,
          payload,
        );
      }),
    requestReset: async ({ actor, learner, payload }) =>
      mapLifecycleErrors(async () => {
        return parentManagedCredentialResult(
          'reset',
          input.pool,
          input.config,
          actor,
          learner,
          payload,
        );
      }),
    requestSuspend: async ({ actor, learner }) =>
      mapLifecycleErrors(async () => {
        const state = await suspendStudentIdentity({
          pool: input.pool,
          config: input.config,
          actor: lifecycleActor(actor),
          learnerKey: learner.learner_key,
        });
        return stateResult('suspend', learner, state.sessions_invalidated);
      }),
    requestRestore: async ({ actor, learner }) =>
      mapLifecycleErrors(async () => {
        await restoreStudentIdentity({
          pool: input.pool,
          config: input.config,
          actor: lifecycleActor(actor),
          learnerKey: learner.learner_key,
        });
        return stateResult('restore', learner, 0);
      }),
    requestRevokeSessions: async ({ actor, learner }) =>
      mapLifecycleErrors(async () => {
        const state = await revokeStudentIdentitySessions({
          pool: input.pool,
          config: input.config,
          actor: lifecycleActor(actor),
          learnerKey: learner.learner_key,
        });
        return {
          operation_ref: `student_revoke_sessions_${digest(
            [learner.learner_key, String(state.sessions_invalidated)].join(':'),
          ).slice(0, 24)}`,
          status: state.access_status,
          expires_at: null,
          delivery_hint: null,
          last_session_revoked_at: new Date().toISOString(),
        };
      }),
  };
}

function lifecycleActor(actor: PortalActorContext) {
  return { userKey: actor.actor_user_ref, role: actor.actor_role };
}

async function parentManagedCredentialResult(
  operationType: Extract<StudentAccessOperationType, 'setup' | 'reset'>,
  pool: DbPool,
  config: Pick<AppConfig, 'accountKey' | 'productKey'>,
  actor: PortalActorContext,
  learner: LearnerProfile,
  payload: StudentAccessOperationPayload,
): Promise<CredentialLifecycleResult> {
  if (!payload.password) {
    throw new PortalServiceError('PASSWORD_POLICY_FAILED', 'Student password is required.');
  }
  const normalizedUsername = payload.username ? normalizeStudentUsername(payload.username) : null;
  const usernameForHash = normalizedUsername ?? `learner:${learner.learner_key}`;
  const hashRef = studentPasswordHashRef({
    accountKey: actor.account_key || config.accountKey,
    productKey: actor.product_key || config.productKey,
    learnerKey: learner.learner_key,
    username: usernameForHash,
    password: payload.password,
    idempotencyKey: payload.idempotency_key,
  });
  const fallbackStudentUserRef = `student_user_${digest(
    [actor.account_key, actor.product_key, learner.learner_key].join(':'),
  ).slice(0, 32)}`;
  const now = new Date();
  const writeResult = await persistParentManagedStudentCredential({
    pool,
    config,
    actor,
    learner,
    operationType,
    fallbackStudentUserRef,
    normalizedUsername,
    hashRef,
    password: payload.password,
    displayName: payload.display_name ?? learner.display_name,
    now,
  });
  return {
    operation_ref: `student_${operationType}_${digest(
      [learner.learner_key, usernameForHash, payload.idempotency_key, hashRef].join(':'),
    ).slice(0, 24)}`,
    status: 'active',
    expires_at: null,
    delivery_hint:
      operationType === 'setup'
        ? 'Parent-managed student username created. No student email delivery queued.'
        : 'Parent-managed student password reset. Existing student sessions should re-authenticate.',
    student_user_ref: writeResult.studentUserRef,
    username_display: normalizedUsername,
    credential_status: 'parent_managed',
    password_hash_ref: hashRef,
    password_version: 1,
    security_version: writeResult.securityVersion,
    last_reset_at: operationType === 'reset' ? now.toISOString() : null,
    last_session_revoked_at: writeResult.revokedAt,
  };
}

async function persistParentManagedStudentCredential(input: {
  pool: DbPool;
  config: Pick<AppConfig, 'accountKey' | 'productKey'>;
  actor: PortalActorContext;
  learner: LearnerProfile;
  operationType: Extract<StudentAccessOperationType, 'setup' | 'reset'>;
  fallbackStudentUserRef: string;
  normalizedUsername: string | null;
  hashRef: string;
  password: string;
  displayName: string;
  now: Date;
}) {
  return inTransaction(input.pool, async (client) => {
    const accountKey = input.actor.account_key || input.config.accountKey;
    const productKey = input.actor.product_key || input.config.productKey;
    if (input.normalizedUsername) {
      const usernameOwner = await client.query(
        `SELECT learner_key
           FROM onetime.portal_student_access_state
          WHERE account_key = $1
            AND product_key = $2
            AND normalized_username = $3
            AND learner_key <> $4
            AND status <> 'disabled'
          LIMIT 1`,
        [accountKey, productKey, input.normalizedUsername, input.learner.learner_key],
      );
      if (usernameOwner.rowCount) {
        throw new PortalServiceError(
          'USERNAME_UNAVAILABLE',
          'Choose a different student username.',
        );
      }
    }
    const current = await currentStudentAccessState(client, input);
    const studentUserRef = current?.student_user_ref?.trim() || input.fallbackStudentUserRef;
    const user = await client.query(
      `SELECT user_key, email_normalized
         FROM onetime.account_users
        WHERE account_key = $1
          AND product_key = $2
          AND user_key = $3
        LIMIT 1`,
      [accountKey, productKey, studentUserRef],
    );
    const sameCredential =
      current?.password_hash_ref === input.hashRef &&
      (!input.normalizedUsername || current?.normalized_username === input.normalizedUsername);
    const shouldWritePassword = !sameCredential || !user.rowCount;
    let revokedAt: string | null = null;
    if (input.operationType === 'reset' && shouldWritePassword) {
      const revoked = await revokeActiveStudentSessions(client, {
        ...input,
        studentUserRef,
      });
      revokedAt = revoked > 0 ? input.now.toISOString() : null;
    }
    const existingEmail = user.rows[0]?.email_normalized;
    const accountIdentifier = input.normalizedUsername
      ? `student:${input.normalizedUsername}`
      : typeof existingEmail === 'string' && existingEmail.trim()
        ? existingEmail
        : `student:${input.learner.learner_key}`;
    const upserted = await client.query(
      `INSERT INTO onetime.account_users
         (user_key, account_key, product_key, email_normalized, display_name, role,
          password_hash, mfa_capable, status, security_version, security_policy_updated_at,
          updated_at)
       VALUES ($1,$2,$3,$4,$5,'student',$6,false,'active',1,$8,$8)
       ON CONFLICT (user_key)
       DO UPDATE SET
         email_normalized = EXCLUDED.email_normalized,
         display_name = EXCLUDED.display_name,
         role = 'student',
         password_hash = CASE
           WHEN $7::boolean THEN EXCLUDED.password_hash
           ELSE onetime.account_users.password_hash
         END,
         password_updated_at = CASE
           WHEN $7::boolean THEN $8
           ELSE onetime.account_users.password_updated_at
         END,
         status = 'active',
         security_version = CASE
           WHEN $7::boolean THEN onetime.account_users.security_version + 1
           ELSE onetime.account_users.security_version
         END,
         security_policy_updated_at = CASE
           WHEN $7::boolean THEN $8
           ELSE onetime.account_users.security_policy_updated_at
         END,
         updated_at = $8
       RETURNING security_version`,
      [
        studentUserRef,
        accountKey,
        productKey,
        accountIdentifier,
        input.displayName.trim(),
        hashPassword(input.password),
        shouldWritePassword,
        input.now,
      ],
    );
    await client.query(
      `INSERT INTO onetime.account_learner_identity_links
         (link_key, account_key, product_key, household_key, learner_key, user_key, link_state,
          created_at)
       VALUES ($1,$2,$3,$4,$5,$6,'active',$7)
       ON CONFLICT (account_key, product_key, learner_key)
       DO UPDATE SET
         user_key = EXCLUDED.user_key,
         link_state = 'active',
         suspended_at = NULL,
         disabled_at = NULL`,
      [
        `student_link_${digest([accountKey, productKey, input.learner.learner_key].join(':')).slice(
          0,
          32,
        )}`,
        accountKey,
        productKey,
        input.learner.household_key,
        input.learner.learner_key,
        studentUserRef,
        input.now,
      ],
    );
    return {
      securityVersion: Number(upserted.rows[0]?.security_version ?? 1),
      revokedAt,
      studentUserRef,
    };
  });
}

async function currentStudentAccessState(
  client: Queryable,
  input: {
    config: Pick<AppConfig, 'accountKey' | 'productKey'>;
    actor: PortalActorContext;
    learner: LearnerProfile;
  },
) {
  const result = await client.query(
    `SELECT normalized_username, password_hash_ref, student_user_ref
       FROM onetime.portal_student_access_state
      WHERE account_key = $1
        AND product_key = $2
        AND learner_key = $3
      ORDER BY updated_at DESC
      LIMIT 1
      FOR UPDATE`,
    [
      input.actor.account_key || input.config.accountKey,
      input.actor.product_key || input.config.productKey,
      input.learner.learner_key,
    ],
  );
  return result.rows[0] as
    | {
        normalized_username?: string | null;
        password_hash_ref?: string | null;
        student_user_ref?: string | null;
      }
    | undefined;
}

async function revokeActiveStudentSessions(
  client: Queryable,
  input: {
    config: Pick<AppConfig, 'accountKey' | 'productKey'>;
    actor: PortalActorContext;
    studentUserRef: string;
    now: Date;
  },
) {
  const result = await client.query(
    `UPDATE onetime.user_sessions
        SET revoked_at = COALESCE(revoked_at, $4)
      WHERE account_key = $1
        AND product_key = $2
        AND user_key = $3
        AND revoked_at IS NULL`,
    [
      input.actor.account_key || input.config.accountKey,
      input.actor.product_key || input.config.productKey,
      input.studentUserRef,
      input.now,
    ],
  );
  return result.rowCount ?? 0;
}

function stateResult(
  operationType: Extract<StudentAccessOperationType, 'suspend' | 'restore'>,
  learner: LearnerProfile,
  sessionsInvalidated: number,
): CredentialLifecycleResult {
  return {
    operation_ref: `student_${operationType}_${digest(
      [learner.learner_key, String(sessionsInvalidated)].join(':'),
    ).slice(0, 24)}`,
    status: operationType === 'suspend' ? 'suspended' : 'active',
    expires_at: null,
    delivery_hint: null,
  };
}

async function mapLifecycleErrors<T>(operation: () => Promise<T>) {
  try {
    return await operation();
  } catch (error) {
    if (error instanceof PortalServiceError) throw error;
    if (error instanceof AccountLifecycleError) {
      throw new PortalServiceError(portalCode(error.code), error.message);
    }
    throw error;
  }
}

function portalCode(code: AccountLifecycleError['code']) {
  if (code === 'FORBIDDEN') return 'FORBIDDEN';
  if (code === 'NOT_FOUND') return 'NOT_FOUND';
  if (code === 'IDEMPOTENCY_CONFLICT') return 'IDEMPOTENCY_CONFLICT';
  if (code === 'RATE_LIMITED') return 'ADAPTER_UNAVAILABLE';
  return 'SERVER_ERROR';
}

function digest(value: string) {
  return createHash('sha256').update(value).digest('hex');
}

function studentPasswordHashRef(input: {
  accountKey: string;
  productKey: string;
  learnerKey: string;
  username: string;
  password: string;
  idempotencyKey: string;
}) {
  const salt = digest(
    [
      'student-password-salt-v1',
      input.accountKey,
      input.productKey,
      input.learnerKey,
      input.username,
      input.idempotencyKey,
    ].join(':'),
  );
  const derived = scryptSync(input.password, salt, 32).toString('base64url');
  return `scrypt:v1:${salt}:${derived}`;
}
