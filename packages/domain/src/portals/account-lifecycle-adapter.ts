import { createHash, scryptSync } from 'node:crypto';
import type { AppConfig } from '../../../config/src/index.ts';
import type { DbPool } from '../../../db/src/index.ts';
import {
  normalizeStudentUsername,
  type LearnerProfile,
  type PortalActorContext,
  type StudentAccessOperationPayload,
} from '../../../contracts/src/portals/index.ts';
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
        return parentManagedCredentialResult('setup', input.config, actor, learner, payload);
      }),
    requestReset: async ({ actor, learner, payload }) =>
      mapLifecycleErrors(async () => {
        return parentManagedCredentialResult('reset', input.config, actor, learner, payload);
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

function parentManagedCredentialResult(
  operationType: Extract<StudentAccessOperationType, 'setup' | 'reset'>,
  config: Pick<AppConfig, 'accountKey' | 'productKey'>,
  actor: PortalActorContext,
  learner: LearnerProfile,
  payload: StudentAccessOperationPayload,
): CredentialLifecycleResult {
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
  const studentUserRef = normalizedUsername
    ? `student_user_${digest(
        [actor.account_key, actor.product_key, learner.learner_key, normalizedUsername].join(':'),
      ).slice(0, 32)}`
    : null;
  const now = new Date().toISOString();
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
    student_user_ref: studentUserRef,
    username_display: normalizedUsername,
    credential_status: 'parent_managed',
    password_hash_ref: hashRef,
    password_version: 1,
    security_version: 1,
    last_reset_at: operationType === 'reset' ? now : null,
  };
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
