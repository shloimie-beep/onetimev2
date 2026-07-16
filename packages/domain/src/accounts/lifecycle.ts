import { createHash, randomBytes, randomUUID } from 'node:crypto';
import type { AppConfig } from '../../../config/src/index.ts';
import type {
  AccountLifecycleCompletionResult,
  AccountLifecycleDeliverySummary,
  AccountLifecycleErrorCode,
  AccountLifecycleStudentState,
  AccountLifecycleTokenIssueResult,
  AccountLifecycleTokenType,
  ParentActivationPayload,
  TokenCompletionPayload,
} from '../../../contracts/src/accounts/index.ts';
import {
  ownerAdminInvitationPayloadSchema,
  parentActivationPayloadSchema,
  passwordResetRequestPayloadSchema,
  studentResetPayloadSchema,
  studentSetupPayloadSchema,
  tokenCompletionPayloadSchema,
} from '../../../contracts/src/accounts/index.ts';
import type { DbPool, Queryable } from '../../../db/src/index.ts';
import { inTransaction } from '../../../db/src/index.ts';
import { hashPassword } from '../auth/service.ts';
import { normalizeEmail, stableKey } from '../lead/normalize.ts';
import { consumeRateLimitBudgets } from '../security/rate-limit.ts';

export class AccountLifecycleError extends Error {
  readonly code: AccountLifecycleErrorCode;

  constructor(code: AccountLifecycleErrorCode, message: string) {
    super(message);
    this.code = code;
  }
}

type LifecycleActor = {
  userKey: string;
  role: string;
};

type LocalProofOption = {
  includeLocalProofToken?: boolean | undefined;
};

type TokenIssueWithProof = AccountLifecycleTokenIssueResult & {
  token_for_local_proof?: string;
};

type TokenRecord = {
  token_key: string;
  token_type: AccountLifecycleTokenType;
  email_normalized: string | null;
  display_name: string | null;
  target_role: 'owner' | 'admin' | 'parent' | 'student';
  subject_user_key: string | null;
  household_key: string | null;
  relationship_key: string | null;
  learner_key: string | null;
  attempts: number;
  max_attempts: number;
  expires_at: Date;
  consumed_at: Date | null;
  revoked_at: Date | null;
  metadata: Record<string, unknown>;
};

const TOKEN_TTL_MS = 60 * 60 * 1000;
const RESET_TOKEN_TTL_MS = 30 * 60 * 1000;

export async function createOwnerAdminInvitation(
  input: {
    pool: DbPool;
    config: AppConfig;
    actor: LifecycleActor;
    payload: unknown;
    now?: Date;
  } & LocalProofOption,
): Promise<TokenIssueWithProof> {
  const payload = ownerAdminInvitationPayloadSchema.parse(input.payload);
  requireOwnerAdminInvitationActor(input.actor, payload.role);
  return idempotentIssue({
    pool: input.pool,
    config: input.config,
    actorUserKey: input.actor.userKey,
    operationScope: 'owner-admin-invitation',
    idempotencyKey: payload.idempotency_key,
    requestPayload: payload,
    now: input.now ?? new Date(),
    includeLocalProofToken: input.includeLocalProofToken,
    issue: (client, now) =>
      issueAccountToken(client, input.config, {
        tokenType: 'owner_admin_invitation',
        targetRole: payload.role,
        emailNormalized: normalizeEmail(payload.email),
        displayName: payload.display_name,
        idempotencyKey: payload.idempotency_key,
        requestHash: fingerprint(payload),
        actorUserKey: input.actor.userKey,
        now,
        includeLocalProofToken: input.includeLocalProofToken,
      }),
  });
}

export async function acceptOwnerAdminInvitation(input: {
  pool: DbPool;
  config: AppConfig;
  payload: unknown;
  now?: Date;
}): Promise<AccountLifecycleCompletionResult> {
  const payload = tokenCompletionPayloadSchema.parse(input.payload);
  return consumeLifecycleToken(input.pool, input.config, payload, {
    expectedType: 'owner_admin_invitation',
    now: input.now ?? new Date(),
    complete: async (client, token) => {
      const userKey = await upsertAccountUser(client, input.config, {
        emailNormalized: requiredString(token.email_normalized),
        displayName: requiredString(token.display_name),
        role: token.target_role,
        password: payload.password,
        status: 'active',
      });
      await markTokenConsumed(client, token.token_key, input.now ?? new Date(), userKey);
      await audit(client, input.config, {
        actionType: 'owner_admin_invitation_accepted',
        subjectUserKey: userKey,
        tokenKey: token.token_key,
        metadata: { target_role: token.target_role },
      });
      return completion(userKey, token.target_role, 'active', true, 0);
    },
  });
}

export async function createParentActivation(
  input: {
    pool: DbPool;
    config: AppConfig;
    actor: LifecycleActor;
    payload: unknown;
    now?: Date;
  } & LocalProofOption,
): Promise<TokenIssueWithProof> {
  const payload = parentActivationPayloadSchema.parse(input.payload);
  requireOwnerOrAdmin(input.actor);
  return idempotentIssue({
    pool: input.pool,
    config: input.config,
    actorUserKey: input.actor.userKey,
    operationScope: 'parent-activation',
    idempotencyKey: payload.idempotency_key,
    requestPayload: payload,
    now: input.now ?? new Date(),
    includeLocalProofToken: input.includeLocalProofToken,
    issue: async (client, now) => {
      await ensureHousehold(client, input.config, payload.household_key);
      await ensurePendingGuardianRelationship(client, input.config, payload);
      return issueAccountToken(client, input.config, {
        tokenType: 'parent_activation',
        targetRole: 'parent',
        emailNormalized: normalizeEmail(payload.email),
        displayName: payload.display_name,
        householdKey: payload.household_key,
        relationshipKey: payload.relationship_key,
        idempotencyKey: payload.idempotency_key,
        requestHash: fingerprint(payload),
        actorUserKey: input.actor.userKey,
        now,
        includeLocalProofToken: input.includeLocalProofToken,
      });
    },
  });
}

