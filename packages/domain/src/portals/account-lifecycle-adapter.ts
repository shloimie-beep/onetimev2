import { createHash } from 'node:crypto';
import type { AppConfig } from '../../../config/src/index.ts';
import type { DbPool } from '../../../db/src/index.ts';
import type { LearnerProfile, PortalActorContext } from '../../../contracts/src/portals/index.ts';
import {
  AccountLifecycleError,
  createStudentReset,
  createStudentSetup,
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
        if (!payload.email) {
          throw new PortalServiceError('VALIDATION_ERROR', 'Student email is required for setup.');
        }
        const issued = await createStudentSetup({
          pool: input.pool,
          config: input.config,
          actor: lifecycleActor(actor),
          payload: {
            idempotency_key: payload.idempotency_key,
            household_key: learner.household_key,
            learner_key: learner.learner_key,
            email: payload.email,
            display_name: payload.display_name ?? learner.display_name,
          },
        });
        return issueResult('setup', issued.token_ref, issued.expires_at);
      }),
    requestReset: async ({ actor, learner, payload }) =>
      mapLifecycleErrors(async () => {
        const issued = await createStudentReset({
          pool: input.pool,
          config: input.config,
          actor: lifecycleActor(actor),
          payload: {
            idempotency_key: payload.idempotency_key,
            learner_key: learner.learner_key,
            ...(payload.email ? { email: payload.email } : {}),
          },
        });
        return issueResult('reset', issued.token_ref, issued.expires_at);
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
        };
      }),
  };
}

function lifecycleActor(actor: PortalActorContext) {
  return { userKey: actor.actor_user_ref, role: actor.actor_role };
}

function issueResult(
  operationType: Extract<StudentAccessOperationType, 'setup' | 'reset'>,
  tokenRef: string,
  expiresAt: string,
): CredentialLifecycleResult {
  return {
    operation_ref: `student_${operationType}_${digest(tokenRef).slice(0, 24)}`,
    status: operationType === 'setup' ? 'setup_requested' : 'reset_requested',
    expires_at: expiresAt,
    delivery_hint: 'Local sink delivery queued',
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