export async function acceptParentActivation(input: {
  pool: DbPool;
  config: AppConfig;
  payload: unknown;
  now?: Date;
}): Promise<AccountLifecycleCompletionResult> {
  const payload = tokenCompletionPayloadSchema.parse(input.payload);
  return consumeLifecycleToken(input.pool, input.config, payload, {
    expectedType: 'parent_activation',
    now: input.now ?? new Date(),
    complete: async (client, token, now) => {
      const userKey = await upsertAccountUser(client, input.config, {
        emailNormalized: requiredString(token.email_normalized),
        displayName: requiredString(token.display_name),
        role: 'parent',
        password: payload.password,
        status: 'active',
      });
      await client.query(
        `UPDATE onetime.portal_guardian_relationships
            SET guardian_user_ref = $5,
                status = 'active',
                version = version + 1,
                updated_at = $6
          WHERE account_key = $1
            AND product_key = $2
            AND household_key = $3
            AND relationship_key = $4`,
        [
          input.config.accountKey,
          input.config.productKey,
          requiredString(token.household_key),
          requiredString(token.relationship_key),
          userKey,
          now,
        ],
      );
      await markTokenConsumed(client, token.token_key, now, userKey);
      await audit(client, input.config, {
        actionType: 'parent_activation_accepted',
        subjectUserKey: userKey,
        tokenKey: token.token_key,
        metadata: { household_key: token.household_key, relationship_key: token.relationship_key },
      });
      return completion(userKey, 'parent', 'active', false, 0);
    },
  });
}

export async function createStudentSetup(
  input: {
    pool: DbPool;
    config: AppConfig;
    actor: LifecycleActor;
    payload: unknown;
    now?: Date;
  } & LocalProofOption,
): Promise<TokenIssueWithProof> {
  const payload = studentSetupPayloadSchema.parse(input.payload);
  requireParentOrOwnerAdmin(input.actor);
  return idempotentIssue({
    pool: input.pool,
    config: input.config,
    actorUserKey: input.actor.userKey,
    operationScope: 'student-setup',
    idempotencyKey: payload.idempotency_key,
    requestPayload: payload,
    now: input.now ?? new Date(),
    includeLocalProofToken: input.includeLocalProofToken,
    issue: async (client, now) => {
      await ensureLearner(client, input.config, payload.household_key, payload.learner_key);
      await client.query(
        `UPDATE onetime.portal_student_access_state
            SET status = 'setup_requested',
                last_operation_type = 'setup',
                last_operation_at = $5,
                version = version + 1,
                updated_at = $5
          WHERE account_key = $1
            AND product_key = $2
            AND household_key = $3
            AND learner_key = $4`,
        [
          input.config.accountKey,
          input.config.productKey,
          payload.household_key,
          payload.learner_key,
          now,
        ],
      );
      return issueAccountToken(client, input.config, {
        tokenType: 'student_setup',
        targetRole: 'student',
        emailNormalized: normalizeEmail(payload.email),
        displayName: payload.display_name,
        householdKey: payload.household_key,
        learnerKey: payload.learner_key,
        idempotencyKey: payload.idempotency_key,
        requestHash: fingerprint(payload),
        actorUserKey: input.actor.userKey,
        now,
        includeLocalProofToken: input.includeLocalProofToken,
      });
    },
  });
}

export async function acceptStudentSetup(input: {
  pool: DbPool;
  config: AppConfig;
  payload: unknown;
  now?: Date;
}): Promise<AccountLifecycleCompletionResult> {
  const payload = tokenCompletionPayloadSchema.parse(input.payload);
  return consumeLifecycleToken(input.pool, input.config, payload, {
    expectedType: 'student_setup',
    now: input.now ?? new Date(),
    complete: async (client, token, now) => {
      const userKey = await upsertAccountUser(client, input.config, {
        emailNormalized: requiredString(token.email_normalized),
        displayName: requiredString(token.display_name),
        role: 'student',
        password: payload.password,
        status: 'active',
      });
      await activateStudentIdentity(client, input.config, token, userKey, now);
      await markTokenConsumed(client, token.token_key, now, userKey);
      await audit(client, input.config, {
        actionType: 'student_setup_accepted',
        subjectUserKey: userKey,
        tokenKey: token.token_key,
        metadata: { learner_key: token.learner_key },
      });
      return completion(userKey, 'student', 'active', false, 0);
    },
  });
}

export async function createStudentReset(
  input: {
    pool: DbPool;
    config: AppConfig;
    actor: LifecycleActor;
    payload: unknown;
    now?: Date;
  } & LocalProofOption,
): Promise<TokenIssueWithProof> {
  const payload = studentResetPayloadSchema.parse(input.payload);
  requireParentOrOwnerAdmin(input.actor);
  return idempotentIssue({
    pool: input.pool,
    config: input.config,
    actorUserKey: input.actor.userKey,
    operationScope: 'student-reset',
    idempotencyKey: payload.idempotency_key,
    requestPayload: payload,
    now: input.now ?? new Date(),
    includeLocalProofToken: input.includeLocalProofToken,
    issue: async (client, now) => {
      const state = await getStudentStateForUpdate(client, input.config, payload.learner_key);
      if (!state?.student_user_ref) {
        throw new AccountLifecycleError('NOT_FOUND', 'Student access is not active yet.');
      }
      const studentUserKey = String(state.student_user_ref);
      const user = await getAccountUser(client, input.config, studentUserKey);
      return issueAccountToken(client, input.config, {
        tokenType: 'student_reset',
        targetRole: 'student',
        emailNormalized: normalizeEmail(payload.email ?? String(user.email_normalized)),
        displayName: String(user.display_name),
        subjectUserKey: studentUserKey,
        householdKey: String(state.household_key),
        learnerKey: payload.learner_key,
        idempotencyKey: payload.idempotency_key,
        requestHash: fingerprint(payload),
        actorUserKey: input.actor.userKey,
        now,
        ttlMs: RESET_TOKEN_TTL_MS,
        includeLocalProofToken: input.includeLocalProofToken,
      });
    },
  });
}

export async function completeStudentReset(input: {
  pool: DbPool;
  config: AppConfig;
  payload: unknown;
  now?: Date;
}): Promise<AccountLifecycleCompletionResult> {
  const payload = tokenCompletionPayloadSchema.parse(input.payload);
  return consumeLifecycleToken(input.pool, input.config, payload, {
    expectedType: 'student_reset',
    now: input.now ?? new Date(),
    complete: async (client, token, now) => {
      const userKey = requiredString(token.subject_user_key);
      await updatePassword(client, userKey, payload.password, now);
      const sessionsInvalidated = await invalidateUserSessions(client, input.config, {
        userKey,
        actorUserKey: null,
        reason: 'student_password_reset',
        now,
      });
      await markTokenConsumed(client, token.token_key, now, userKey);
      await client.query(
        `UPDATE onetime.portal_student_access_state
            SET status = 'active',
                last_operation_type = 'reset',
                last_operation_at = $4,
                version = version + 1,
                updated_at = $4
          WHERE account_key = $1
            AND product_key = $2
            AND learner_key = $3`,
        [input.config.accountKey, input.config.productKey, token.learner_key, now],
      );
      return completion(userKey, 'student', 'active', false, sessionsInvalidated);
    },
  });
}

export async function requestPasswordReset(
  input: {
    pool: DbPool;
    config: AppConfig;
    payload: unknown;
    now?: Date;
  } & LocalProofOption,
): Promise<TokenIssueWithProof | { request_accepted: true }> {
  const payload = passwordResetRequestPayloadSchema.parse(input.payload);
  const now = input.now ?? new Date();
  const emailNormalized = normalizeEmail(payload.email);
  const rateLimit = await consumeRateLimitBudgets({
    pool: input.pool,
    config: input.config,
    now,
    budgets: [
      {
        scope: 'account_password_reset_email',
        subject: stableKey('email', [emailNormalized]),
        limit: 5,
        windowMs: 60 * 60 * 1000,
      },
    ],
  });
  if (!rateLimit.allowed) {
    throw new AccountLifecycleError('RATE_LIMITED', 'Password reset requests are rate limited.');
  }
  return inTransaction(input.pool, async (client) => {
    const user = await findAccountUserByEmail(client, input.config, emailNormalized);
    if (!user) {
      await audit(client, input.config, {
        actionType: 'password_reset_requested_unknown',
        metadata: { email_digest: digest(emailNormalized) },
      });
      return { request_accepted: true as const };
    }
    return issueAccountToken(client, input.config, {
      tokenType: 'password_reset',
      targetRole: lifecycleRoleFromUserRole(String(user.role)),
      emailNormalized,
      displayName: String(user.display_name),
      subjectUserKey: String(user.user_key),
      idempotencyKey: payload.idempotency_key,
      requestHash: fingerprint(payload),
      actorUserKey: null,
      now,
      ttlMs: RESET_TOKEN_TTL_MS,
      includeLocalProofToken: input.includeLocalProofToken,
    });
  });
}

export async function completePasswordReset(input: {
  pool: DbPool;
  config: AppConfig;
  payload: unknown;
  now?: Date;
}): Promise<AccountLifecycleCompletionResult> {
  const payload = tokenCompletionPayloadSchema.parse(input.payload);
  return consumeLifecycleToken(input.pool, input.config, payload, {
    expectedType: 'password_reset',
    now: input.now ?? new Date(),
    complete: async (client, token, now) => {
      const userKey = requiredString(token.subject_user_key);
      const user = await getAccountUser(client, input.config, userKey);
      await updatePassword(client, userKey, payload.password, now);
      const sessionsInvalidated = await invalidateUserSessions(client, input.config, {
        userKey,
        actorUserKey: null,
        reason: 'password_reset',
        now,
      });
      await markTokenConsumed(client, token.token_key, now, userKey);
      return completion(
        userKey,
        lifecycleRoleFromUserRole(String(user.role)),
        'active',
        ['owner', 'admin'].includes(String(user.role)),
        sessionsInvalidated,
      );
    },
  });
}

export async function suspendStudentIdentity(input: {
  pool: DbPool;
  config: AppConfig;
  actor: LifecycleActor;
  learnerKey: string;
  now?: Date;
}): Promise<AccountLifecycleStudentState> {
  requireParentOrOwnerAdmin(input.actor);
  return setStudentIdentityState(input.pool, input.config, {
    actorUserKey: input.actor.userKey,
    learnerKey: input.learnerKey,
    status: 'suspended',
    linkState: 'suspended',
    reason: 'student_access_suspended',
    now: input.now ?? new Date(),
  });
}

export async function restoreStudentIdentity(input: {
  pool: DbPool;
  config: AppConfig;
  actor: LifecycleActor;
  learnerKey: string;
  now?: Date;
}): Promise<AccountLifecycleStudentState> {
  requireParentOrOwnerAdmin(input.actor);
  return setStudentIdentityState(input.pool, input.config, {
    actorUserKey: input.actor.userKey,
    learnerKey: input.learnerKey,
    status: 'active',
    linkState: 'active',
    reason: 'student_access_restored',
    now: input.now ?? new Date(),
  });
}

export async function revokeStudentIdentitySessions(input: {
  pool: DbPool;
  config: AppConfig;
  actor: LifecycleActor;
  learnerKey: string;
  now?: Date;
}): Promise<AccountLifecycleStudentState> {
  requireParentOrOwnerAdmin(input.actor);
  const now = input.now ?? new Date();
  return inTransaction(input.pool, async (client) => {
    const state = await getStudentStateForUpdate(client, input.config, input.learnerKey);
    if (!state?.student_user_ref) {
      throw new AccountLifecycleError('NOT_FOUND', 'Student access is not active yet.');
    }
    const studentUserKey = String(state.student_user_ref);
    const sessionsInvalidated = await invalidateUserSessions(client, input.config, {
      userKey: studentUserKey,
      actorUserKey: input.actor.userKey,
      reason: 'student_sessions_revoked',
      now,
    });
    await client.query(
      `UPDATE onetime.portal_student_access_state
          SET last_operation_type = 'revoke_sessions',
              last_operation_at = $4,
              version = version + 1,
              updated_at = $4
        WHERE account_key = $1
          AND product_key = $2
          AND learner_key = $3`,
      [input.config.accountKey, input.config.productKey, input.learnerKey, now],
    );
    await audit(client, input.config, {
      actionType: 'student_sessions_revoked',
      actorUserKey: input.actor.userKey,
      subjectUserKey: studentUserKey,
      metadata: { learner_key: input.learnerKey, sessions_invalidated: sessionsInvalidated },
    });
    return {
      learner_key: input.learnerKey,
      user_key: studentUserKey,
      access_status: state.status as AccountLifecycleStudentState['access_status'],
      sessions_invalidated: sessionsInvalidated,
    };
  });
}

async function idempotentIssue(input: {
  pool: DbPool;
  config: AppConfig;
  actorUserKey: string;
  operationScope: string;
  idempotencyKey: string;
  requestPayload: unknown;
  now: Date;
  includeLocalProofToken?: boolean | undefined;
  issue(client: Queryable, now: Date): Promise<TokenIssueWithProof>;
}) {
  const requestHash = fingerprint(input.requestPayload);
  return inTransaction(input.pool, async (client) => {
    const replay = await readLifecycleIdempotency<TokenIssueWithProof>(
      client,
      input.config,
      input.actorUserKey,
      input.operationScope,
      input.idempotencyKey,
      requestHash,
    );
    if (replay) return replay;
    const issued = await input.issue(client, input.now);
    await writeLifecycleIdempotency(
      client,
      input.config,
      input.actorUserKey,
      input.operationScope,
      input.idempotencyKey,
      requestHash,
      withoutLocalProofToken(issued),
    );
    return input.includeLocalProofToken ? issued : withoutLocalProofToken(issued);
  });
}

async function issueAccountToken(
  client: Queryable,
  config: AppConfig,
  input: {
    tokenType: AccountLifecycleTokenType;
    targetRole: 'owner' | 'admin' | 'parent' | 'student';
    emailNormalized: string;
    displayName: string;
    idempotencyKey: string;
    requestHash: string;
    actorUserKey: string | null;
    now: Date;
    ttlMs?: number;
    subjectUserKey?: string | null;
    householdKey?: string | null;
    relationshipKey?: string | null;
    learnerKey?: string | null;
    includeLocalProofToken?: boolean | undefined;
  },
): Promise<TokenIssueWithProof> {
  const token = randomToken();
  const tokenKey = stableKey('account_lifecycle_token', [
    config.accountKey,
    config.productKey,
    input.tokenType,
    input.idempotencyKey,
  ]);
  const tokenHash = digest(token);
  const expiresAt = new Date(input.now.getTime() + (input.ttlMs ?? TOKEN_TTL_MS));
  await client.query(
    `INSERT INTO onetime.account_lifecycle_tokens
       (token_key, account_key, product_key, token_type, token_hash, email_normalized,
        display_name, target_role, subject_user_key, household_key, relationship_key,
        learner_key, expires_at, created_by_user_key, metadata, created_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15::jsonb,$16)`,
    [
      tokenKey,
      config.accountKey,
      config.productKey,
      input.tokenType,
      tokenHash,
      input.emailNormalized,
      input.displayName,
      input.targetRole,
      input.subjectUserKey ?? null,
      input.householdKey ?? null,
      input.relationshipKey ?? null,
      input.learnerKey ?? null,
      expiresAt,
      input.actorUserKey,
      JSON.stringify({ raw_token_included: false }),
      input.now,
    ],
  );
  const delivery = await createDeliveryIntent(client, config, {
    tokenKey,
    tokenType: input.tokenType,
    recipientEmail: input.emailNormalized,
    targetRole: input.targetRole,
    idempotencyKey: input.idempotencyKey,
    requestHash: input.requestHash,
    now: input.now,
    householdKey: input.householdKey ?? null,
    learnerKey: input.learnerKey ?? null,
  });
  await audit(client, config, {
    actionType: `${input.tokenType}_issued`,
    actorUserKey: input.actorUserKey,
    subjectUserKey: input.subjectUserKey ?? null,
    tokenKey,
    metadata: {
      target_role: input.targetRole,
      token_ref: tokenRef(tokenKey),
      raw_token_included: false,
      external_send_performed: false,
    },
  });
  const result: TokenIssueWithProof = {
    token_key: tokenKey,
    token_type: input.tokenType,
    target_role: input.targetRole,
    expires_at: expiresAt.toISOString(),
    delivery,
    token_ref: tokenRef(tokenKey),
    raw_token_included: false,
  };
  if (input.includeLocalProofToken) {
    result.token_for_local_proof = token;
  }
  return result;
}

async function createDeliveryIntent(
  client: Queryable,
  config: AppConfig,
  input: {
    tokenKey: string;
    tokenType: AccountLifecycleTokenType;
    recipientEmail: string | null;
    targetRole: string;
    idempotencyKey: string;
    requestHash: string;
    now: Date;
    householdKey: string | null;
    learnerKey: string | null;
  },
): Promise<AccountLifecycleDeliverySummary> {
  const intentKey = stableKey('account_lifecycle_delivery', [
    input.tokenKey,
    input.tokenType,
    input.idempotencyKey,
  ]);
  await client.query(
    `INSERT INTO onetime.account_lifecycle_delivery_intents
       (intent_key, account_key, product_key, token_key, intent_type, channel,
        recipient_email, delivery_state, idempotency_key, request_hash, payload, created_at)
     VALUES ($1,$2,$3,$4,$5,'email',$6,'sink_queued',$7,$8,$9::jsonb,$10)`,
    [
      intentKey,
      config.accountKey,
      config.productKey,
      input.tokenKey,
      input.tokenType,
      input.recipientEmail,
      input.idempotencyKey,
      input.requestHash,
      JSON.stringify({
        policy_version: 'ot71-account-lifecycle-v1',
        token_type: input.tokenType,
        token_ref: tokenRef(input.tokenKey),
        target_role: input.targetRole,
        household_key: input.householdKey,
        learner_key: input.learnerKey,
        raw_token_included: false,
        external_send_performed: false,
      }),
      input.now,
    ],
  );
  return {
    intent_key: intentKey,
    delivery_state: 'sink_queued',
    external_send_performed: false,
    raw_token_included: false,
  };
}

async function consumeLifecycleToken<T>(
  pool: DbPool,
  config: AppConfig,
  payload: TokenCompletionPayload,
  options: {
    expectedType: AccountLifecycleTokenType;
    now: Date;
    complete(client: Queryable, token: TokenRecord, now: Date): Promise<T>;
  },
): Promise<T> {
  return inTransaction(pool, async (client) => {
    const token = await findTokenForUpdate(client, config, payload.token, options.expectedType);
    assertTokenUsable(token, options.now);
    return options.complete(client, token, options.now);
  });
}

async function findTokenForUpdate(
  client: Queryable,
  config: AppConfig,
  token: string,
  expectedType: AccountLifecycleTokenType,
): Promise<TokenRecord> {
  const result = await client.query(
    `SELECT *
       FROM onetime.account_lifecycle_tokens
      WHERE account_key = $1
        AND product_key = $2
        AND token_type = $3
        AND token_hash = $4
      FOR UPDATE`,
    [config.accountKey, config.productKey, expectedType, digest(token)],
  );
  const row = result.rows[0] as Record<string, unknown> | undefined;
  if (!row) {
    throw new AccountLifecycleError('TOKEN_INVALID', 'The account lifecycle token is invalid.');
  }
  return mapToken(row);
}

function assertTokenUsable(token: TokenRecord, now: Date) {
  if (token.consumed_at) {
    throw new AccountLifecycleError(
      'TOKEN_CONSUMED',
      'The account lifecycle token was already used.',
    );
  }
  if (token.revoked_at) {
    throw new AccountLifecycleError(
      'TOKEN_INVALID',
      'The account lifecycle token is no longer valid.',
    );
  }
  if (token.attempts >= token.max_attempts) {
    throw new AccountLifecycleError('TOKEN_INVALID', 'The account lifecycle token is locked.');
  }
  if (token.expires_at <= now) {
    throw new AccountLifecycleError('TOKEN_EXPIRED', 'The account lifecycle token expired.');
  }
}

async function upsertAccountUser(
  client: Queryable,
  config: AppConfig,
  input: {
    emailNormalized: string;
    displayName: string;
    role: string;
    password: string;
    status: 'active' | 'disabled';
  },
) {
  const userKey = stableKey('user', [config.accountKey, config.productKey, input.emailNormalized]);
  await client.query(
    `INSERT INTO onetime.account_users
       (user_key, account_key, product_key, email_normalized, display_name, role,
        password_hash, mfa_capable, status)
     VALUES ($1,$2,$3,$4,$5,$6,$7,false,$8)
     ON CONFLICT (account_key, product_key, email_normalized)
     DO UPDATE SET
       display_name = EXCLUDED.display_name,
       role = EXCLUDED.role,
       password_hash = EXCLUDED.password_hash,
       password_updated_at = now(),
       status = EXCLUDED.status,
       security_version = onetime.account_users.security_version + 1,
       security_policy_updated_at = now(),
       updated_at = now()`,
    [
      userKey,
      config.accountKey,
      config.productKey,
      input.emailNormalized,
      input.displayName.trim(),
      input.role,
      hashPassword(input.password),
      input.status,
    ],
  );
  return userKey;
}

async function activateStudentIdentity(
  client: Queryable,
  config: AppConfig,
  token: TokenRecord,
  userKey: string,
  now: Date,
) {
  const householdKey = requiredString(token.household_key);
  const learnerKey = requiredString(token.learner_key);
  await client.query(
    `UPDATE onetime.portal_student_access_state
        SET student_user_ref = $5,
            status = 'active',
            last_operation_type = 'setup',
            last_operation_at = $6,
            version = version + 1,
            updated_at = $6
      WHERE account_key = $1
        AND product_key = $2
        AND household_key = $3
        AND learner_key = $4`,
    [config.accountKey, config.productKey, householdKey, learnerKey, userKey, now],
  );
  await client.query(
    `INSERT INTO onetime.account_learner_identity_links
       (link_key, account_key, product_key, household_key, learner_key, user_key, link_state, created_at)
     VALUES ($1,$2,$3,$4,$5,$6,'active',$7)
     ON CONFLICT (account_key, product_key, learner_key)
     DO UPDATE SET user_key = EXCLUDED.user_key, link_state = 'active',
                   suspended_at = NULL, disabled_at = NULL`,
    [
      stableKey('account_learner_link', [config.accountKey, config.productKey, learnerKey]),
      config.accountKey,
      config.productKey,
      householdKey,
      learnerKey,
      userKey,
      now,
    ],
  );
}

async function setStudentIdentityState(
  pool: DbPool,
  config: AppConfig,
  input: {
    actorUserKey: string;
    learnerKey: string;
    status: 'active' | 'suspended';
    linkState: 'active' | 'suspended';
    reason: string;
    now: Date;
  },
): Promise<AccountLifecycleStudentState> {
  return inTransaction(pool, async (client) => {
    const state = await getStudentStateForUpdate(client, config, input.learnerKey);
    if (!state?.student_user_ref) {
      throw new AccountLifecycleError('NOT_FOUND', 'Student access is not active yet.');
    }
    const studentUserKey = String(state.student_user_ref);
    const sessionsInvalidated =
      input.status === 'suspended'
        ? await invalidateUserSessions(client, config, {
            userKey: studentUserKey,
            actorUserKey: input.actorUserKey,
            reason: input.reason,
            now: input.now,
          })
        : 0;
    await client.query(
      `UPDATE onetime.account_users
          SET status = $4,
              security_version = CASE WHEN $4 = 'disabled' THEN security_version + 1 ELSE security_version END,
              security_policy_updated_at = $5,
              updated_at = $5
        WHERE account_key = $1
          AND product_key = $2
          AND user_key = $3`,
      [
        config.accountKey,
        config.productKey,
        studentUserKey,
        input.status === 'suspended' ? 'disabled' : 'active',
        input.now,
      ],
    );
    await client.query(
      `UPDATE onetime.portal_student_access_state
          SET status = $4,
              last_operation_type = $5,
              last_operation_at = $6,
              version = version + 1,
              updated_at = $6
        WHERE account_key = $1
          AND product_key = $2
          AND learner_key = $3`,
      [
        config.accountKey,
        config.productKey,
        input.learnerKey,
        input.status,
        input.status === 'suspended' ? 'suspend' : 'restore',
        input.now,
      ],
    );
    await client.query(
      `UPDATE onetime.account_learner_identity_links
          SET link_state = $4,
              suspended_at = CASE WHEN $4 = 'suspended' THEN $5 ELSE NULL END
        WHERE account_key = $1
          AND product_key = $2
          AND learner_key = $3`,
      [config.accountKey, config.productKey, input.learnerKey, input.linkState, input.now],
    );
    await audit(client, config, {
      actionType: input.reason,
      actorUserKey: input.actorUserKey,
      subjectUserKey: studentUserKey,
      metadata: { learner_key: input.learnerKey, sessions_invalidated: sessionsInvalidated },
    });
    return {
      learner_key: input.learnerKey,
      user_key: studentUserKey,
      access_status: input.status,
      sessions_invalidated: sessionsInvalidated,
    };
  });
}

async function invalidateUserSessions(
  client: Queryable,
  config: AppConfig,
  input: { userKey: string; actorUserKey: string | null; reason: string; now: Date },
) {
  const existing = await client.query(
    `SELECT count(*)::int AS count
       FROM onetime.user_sessions
      WHERE account_key = $1
        AND product_key = $2
        AND user_key = $3
        AND revoked_at IS NULL`,
    [config.accountKey, config.productKey, input.userKey],
  );
  const revokedCount = Number(existing.rows[0]?.count ?? 0);
  await client.query(
    `UPDATE onetime.user_sessions
        SET revoked_at = COALESCE(revoked_at, $4)
      WHERE account_key = $1
        AND product_key = $2
        AND user_key = $3
        AND revoked_at IS NULL`,
    [config.accountKey, config.productKey, input.userKey, input.now],
  );
  const updated = await client.query(
    `UPDATE onetime.account_users
        SET security_version = security_version + 1,
            security_policy_updated_at = $4,
            updated_at = $4
      WHERE account_key = $1
        AND product_key = $2
        AND user_key = $3
      RETURNING security_version`,
    [config.accountKey, config.productKey, input.userKey, input.now],
  );
  await client.query(
    `INSERT INTO onetime.account_lifecycle_session_invalidations
       (invalidation_key, account_key, product_key, user_key, reason, revoked_session_count,
        security_version_after, actor_user_key, created_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
    [
      stableKey('session_invalidation', [
        config.accountKey,
        config.productKey,
        input.userKey,
        input.reason,
        input.now.toISOString(),
      ]),
      config.accountKey,
      config.productKey,
      input.userKey,
      input.reason,
      revokedCount,
      Number(updated.rows[0]?.security_version ?? 1),
      input.actorUserKey,
      input.now,
    ],
  );
  return revokedCount;
}

async function updatePassword(client: Queryable, userKey: string, password: string, now: Date) {
  await client.query(
    `UPDATE onetime.account_users
        SET password_hash = $2,
            password_updated_at = $3,
            updated_at = $3
      WHERE user_key = $1`,
    [userKey, hashPassword(password), now],
  );
}

async function markTokenConsumed(
  client: Queryable,
  tokenKey: string,
  now: Date,
  subjectUserKey: string,
) {
  await client.query(
    `UPDATE onetime.account_lifecycle_tokens
        SET consumed_at = $2,
            subject_user_key = COALESCE(subject_user_key, $3)
      WHERE token_key = $1`,
    [tokenKey, now, subjectUserKey],
  );
}

async function readLifecycleIdempotency<T>(
  client: Queryable,
  config: AppConfig,
  actorUserKey: string,
  operationScope: string,
  idempotencyKey: string,
  requestHash: string,
) {
  const existing = await client.query(
    `SELECT request_hash, response_json
       FROM onetime.account_lifecycle_idempotency_records
      WHERE account_key = $1
        AND product_key = $2
        AND actor_user_key = $3
        AND operation_scope = $4
        AND idempotency_key = $5
      FOR UPDATE`,
    [config.accountKey, config.productKey, actorUserKey, operationScope, idempotencyKey],
  );
  const row = existing.rows[0] as Record<string, unknown> | undefined;
  if (!row) return null;
  if (String(row.request_hash) !== requestHash) {
    throw new AccountLifecycleError(
      'IDEMPOTENCY_CONFLICT',
      'This account lifecycle request key was already used for different information.',
    );
  }
  return row.response_json as T;
}

async function writeLifecycleIdempotency(
  client: Queryable,
  config: AppConfig,
  actorUserKey: string,
  operationScope: string,
  idempotencyKey: string,
  requestHash: string,
  response: unknown,
) {
  await client.query(
    `INSERT INTO onetime.account_lifecycle_idempotency_records
       (account_key, product_key, actor_user_key, operation_scope, idempotency_key,
        request_hash, response_json)
     VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb)`,
    [
      config.accountKey,
      config.productKey,
      actorUserKey,
      operationScope,
      idempotencyKey,
      requestHash,
      JSON.stringify(response),
    ],
  );
}

async function ensureHousehold(client: Queryable, config: AppConfig, householdKey: string) {
  const result = await client.query(
    `SELECT 1
       FROM onetime.portal_households
      WHERE account_key = $1
        AND product_key = $2
        AND household_key = $3
        AND status = 'active'
      LIMIT 1`,
    [config.accountKey, config.productKey, householdKey],
  );
  if (!result.rowCount) {
    throw new AccountLifecycleError('NOT_FOUND', 'The household was not found.');
  }
}

async function ensurePendingGuardianRelationship(
  client: Queryable,
  config: AppConfig,
  payload: ParentActivationPayload,
) {
  await client.query(
    `INSERT INTO onetime.portal_guardian_relationships
       (relationship_key, account_key, product_key, household_key, guardian_user_ref,
        relationship_label, authority, status)
     VALUES ($1,$2,$3,$4,$5,$6,$7,'active')
     ON CONFLICT (account_key, product_key, household_key, relationship_key)
     DO UPDATE SET relationship_label = EXCLUDED.relationship_label,
                   authority = EXCLUDED.authority,
                   updated_at = now()`,
    [
      payload.relationship_key,
      config.accountKey,
      config.productKey,
      payload.household_key,
      `pending_parent_${payload.relationship_key}`,
      payload.relationship_label,
      payload.authority,
    ],
  );
}

async function ensureLearner(
  client: Queryable,
  config: AppConfig,
  householdKey: string,
  learnerKey: string,
) {
  const result = await client.query(
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
  if (!result.rowCount) {
    throw new AccountLifecycleError('NOT_FOUND', 'The learner was not found.');
  }
}

async function getStudentStateForUpdate(client: Queryable, config: AppConfig, learnerKey: string) {
  const result = await client.query(
    `SELECT access_state.*, learners.household_key
       FROM onetime.portal_student_access_state AS access_state
       JOIN onetime.portal_learners AS learners
         ON learners.account_key = access_state.account_key
        AND learners.product_key = access_state.product_key
        AND learners.learner_key = access_state.learner_key
      WHERE access_state.account_key = $1
        AND access_state.product_key = $2
        AND access_state.learner_key = $3
      LIMIT 1
      FOR UPDATE`,
    [config.accountKey, config.productKey, learnerKey],
  );
  return result.rows[0] as Record<string, unknown> | undefined;
}

async function getAccountUser(client: Queryable, config: AppConfig, userKey: string) {
  const result = await client.query(
    `SELECT user_key, email_normalized, display_name, role, status
       FROM onetime.account_users
      WHERE account_key = $1
        AND product_key = $2
        AND user_key = $3
      LIMIT 1`,
    [config.accountKey, config.productKey, userKey],
  );
  const row = result.rows[0] as Record<string, unknown> | undefined;
  if (!row) throw new AccountLifecycleError('NOT_FOUND', 'The account user was not found.');
  return row;
}

async function findAccountUserByEmail(
  client: Queryable,
  config: AppConfig,
  emailNormalized: string,
) {
  const result = await client.query(
    `SELECT user_key, email_normalized, display_name, role, status
       FROM onetime.account_users
      WHERE account_key = $1
        AND product_key = $2
        AND email_normalized = $3
      LIMIT 1`,
    [config.accountKey, config.productKey, emailNormalized],
  );
  return result.rows[0] as Record<string, unknown> | undefined;
}

async function audit(
  client: Queryable,
  config: AppConfig,
  input: {
    actionType: string;
    actorUserKey?: string | null;
    subjectUserKey?: string | null;
    tokenKey?: string | null;
    success?: boolean;
    reason?: string | null;
    metadata?: Record<string, unknown>;
  },
) {
  await client.query(
    `INSERT INTO onetime.account_lifecycle_audit_events
       (audit_key, account_key, product_key, actor_user_key, subject_user_key,
        token_key, action_type, success, reason, metadata)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10::jsonb)`,
    [
      stableKey('account_lifecycle_audit', [
        config.accountKey,
        config.productKey,
        input.actionType,
        randomUUID(),
      ]),
      config.accountKey,
      config.productKey,
      input.actorUserKey ?? null,
      input.subjectUserKey ?? null,
      input.tokenKey ?? null,
      input.actionType,
      input.success ?? true,
      input.reason ?? null,
      JSON.stringify(input.metadata ?? {}),
    ],
  );
}

function completion(
  userKey: string,
  role: AccountLifecycleCompletionResult['role'],
  status: AccountLifecycleCompletionResult['status'],
  mfaRequired: boolean,
  sessionsInvalidated: number,
): AccountLifecycleCompletionResult {
  return {
    user_key: userKey,
    role,
    status,
    mfa_required: mfaRequired,
    sessions_invalidated: sessionsInvalidated,
  };
}

function withoutLocalProofToken(result: TokenIssueWithProof): TokenIssueWithProof {
  const safe = { ...result };
  delete safe.token_for_local_proof;
  return safe;
}

function mapToken(row: Record<string, unknown>): TokenRecord {
  return {
    token_key: String(row.token_key),
    token_type: row.token_type as AccountLifecycleTokenType,
    email_normalized: nullableString(row.email_normalized),
    display_name: nullableString(row.display_name),
    target_role: row.target_role as TokenRecord['target_role'],
    subject_user_key: nullableString(row.subject_user_key),
    household_key: nullableString(row.household_key),
    relationship_key: nullableString(row.relationship_key),
    learner_key: nullableString(row.learner_key),
    attempts: Number(row.attempts),
    max_attempts: Number(row.max_attempts),
    expires_at: asDate(row.expires_at),
    consumed_at: nullableDate(row.consumed_at),
    revoked_at: nullableDate(row.revoked_at),
    metadata: recordValue(row.metadata),
  };
}

function requireOwnerAdminInvitationActor(actor: LifecycleActor, targetRole: 'owner' | 'admin') {
  if (actor.role !== 'owner' && actor.role !== 'admin') {
    throw new AccountLifecycleError('FORBIDDEN', 'Only owner/admin users can invite staff.');
  }
  if (targetRole === 'owner' && actor.role !== 'owner') {
    throw new AccountLifecycleError('FORBIDDEN', 'Only an owner can invite another owner.');
  }
}

function requireOwnerOrAdmin(actor: LifecycleActor) {
  if (actor.role !== 'owner' && actor.role !== 'admin') {
    throw new AccountLifecycleError('FORBIDDEN', 'This lifecycle action requires owner/admin.');
  }
}

function requireParentOrOwnerAdmin(actor: LifecycleActor) {
  if (!['parent', 'owner', 'admin'].includes(actor.role)) {
    throw new AccountLifecycleError(
      'FORBIDDEN',
      'This student lifecycle action requires a parent or owner/admin.',
    );
  }
}

function lifecycleRoleFromUserRole(role: string): 'owner' | 'admin' | 'parent' | 'student' {
  if (role === 'owner') return 'owner';
  if (role === 'admin') return 'admin';
  if (role === 'student') return 'student';
  return 'parent';
}

function requiredString(value: string | null) {
  if (!value) throw new AccountLifecycleError('SERVER_ERROR', 'Missing lifecycle token subject.');
  return value;
}

function randomToken() {
  return randomBytes(32).toString('base64url');
}

function tokenRef(tokenKey: string) {
  return stableKey('account_lifecycle_token_ref', [tokenKey]);
}

function fingerprint(value: unknown) {
  return digest(JSON.stringify(sortForHash(value)));
}

function sortForHash(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortForHash);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, entry]) => [key, sortForHash(entry)]),
    );
  }
  return value;
}

function digest(value: string) {
  return createHash('sha256').update(value).digest('hex');
}

function asDate(value: unknown) {
  if (value instanceof Date) return value;
  const parsed = new Date(String(value));
  if (Number.isNaN(parsed.getTime())) throw new AccountLifecycleError('SERVER_ERROR', 'Bad date.');
  return parsed;
}

function nullableDate(value: unknown) {
  if (!value) return null;
  return asDate(value);
}

function nullableString(value: unknown) {
  if (typeof value === 'string' && value.length > 0) return value;
  return null;
}

function recordValue(value: unknown) {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return {};
}
