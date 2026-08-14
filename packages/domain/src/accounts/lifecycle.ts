import { createHash, randomBytes, randomUUID, scryptSync } from 'node:crypto';
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
  studentTokenCompletionPayloadSchema,
  tokenCompletionPayloadSchema,
} from '../../../contracts/src/accounts/index.ts';
import type { DbPool, Queryable } from '../../../db/src/index.ts';
import { inTransaction } from '../../../db/src/index.ts';
import { hashPassword } from '../auth/service.ts';
import { hashAuthPassword } from '../auth/policy.ts';
import { isStudentPin } from '../../../contracts/src/identity/auth/index.ts';
import { applyHouseholdAccessStateWithClient } from '../access/service.ts';
import { normalizeEmail, stableKey } from '../lead/normalize.ts';
import { consumeRateLimitBudgets } from '../security/rate-limit.ts';
import { enqueueHighLevelEventForAdultEmail } from '../highlevel/producer.ts';
import {
  controllerDualRoleProvisionAuditKey,
  controllerDualRoleProvisionAuditMetadata,
  controllerDualRoleProvisioningIdentityKeys,
  controllerDualRoleSetupIdempotencyKey,
  isControllerDualRoleProvisioningSyntheticTestFixture,
  isControllerDualRoleProvisioningTarget,
} from './controller-dual-role-provisioning-policy.ts';
import { createLifecycleDeliveryOutbox } from './lifecycle-delivery.ts';

function assertStudentPin(password: string) {
  if (!isStudentPin(password)) {
    throw new AccountLifecycleError(
      'FORBIDDEN',
      'Student credentials must contain exactly six numeric digits.',
    );
  }
}

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

export type AccountLifecycleTokenInspection =
  | {
      ok: true;
      token_key: string;
      token_type: AccountLifecycleTokenType;
      target_role: 'owner' | 'admin' | 'rabbi' | 'parent' | 'student';
      expires_at: string;
      mfa_required: boolean;
    }
  | {
      ok: false;
      code: 'TOKEN_INVALID' | 'TOKEN_EXPIRED' | 'TOKEN_CONSUMED';
    };

type TokenRecord = {
  token_key: string;
  token_type: AccountLifecycleTokenType;
  email_normalized: string | null;
  display_name: string | null;
  target_role: 'owner' | 'admin' | 'rabbi' | 'parent' | 'student';
  subject_user_key: string | null;
  subject_human_account_id: string | null;
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

const TOKEN_TTL_MS = 24 * 60 * 60 * 1000;
const ACTIVATION_TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const RESET_TOKEN_TTL_MS = 60 * 60 * 1000;
const MAX_FREE_PILOT_MS = 366 * 24 * 60 * 60 * 1000;

function assertFreePilotWindow(expiresAtValue: string, now: Date) {
  const expiresAt = new Date(expiresAtValue);
  if (
    Number.isNaN(expiresAt.getTime()) ||
    expiresAt.getTime() <= now.getTime() ||
    expiresAt.getTime() - now.getTime() > MAX_FREE_PILOT_MS
  ) {
    throw new AccountLifecycleError(
      'FORBIDDEN',
      'A free-pilot activation must have a future expiry within the governed pilot window.',
    );
  }
}

function freePilotIntentFromToken(token: TokenRecord) {
  const value = token.metadata.free_pilot_intent;
  if (value === undefined) return null;
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new AccountLifecycleError('TOKEN_INVALID', 'The account lifecycle token is invalid.');
  }
  const intent = value as Record<string, unknown>;
  const expiresAt = typeof intent.expires_at === 'string' ? intent.expires_at : '';
  const policyVersion = typeof intent.policy_version === 'string' ? intent.policy_version : '';
  const opaqueSourceReference =
    typeof intent.opaque_source_reference === 'string' ? intent.opaque_source_reference : '';
  if (
    policyVersion.length < 3 ||
    policyVersion.length > 120 ||
    !/^[A-Za-z0-9_:-]{8,180}$/u.test(opaqueSourceReference)
  ) {
    throw new AccountLifecycleError('TOKEN_INVALID', 'The account lifecycle token is invalid.');
  }
  return { expiresAt, policyVersion, opaqueSourceReference };
}

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
        ttlMs: ACTIVATION_TOKEN_TTL_MS,
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
      return completion(userKey, token.target_role, 'active', false, 0);
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
    issue: (client, now) =>
      issueParentActivationWithClient({
        client,
        config: input.config,
        actor: input.actor,
        payload,
        now,
        includeLocalProofToken: input.includeLocalProofToken,
        queueHighLevelPortalEvent: true,
      }),
  });
}

export async function issueParentActivationWithClient(input: {
  client: Queryable;
  config: AppConfig;
  actor: LifecycleActor;
  payload: ParentActivationPayload;
  now: Date;
  includeLocalProofToken?: boolean | undefined;
  queueHighLevelPortalEvent?: boolean | undefined;
}): Promise<TokenIssueWithProof> {
  requireOwnerOrAdmin(input.actor);
  if (input.payload.free_pilot) {
    assertFreePilotWindow(input.payload.free_pilot.expires_at, input.now);
  }
  await assertParentIdentityAvailableWithClient(
    input.client,
    input.config,
    normalizeEmail(input.payload.email),
  );
  await ensureHousehold(input.client, input.config, input.payload.household_key);
  await ensurePendingGuardianRelationship(input.client, input.config, input.payload);
  const issued = await issueAccountToken(input.client, input.config, {
    tokenType: 'parent_activation',
    targetRole: 'parent',
    emailNormalized: normalizeEmail(input.payload.email),
    displayName: input.payload.display_name,
    householdKey: input.payload.household_key,
    relationshipKey: input.payload.relationship_key,
    idempotencyKey: input.payload.idempotency_key,
    requestHash: fingerprint(input.payload),
    actorUserKey: input.actor.userKey,
    now: input.now,
    ttlMs: ACTIVATION_TOKEN_TTL_MS,
    includeLocalProofToken: input.includeLocalProofToken,
    metadata: input.payload.free_pilot
      ? {
          free_pilot_intent: {
            expires_at: input.payload.free_pilot.expires_at,
            policy_version: input.payload.free_pilot.policy_version,
            opaque_source_reference: input.payload.free_pilot.opaque_source_reference,
            issued_by_user_key: input.actor.userKey,
          },
        }
      : undefined,
  });
  if (input.queueHighLevelPortalEvent) {
    await enqueueHighLevelEventForAdultEmail(input.client, input.config, {
      eventName: 'parent.portal.invitation_requested',
      emailNormalized: normalizeEmail(input.payload.email),
      idempotencyKey: stableKey('parent_portal_invitation', [input.payload.idempotency_key]),
      actor: { kind: 'admin', reference: input.actor.userKey },
      occurredAt: input.now,
      protectedPath: '/app/parent',
      data: { household_key: input.payload.household_key, portal_status: 'invited' },
    });
  }
  return issued;
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
      await client.query(
        `UPDATE onetime.adult_household_contact_links
            SET guardian_user_ref = $4,
                updated_at = $5
          WHERE account_key = $1
            AND product_key = $2
            AND household_key = $3`,
        [
          input.config.accountKey,
          input.config.productKey,
          requiredString(token.household_key),
          userKey,
          now,
        ],
      );
      const freePilotIntent = freePilotIntentFromToken(token);
      if (freePilotIntent) {
        assertFreePilotWindow(freePilotIntent.expiresAt, now);
        await applyHouseholdAccessStateWithClient({
          db: client,
          accountKey: input.config.accountKey,
          productKey: input.config.productKey,
          sourceKind: 'free_pilot',
          actorKind: 'account_lifecycle',
          idempotencyKey: stableKey('parent_activation_free_pilot', [token.token_key]),
          now,
          command: {
            household_key: requiredString(token.household_key),
            state: 'active',
            effective_at: now.toISOString(),
            expires_at: new Date(freePilotIntent.expiresAt).toISOString(),
            opaque_source_reference: freePilotIntent.opaqueSourceReference,
            source_revision: 1,
            source_updated_at: now.toISOString(),
            policy_version: freePilotIntent.policyVersion,
            revocation_reason: null,
          },
        });
      }
      await markTokenConsumed(client, token.token_key, now, userKey);
      await audit(client, input.config, {
        actionType: 'parent_activation_accepted',
        subjectUserKey: userKey,
        tokenKey: token.token_key,
        metadata: { household_key: token.household_key, relationship_key: token.relationship_key },
      });
      await enqueueHighLevelEventForAdultEmail(client, input.config, {
        eventName: 'parent.portal.activated',
        emailNormalized: requiredString(token.email_normalized),
        idempotencyKey: stableKey('parent_portal_activated', [requiredString(token.token_key)]),
        actor: { kind: 'parent', reference: userKey },
        occurredAt: now,
        protectedPath: '/app/parent',
        data: {
          household_key: requiredString(token.household_key),
          portal_status: 'active',
        },
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
  const payload = studentTokenCompletionPayloadSchema.parse(input.payload);
  assertStudentPin(payload.password);
  return consumeLifecycleToken(input.pool, input.config, payload, {
    expectedType: 'student_setup',
    now: input.now ?? new Date(),
    complete: async (client, token, now) => {
      const studentUsername =
        typeof token.metadata.student_username === 'string'
          ? token.metadata.student_username.trim().toLowerCase()
          : null;
      const userKey = await upsertAccountUser(client, input.config, {
        emailNormalized: studentUsername
          ? `student:${studentUsername}`
          : requiredString(token.email_normalized),
        displayName: requiredString(token.display_name),
        role: 'student',
        password: payload.password,
        status: 'active',
      });
      await activateStudentIdentity(client, input.config, token, userKey, now);
      if (studentUsername) {
        await client.query(
          `UPDATE onetime.portal_student_access_state
              SET username_display = $4,
                  normalized_username = $4,
                  password_hash_ref = $5,
                  credential_status = 'parent_managed',
                  password_version = password_version + 1,
                  security_version = security_version + 1,
                  updated_at = $6
            WHERE account_key = $1
              AND product_key = $2
              AND learner_key = $3`,
          [
            input.config.accountKey,
            input.config.productKey,
            requiredString(token.learner_key),
            studentUsername,
            studentPasswordHashRef(payload.password, token.token_key),
            now,
          ],
        );
      }
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

export async function issueLocalStudentSetupWithClient(input: {
  client: Queryable;
  config: AppConfig;
  actor: LifecycleActor;
  adultDeliveryEmail: string;
  displayName: string;
  householdKey: string;
  learnerKey: string;
  username: string;
  idempotencyKey: string;
  now: Date;
}): Promise<AccountLifecycleTokenIssueResult> {
  requireOwnerOrAdmin(input.actor);
  const username = input.username.trim().toLowerCase();
  if (!/^[a-z0-9][a-z0-9._-]{1,22}[a-z0-9]$/u.test(username)) {
    throw new AccountLifecycleError('FORBIDDEN', 'The Student username is invalid.');
  }
  await ensureLearner(input.client, input.config, input.householdKey, input.learnerKey);
  const existingUsername = await input.client.query(
    `SELECT learner_key
       FROM onetime.portal_student_access_state
      WHERE account_key = $1
        AND product_key = $2
        AND normalized_username = $3
        AND learner_key <> $4
        AND status <> 'disabled'
      LIMIT 1`,
    [input.config.accountKey, input.config.productKey, username, input.learnerKey],
  );
  if (existingUsername.rowCount) {
    throw new AccountLifecycleError('FORBIDDEN', 'The Student username is unavailable.');
  }
  await input.client.query(
    `UPDATE onetime.portal_student_access_state
        SET status = 'setup_requested',
            credential_status = 'reset_required',
            username_display = $5,
            normalized_username = $5,
            last_operation_type = 'setup',
            last_operation_at = $6,
            version = version + 1,
            updated_at = $6
      WHERE account_key = $1
        AND product_key = $2
        AND household_key = $3
        AND learner_key = $4`,
    [
      input.config.accountKey,
      input.config.productKey,
      input.householdKey,
      input.learnerKey,
      username,
      input.now,
    ],
  );
  return issueAccountToken(input.client, input.config, {
    tokenType: 'student_setup',
    targetRole: 'student',
    emailNormalized: normalizeEmail(input.adultDeliveryEmail),
    displayName: input.displayName,
    householdKey: input.householdKey,
    learnerKey: input.learnerKey,
    idempotencyKey: input.idempotencyKey,
    requestHash: fingerprint({
      household_key: input.householdKey,
      learner_key: input.learnerKey,
      username,
      adult_delivery_email: normalizeEmail(input.adultDeliveryEmail),
    }),
    actorUserKey: input.actor.userKey,
    now: input.now,
    deliveryToAdult: true,
    metadata: {
      student_username: username,
      delivery_to_adult: true,
      child_highlevel_contact_created: false,
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
    expectedStudentUserKey?: string;
    expectedHouseholdKey?: string;
    adultDeliveryBinding?: {
      householdKey: string;
      emailNormalized: string;
      guardianUserKey?: string;
    };
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
      const householdKey = String(state.household_key);
      if (
        !['active', 'reset_requested'].includes(String(state.status ?? '')) ||
        String(state.learner_status ?? '') !== 'active' ||
        String(state.access_household_key ?? '') !== String(state.learner_household_key ?? '') ||
        (input.expectedStudentUserKey && input.expectedStudentUserKey !== studentUserKey) ||
        (input.expectedHouseholdKey && input.expectedHouseholdKey !== householdKey)
      ) {
        throw new AccountLifecycleError(
          'IDENTITY_CONFLICT',
          'The Student reset target no longer matches the active account.',
        );
      }
      const user = await getAccountUser(client, input.config, studentUserKey);
      await assertActiveStudentIdentityBinding(client, input.config, {
        studentUserKey,
        learnerKey: payload.learner_key,
        householdKey,
        errorCode: 'IDENTITY_CONFLICT',
      });
      let adultDeliveryVerified = false;
      let adultDeliveryGuardianUserKey: string | null = null;
      if (input.adultDeliveryBinding) {
        const adultEmailNormalized = normalizeEmail(input.adultDeliveryBinding.emailNormalized);
        if (input.adultDeliveryBinding.householdKey !== householdKey) {
          throw new AccountLifecycleError(
            'IDENTITY_CONFLICT',
            'The adult delivery binding no longer matches the Student household.',
          );
        }
        const guardianUserKey = String(input.adultDeliveryBinding.guardianUserKey ?? '');
        if (!guardianUserKey) {
          throw new AccountLifecycleError(
            'IDENTITY_CONFLICT',
            'The adult delivery binding is no longer available.',
          );
        }
        const adultRecipient = await client.query(
          `SELECT guardians.guardian_user_ref
             FROM onetime.portal_guardian_relationships AS guardians
             JOIN onetime.account_users AS adult_users
               ON adult_users.account_key = guardians.account_key
              AND adult_users.product_key = guardians.product_key
              AND adult_users.user_key = guardians.guardian_user_ref
             JOIN onetime.adult_household_contact_links AS links
              ON links.account_key = guardians.account_key
              AND links.product_key = guardians.product_key
              AND links.household_key = guardians.household_key
              AND links.guardian_user_ref = guardians.guardian_user_ref
             JOIN onetime.contacts AS contacts
               ON contacts.account_key = links.account_key
              AND contacts.product_key = links.product_key
              AND contacts.contact_key = links.contact_key
            WHERE guardians.account_key = $1
              AND guardians.product_key = $2
              AND guardians.household_key = $3
              AND guardians.guardian_user_ref = $4
              AND guardians.status = 'active'
              AND guardians.authority <> 'support_only'
              AND adult_users.role = 'parent'
              AND adult_users.status = 'active'
              AND adult_users.email_normalized = contacts.email_normalized
              AND contacts.email_normalized = $5
            LIMIT 2
            FOR UPDATE`,
          [
            input.config.accountKey,
            input.config.productKey,
            householdKey,
            guardianUserKey,
            adultEmailNormalized,
          ],
        );
        if (adultRecipient.rows.length !== 1) {
          throw new AccountLifecycleError(
            'IDENTITY_CONFLICT',
            'The adult delivery binding is no longer available.',
          );
        }
        adultDeliveryVerified = true;
        adultDeliveryGuardianUserKey = guardianUserKey;
      }
      const resetState = await client.query(
        `UPDATE onetime.portal_student_access_state
            SET status = 'reset_requested',
                credential_status = 'reset_required',
                last_operation_type = 'reset',
                last_operation_at = $4,
                version = version + 1,
                updated_at = $4
          WHERE account_key = $1
            AND product_key = $2
            AND access_state_key = $3
            AND status IN ('active', 'reset_requested')`,
        [input.config.accountKey, input.config.productKey, String(state.access_state_key), now],
      );
      if (resetState.rowCount !== 1) {
        throw new AccountLifecycleError(
          'IDENTITY_CONFLICT',
          'The Student reset target no longer matches the active account.',
        );
      }
      return issueAccountToken(client, input.config, {
        tokenType: 'student_reset',
        targetRole: 'student',
        emailNormalized: normalizeEmail(
          input.adultDeliveryBinding?.emailNormalized ??
            payload.email ??
            String(user.email_normalized),
        ),
        displayName: String(user.display_name),
        subjectUserKey: studentUserKey,
        householdKey,
        learnerKey: payload.learner_key,
        idempotencyKey: payload.idempotency_key,
        requestHash: fingerprint(payload),
        actorUserKey: input.actor.userKey,
        now,
        ttlMs: RESET_TOKEN_TTL_MS,
        includeLocalProofToken: input.includeLocalProofToken,
        deliveryToAdult: adultDeliveryVerified,
        metadata: {
          delivery_to_adult: adultDeliveryVerified,
          adult_delivery_guardian_user_key: adultDeliveryGuardianUserKey,
        },
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
  const payload = studentTokenCompletionPayloadSchema.parse(input.payload);
  assertStudentPin(payload.password);
  return consumeLifecycleToken(input.pool, input.config, payload, {
    expectedType: 'student_reset',
    now: input.now ?? new Date(),
    complete: async (client, token, now) => {
      if (token.target_role !== 'student') {
        throw new AccountLifecycleError('TOKEN_INVALID', 'The account lifecycle token is invalid.');
      }
      const userKey = requiredString(token.subject_user_key);
      const learnerKey = requiredString(token.learner_key);
      const householdKey = requiredString(token.household_key);
      const tokenMetadata = token.metadata as Record<string, unknown> | null;
      const delegatedGuardianUserKey =
        typeof tokenMetadata?.adult_delivery_guardian_user_key === 'string'
          ? tokenMetadata.adult_delivery_guardian_user_key
          : null;
      if (delegatedGuardianUserKey) {
        await assertStudentResetAdultDeliveryAuthority(client, input.config, {
          householdKey,
          guardianUserKey: delegatedGuardianUserKey,
          emailNormalized: requiredString(token.email_normalized),
          errorCode: 'TOKEN_INVALID',
        });
      }
      const state = await getStudentStateForUpdate(client, input.config, learnerKey);
      if (
        !state ||
        String(state.status ?? '') !== 'reset_requested' ||
        String(state.learner_status ?? '') !== 'active' ||
        String(state.access_household_key ?? '') !== String(state.learner_household_key ?? '') ||
        String(state.student_user_ref ?? '') !== userKey ||
        String(state.household_key ?? '') !== householdKey
      ) {
        throw new AccountLifecycleError('TOKEN_INVALID', 'The account lifecycle token is invalid.');
      }
      await assertActiveStudentIdentityBinding(client, input.config, {
        studentUserKey: userKey,
        learnerKey,
        householdKey,
        errorCode: 'TOKEN_INVALID',
      });
      await updateStudentPassword(client, input.config, userKey, payload.password, now);
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
                credential_status = 'parent_managed',
                password_hash_ref = CASE
                  WHEN normalized_username IS NOT NULL THEN $5
                  ELSE password_hash_ref
                END,
                password_version = password_version + 1,
                security_version = security_version + 1,
                last_reset_at = $4,
                last_session_revoked_at = CASE
                  WHEN $6::int > 0 THEN $4
                  ELSE last_session_revoked_at
                END,
                last_operation_type = 'reset',
                last_operation_at = $4,
                version = version + 1,
                updated_at = $4
          WHERE account_key = $1
            AND product_key = $2
            AND access_state_key = $3
            AND status = 'reset_requested'
            AND student_user_ref = $7
            AND household_key = $8`,
        [
          input.config.accountKey,
          input.config.productKey,
          String(state.access_state_key),
          now,
          studentPasswordHashRef(payload.password, token.token_key),
          sessionsInvalidated,
          userKey,
          householdKey,
        ],
      );
      await audit(client, input.config, {
        actionType: 'student_reset_completed',
        subjectUserKey: userKey,
        tokenKey: token.token_key,
        metadata: {
          learner_key: token.learner_key,
          sessions_invalidated: sessionsInvalidated,
          plaintext_credential_stored: false,
        },
      });
      return completion(userKey, 'student', 'active', false, sessionsInvalidated);
    },
  });
}

type PasswordResetRequestInput = {
  pool: DbPool;
  config: AppConfig;
  payload: unknown;
  now?: Date;
  expectedParentGuardian?: {
    householdKey: string;
    guardianUserKey: string;
    emailNormalized: string;
  };
} & LocalProofOption;

export async function requestPasswordReset(
  input: PasswordResetRequestInput,
): Promise<TokenIssueWithProof | { request_accepted: true }> {
  return requestPasswordResetInternal(input, false);
}

/**
 * Issues the one reserved setup message for the exact controller-provisioned
 * dual-role identity. Ordinary recovery callers cannot consume this seam.
 */
export async function requestControllerDualRoleInitialPasswordSetup(
  input: PasswordResetRequestInput,
): Promise<TokenIssueWithProof | { request_accepted: true }> {
  return requestPasswordResetInternal(input, true);
}

async function requestPasswordResetInternal(
  input: PasswordResetRequestInput,
  controllerInitialSetup: boolean,
): Promise<TokenIssueWithProof | { request_accepted: true }> {
  const payload = passwordResetRequestPayloadSchema.parse(input.payload);
  const now = input.now ?? new Date();
  const emailNormalized = normalizeEmail(payload.email);
  if (!controllerInitialSetup) {
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
  }
  return inTransaction(input.pool, async (client) => {
    await client.query('SELECT pg_advisory_xact_lock($1)', [
      lifecycleSubjectAdvisoryLockKey(
        input.config.accountKey,
        input.config.productKey,
        emailNormalized,
      ),
    ]);
    const user = input.expectedParentGuardian
      ? await findExpectedActiveParentGuardian(client, input.config, {
          ...input.expectedParentGuardian,
          emailNormalized,
        })
      : await findAccountUserByEmail(client, input.config, emailNormalized);
    const v21Account = input.expectedParentGuardian
      ? undefined
      : await findV21HumanAccountByEmail(client, input.config, emailNormalized);
    const controllerReservation = v21Account
      ? await hasControllerDualRoleInitialSetupReservation(
          client,
          input.config,
          emailNormalized,
          v21Account,
          now,
        )
      : false;
    if (controllerInitialSetup) {
      const expectedIdempotencyKey = controllerDualRoleSetupIdempotencyKey({
        accountKey: input.config.accountKey,
        productKey: input.config.productKey,
        runtimeTier: input.config.oneTimeRuntimeTier,
        verificationEnvironmentId: input.config.oneTimeVerificationEnvironmentId,
        normalizedEmail: emailNormalized,
      });
      if (!controllerReservation || payload.idempotency_key !== expectedIdempotencyKey) {
        throw new AccountLifecycleError(
          'IDENTITY_CONFLICT',
          'The reserved initial account setup is unavailable.',
        );
      }
    } else {
      if (controllerReservation) {
        await audit(client, input.config, {
          actionType: 'password_reset_requested_controller_setup_pending',
          metadata: { token_issued: false, delivery_queued: false },
        });
        return { request_accepted: true as const };
      }
    }
    const legacyRole = user ? lifecycleRoleFromUserRole(String(user.role)) : null;
    if (legacyRole === 'student' && !v21Account) {
      await audit(client, input.config, {
        actionType: 'password_reset_requested_student_suppressed',
        subjectUserKey: String(user!.user_key),
        metadata: { target_role: 'student', token_issued: false, delivery_queued: false },
      });
      return { request_accepted: true as const };
    }
    if (!user && !v21Account) {
      await audit(client, input.config, {
        actionType: 'password_reset_requested_unknown',
        metadata: { email_digest: digest(emailNormalized) },
      });
      return { request_accepted: true as const };
    }
    return issueAccountToken(client, input.config, {
      tokenType: 'password_reset',
      targetRole: v21Account
        ? (v21Account.target_role as 'admin' | 'parent')
        : lifecycleRoleFromUserRole(String(user!.role)),
      emailNormalized,
      displayName: String(v21Account?.display_name ?? user!.display_name),
      subjectUserKey: v21Account ? null : String(user!.user_key),
      subjectHumanAccountId: v21Account ? String(v21Account.human_account_id) : null,
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
      if (token.target_role === 'student') {
        throw new AccountLifecycleError(
          'TOKEN_INVALID',
          'Student credentials are managed by a Parent or Administrator.',
        );
      }
      if (token.subject_human_account_id) {
        return completeV21AdultPasswordReset(client, input.config, token, payload.password, now);
      }
      const userKey = requiredString(token.subject_user_key);
      const user = await getAccountUser(client, input.config, userKey);
      if (lifecycleRoleFromUserRole(String(user.role)) === 'student') {
        throw new AccountLifecycleError(
          'TOKEN_INVALID',
          'Student credentials are managed by a Parent or Administrator.',
        );
      }
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
        false,
        sessionsInvalidated,
      );
    },
  });
}

export async function inspectAccountLifecycleToken(input: {
  pool: DbPool;
  config: AppConfig;
  token: string;
  expectedTypes?: AccountLifecycleTokenType[];
  now?: Date;
}): Promise<AccountLifecycleTokenInspection> {
  const result = await input.pool.query(
    `SELECT token_key, token_type, email_normalized, display_name, target_role, subject_user_key,
            household_key, relationship_key, learner_key, attempts, max_attempts, expires_at,
            consumed_at, revoked_at, metadata
       FROM onetime.account_lifecycle_tokens
      WHERE account_key = $1
        AND product_key = $2
        AND token_hash = $3
      LIMIT 1`,
    [input.config.accountKey, input.config.productKey, digest(input.token)],
  );
  const row = result.rows[0] as Record<string, unknown> | undefined;
  if (!row) return { ok: false, code: 'TOKEN_INVALID' };
  const token = mapToken(row);
  if (input.expectedTypes && !input.expectedTypes.includes(token.token_type)) {
    return { ok: false, code: 'TOKEN_INVALID' };
  }
  try {
    assertTokenUsable(token, input.now ?? new Date());
  } catch (error) {
    if (error instanceof AccountLifecycleError) {
      if (error.code === 'TOKEN_EXPIRED') return { ok: false, code: 'TOKEN_EXPIRED' };
      if (error.code === 'TOKEN_CONSUMED') return { ok: false, code: 'TOKEN_CONSUMED' };
    }
    return { ok: false, code: 'TOKEN_INVALID' };
  }
  return {
    ok: true,
    token_key: token.token_key,
    token_type: token.token_type,
    target_role: token.target_role,
    expires_at: token.expires_at.toISOString(),
    mfa_required: false,
  };
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
    targetRole: 'owner' | 'admin' | 'rabbi' | 'parent' | 'student';
    emailNormalized: string;
    displayName: string;
    idempotencyKey: string;
    requestHash: string;
    actorUserKey: string | null;
    now: Date;
    ttlMs?: number;
    subjectUserKey?: string | null;
    subjectHumanAccountId?: string | null;
    householdKey?: string | null;
    relationshipKey?: string | null;
    learnerKey?: string | null;
    includeLocalProofToken?: boolean | undefined;
    metadata?: Record<string, unknown> | undefined;
    deliveryToAdult?: boolean | undefined;
  },
): Promise<TokenIssueWithProof> {
  const tokenKey = stableKey('account_lifecycle_token', [
    config.accountKey,
    config.productKey,
    input.tokenType,
    input.idempotencyKey,
  ]);
  await client.query('SELECT pg_advisory_xact_lock($1)', [
    lifecycleAdvisoryLockKey(config.accountKey, config.productKey, input.idempotencyKey),
  ]);
  const replay = await readAccountTokenIssueReplay(client, config, tokenKey, input.requestHash);
  if (replay) return replay;
  const token = randomToken();
  const tokenHash = digest(token);
  const expiresAt = new Date(input.now.getTime() + (input.ttlMs ?? TOKEN_TTL_MS));
  await revokePriorLifecycleTokens(client, config, {
    tokenKey,
    tokenType: input.tokenType,
    targetRole: input.targetRole,
    emailNormalized: input.emailNormalized,
    subjectUserKey: input.subjectUserKey ?? null,
    subjectHumanAccountId: input.subjectHumanAccountId ?? null,
    householdKey: input.householdKey ?? null,
    relationshipKey: input.relationshipKey ?? null,
    learnerKey: input.learnerKey ?? null,
    now: input.now,
  });
  await client.query(
    `INSERT INTO onetime.account_lifecycle_tokens
       (token_key, account_key, product_key, token_type, token_hash, email_normalized,
        display_name, target_role, subject_user_key, subject_human_account_id,
        household_key, relationship_key, learner_key, expires_at, created_by_user_key,
        metadata, created_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16::jsonb,$17)`,
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
      input.subjectHumanAccountId ?? null,
      input.householdKey ?? null,
      input.relationshipKey ?? null,
      input.learnerKey ?? null,
      expiresAt,
      input.actorUserKey,
      JSON.stringify({ raw_token_included: false, ...(input.metadata ?? {}) }),
      input.now,
    ],
  );
  const deliveryToAdult =
    input.deliveryToAdult === true &&
    input.targetRole === 'student' &&
    (input.tokenType === 'student_setup' || input.tokenType === 'student_reset');
  if (input.deliveryToAdult === true && !deliveryToAdult) {
    throw new AccountLifecycleError('FORBIDDEN', 'The adult delivery binding is invalid.');
  }
  const deliverByEmail = input.targetRole !== 'student' || deliveryToAdult;
  const delivery = await createDeliveryIntent(client, config, {
    tokenKey,
    tokenType: input.tokenType,
    recipientEmail: deliverByEmail ? input.emailNormalized : null,
    deliveryState: deliverByEmail ? 'sink_queued' : 'suppressed',
    targetRole: input.targetRole,
    idempotencyKey: input.idempotencyKey,
    requestHash: input.requestHash,
    now: input.now,
    householdKey: input.householdKey ?? null,
    learnerKey: input.learnerKey ?? null,
  });
  const outbox = deliverByEmail
    ? await createLifecycleDeliveryOutbox(client, config, {
        token,
        tokenKey,
        intentKey: delivery.intent_key,
        tokenType: input.tokenType,
        recipientEmail: input.emailNormalized,
        displayName: input.displayName,
        targetRole: input.targetRole,
        subjectUserKey: input.subjectUserKey ?? null,
        learnerKey: input.learnerKey ?? null,
        idempotencyKey: input.idempotencyKey,
        expiresAt,
        now: input.now,
      })
    : null;
  await audit(client, config, {
    actionType: `${input.tokenType}_issued`,
    actorUserKey: input.actorUserKey,
    subjectUserKey: input.subjectUserKey ?? null,
    tokenKey,
    metadata: {
      target_role: input.targetRole,
      token_ref: tokenRef(tokenKey),
      lifecycle_delivery_ref: outbox?.delivery_key ?? null,
      destination_ref: outbox?.destination_ref ?? null,
      student_email_suppressed: !deliverByEmail,
      delivery_to_adult: deliveryToAdult,
      subject_human_account_bound: Boolean(input.subjectHumanAccountId),
      raw_token_included: false,
      raw_url_included: false,
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

async function readAccountTokenIssueReplay(
  client: Queryable,
  config: AppConfig,
  tokenKey: string,
  requestHash: string,
): Promise<TokenIssueWithProof | null> {
  const result = await client.query(
    `SELECT tokens.token_key, tokens.token_type, tokens.target_role, tokens.expires_at,
            intents.intent_key, intents.delivery_state, intents.request_hash
       FROM onetime.account_lifecycle_tokens AS tokens
       JOIN onetime.account_lifecycle_delivery_intents AS intents
         ON intents.account_key = tokens.account_key
        AND intents.product_key = tokens.product_key
        AND intents.token_key = tokens.token_key
      WHERE tokens.account_key = $1
        AND tokens.product_key = $2
        AND tokens.token_key = $3
      LIMIT 2`,
    [config.accountKey, config.productKey, tokenKey],
  );
  if (!result.rows.length) return null;
  if (result.rows.length !== 1 || String(result.rows[0]?.request_hash) !== requestHash) {
    throw new AccountLifecycleError(
      'IDEMPOTENCY_CONFLICT',
      'This account lifecycle request key was already used for different information.',
    );
  }
  const row = result.rows[0] as Record<string, unknown>;
  return {
    token_key: String(row.token_key),
    token_type: row.token_type as AccountLifecycleTokenType,
    target_role: row.target_role as TokenIssueWithProof['target_role'],
    expires_at: new Date(String(row.expires_at)).toISOString(),
    delivery: {
      intent_key: String(row.intent_key),
      delivery_state: String(
        row.delivery_state,
      ) as TokenIssueWithProof['delivery']['delivery_state'],
      external_send_performed: false,
      raw_token_included: false,
    },
    token_ref: tokenRef(String(row.token_key)),
    raw_token_included: false,
  };
}

async function revokePriorLifecycleTokens(
  client: Queryable,
  config: AppConfig,
  input: {
    tokenKey: string;
    tokenType: AccountLifecycleTokenType;
    targetRole: string;
    emailNormalized: string | null;
    subjectUserKey: string | null;
    subjectHumanAccountId: string | null;
    householdKey: string | null;
    relationshipKey: string | null;
    learnerKey: string | null;
    now: Date;
  },
) {
  await client.query(
    `UPDATE onetime.account_lifecycle_tokens
        SET revoked_at = $12
      WHERE account_key = $1
        AND product_key = $2
        AND token_type = $3
        AND token_key <> $4
        AND consumed_at IS NULL
        AND revoked_at IS NULL
        AND target_role = $5
        AND (
          (
            $3 = 'student_reset'
            AND COALESCE(subject_user_key, '') = COALESCE($7, '')
            AND COALESCE(household_key, '') = COALESCE($9, '')
            AND COALESCE(learner_key, '') = COALESCE($11, '')
          )
          OR (
            $3 <> 'student_reset'
            AND COALESCE(email_normalized, '') = COALESCE($6, '')
            AND COALESCE(subject_user_key, '') = COALESCE($7, '')
            AND COALESCE(subject_human_account_id, '') = COALESCE($8, '')
            AND COALESCE(household_key, '') = COALESCE($9, '')
            AND COALESCE(relationship_key, '') = COALESCE($10, '')
            AND COALESCE(learner_key, '') = COALESCE($11, '')
          )
        )`,
    [
      config.accountKey,
      config.productKey,
      input.tokenType,
      input.tokenKey,
      input.targetRole,
      input.emailNormalized,
      input.subjectUserKey,
      input.subjectHumanAccountId,
      input.householdKey,
      input.relationshipKey,
      input.learnerKey,
      input.now,
    ],
  );
}

async function createDeliveryIntent(
  client: Queryable,
  config: AppConfig,
  input: {
    tokenKey: string;
    tokenType: AccountLifecycleTokenType;
    recipientEmail: string | null;
    deliveryState: 'sink_queued' | 'suppressed';
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
      VALUES ($1,$2,$3,$4,$5,'email',$6,$7,$8,$9,$10::jsonb,$11)`,
    [
      intentKey,
      config.accountKey,
      config.productKey,
      input.tokenKey,
      input.tokenType,
      input.recipientEmail,
      input.deliveryState,
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
    delivery_state: input.deliveryState,
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
  await assertAccountRoleAvailableWithClient(client, config, input.emailNormalized, input.role);
  const userKey = stableKey('user', [config.accountKey, config.productKey, input.emailNormalized]);
  const result = await client.query(
    `INSERT INTO onetime.account_users
       (user_key, account_key, product_key, email_normalized, display_name, role,
        password_hash, mfa_capable, status)
     VALUES ($1,$2,$3,$4,$5,$6,$7,false,$8)
     ON CONFLICT (account_key, product_key, email_normalized)
     DO UPDATE SET
       display_name = EXCLUDED.display_name,
       password_hash = EXCLUDED.password_hash,
       password_updated_at = now(),
       status = EXCLUDED.status,
       security_version = onetime.account_users.security_version + 1,
       security_policy_updated_at = now(),
       updated_at = now()
     WHERE onetime.account_users.role = EXCLUDED.role
     RETURNING user_key`,
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
  const returnedUserKey = result.rows[0]?.user_key;
  if (typeof returnedUserKey !== 'string') {
    throw new AccountLifecycleError(
      'IDENTITY_CONFLICT',
      'The email already belongs to a different account role.',
    );
  }
  return returnedUserKey;
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
              suspended_at = CASE WHEN $4 = 'suspended' THEN $5::timestamptz ELSE NULL END
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

async function updateStudentPassword(
  client: Queryable,
  config: AppConfig,
  userKey: string,
  password: string,
  now: Date,
) {
  const updated = await client.query(
    `UPDATE onetime.account_users
        SET password_hash = $4,
            password_updated_at = $5,
            updated_at = $5
      WHERE account_key = $1
        AND product_key = $2
        AND user_key = $3
        AND role = 'student'
        AND status = 'active'
      RETURNING user_key`,
    [config.accountKey, config.productKey, userKey, hashPassword(password), now],
  );
  if (updated.rowCount !== 1) {
    throw new AccountLifecycleError('TOKEN_INVALID', 'The account lifecycle token is invalid.');
  }
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

async function markV21TokenConsumed(
  client: Queryable,
  tokenKey: string,
  now: Date,
  humanAccountId: string,
) {
  const updated = await client.query(
    `UPDATE onetime.account_lifecycle_tokens
        SET consumed_at = $2,
            subject_human_account_id = COALESCE(subject_human_account_id, $3)
      WHERE token_key = $1
        AND subject_user_key IS NULL`,
    [tokenKey, now, humanAccountId],
  );
  if (updated.rowCount !== 1) {
    throw new AccountLifecycleError('TOKEN_INVALID', 'The account lifecycle token is invalid.');
  }
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

export async function assertParentIdentityAvailableWithClient(
  client: Queryable,
  config: AppConfig,
  emailNormalized: string,
) {
  return assertAccountRoleAvailableWithClient(client, config, emailNormalized, 'parent');
}

async function assertAccountRoleAvailableWithClient(
  client: Queryable,
  config: AppConfig,
  emailNormalized: string,
  expectedRole: string,
) {
  const result = await client.query(
    `SELECT user_key, role
       FROM onetime.account_users
      WHERE account_key = $1
        AND product_key = $2
        AND email_normalized = $3
      LIMIT 2
      FOR UPDATE`,
    [config.accountKey, config.productKey, emailNormalized],
  );
  if (result.rows.length > 1) {
    throw new AccountLifecycleError(
      'IDENTITY_CONFLICT',
      'The email resolves to more than one account identity.',
    );
  }
  const role = result.rows[0]?.role;
  if (typeof role === 'string' && role !== expectedRole) {
    throw new AccountLifecycleError(
      'IDENTITY_CONFLICT',
      'The email already belongs to a different account role.',
    );
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
    `SELECT access_state.*,
            access_state.household_key AS access_household_key,
            learners.household_key AS learner_household_key,
            learners.learner_status
       FROM onetime.portal_student_access_state AS access_state
       JOIN onetime.portal_learners AS learners
         ON learners.account_key = access_state.account_key
        AND learners.product_key = access_state.product_key
        AND learners.learner_key = access_state.learner_key
      WHERE access_state.account_key = $1
        AND access_state.product_key = $2
        AND access_state.learner_key = $3
      LIMIT 2
      FOR UPDATE`,
    [config.accountKey, config.productKey, learnerKey],
  );
  return result.rows.length === 1 ? (result.rows[0] as Record<string, unknown>) : undefined;
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

async function assertStudentResetAdultDeliveryAuthority(
  client: Queryable,
  config: AppConfig,
  input: {
    householdKey: string;
    guardianUserKey: string;
    emailNormalized: string;
    errorCode: AccountLifecycleErrorCode;
  },
) {
  const result = await client.query(
    `SELECT guardians.guardian_user_ref
       FROM onetime.portal_guardian_relationships AS guardians
       JOIN onetime.account_users AS adult_users
         ON adult_users.account_key = guardians.account_key
        AND adult_users.product_key = guardians.product_key
        AND adult_users.user_key = guardians.guardian_user_ref
       JOIN onetime.adult_household_contact_links AS links
         ON links.account_key = guardians.account_key
        AND links.product_key = guardians.product_key
        AND links.household_key = guardians.household_key
        AND links.guardian_user_ref = guardians.guardian_user_ref
       JOIN onetime.contacts AS contacts
         ON contacts.account_key = links.account_key
        AND contacts.product_key = links.product_key
        AND contacts.contact_key = links.contact_key
      WHERE guardians.account_key = $1
        AND guardians.product_key = $2
        AND guardians.household_key = $3
        AND guardians.guardian_user_ref = $4
        AND guardians.status = 'active'
        AND guardians.authority <> 'support_only'
        AND adult_users.role = 'parent'
        AND adult_users.status = 'active'
        AND adult_users.email_normalized = contacts.email_normalized
        AND contacts.email_normalized = $5
      LIMIT 2
      FOR UPDATE`,
    [
      config.accountKey,
      config.productKey,
      input.householdKey,
      input.guardianUserKey,
      input.emailNormalized,
    ],
  );
  if (result.rows.length !== 1) {
    throw new AccountLifecycleError(
      input.errorCode,
      'The Student reset delivery authority is no longer available.',
    );
  }
}

async function assertActiveStudentIdentityBinding(
  client: Queryable,
  config: AppConfig,
  input: {
    studentUserKey: string;
    learnerKey: string;
    householdKey: string;
    errorCode: AccountLifecycleErrorCode;
  },
) {
  const result = await client.query(
    `SELECT users.role, users.status, links.link_state
       FROM onetime.account_users AS users
       JOIN onetime.account_learner_identity_links AS links
         ON links.account_key = users.account_key
        AND links.product_key = users.product_key
        AND links.user_key = users.user_key
      WHERE users.account_key = $1
        AND users.product_key = $2
        AND users.user_key = $3
        AND links.household_key = $4
        AND links.learner_key = $5
      LIMIT 2
      FOR UPDATE`,
    [
      config.accountKey,
      config.productKey,
      input.studentUserKey,
      input.householdKey,
      input.learnerKey,
    ],
  );
  const row = result.rows[0] as Record<string, unknown> | undefined;
  if (
    result.rows.length !== 1 ||
    String(row?.role ?? '') !== 'student' ||
    String(row?.status ?? '') !== 'active' ||
    String(row?.link_state ?? '') !== 'active'
  ) {
    throw new AccountLifecycleError(
      input.errorCode,
      'The Student identity binding is unavailable.',
    );
  }
}

async function findV21HumanAccountByEmail(
  client: Queryable,
  config: AppConfig,
  emailNormalized: string,
) {
  const result = await client.query(
    `SELECT adult.adult_id, account.human_account_id,
            adult.display_name,
            credential.credential_state,
            membership.role AS target_role
       FROM onetime.v21_adult_identities AS adult
       JOIN onetime.v21_human_accounts AS account
         ON account.adult_id = adult.adult_id
        AND account.product_key = adult.product_key
        AND account.runtime_tier = adult.runtime_tier
        AND account.verification_environment_id = adult.verification_environment_id
       JOIN onetime.v21_adult_credentials AS credential
         ON credential.human_account_id = account.human_account_id
        AND credential.adult_id = adult.adult_id
        AND credential.product_key = account.product_key
        AND credential.runtime_tier = account.runtime_tier
        AND credential.verification_environment_id = account.verification_environment_id
       JOIN onetime.v21_human_account_role_memberships AS membership
         ON membership.human_account_id = account.human_account_id
        AND membership.product_key = account.product_key
        AND membership.runtime_tier = account.runtime_tier
        AND membership.verification_environment_id = account.verification_environment_id
        AND membership.role IN ('admin', 'parent')
        AND membership.revoked_at IS NULL
      WHERE adult.normalized_email = $1
        AND adult.product_key = 'one_time_mishnayos'
        AND adult.runtime_tier = $2
        AND adult.verification_environment_id = $3
        AND adult.state = 'active'
        AND account.state = 'active'
        AND credential.credential_state IN ('active', 'reset_required')
      ORDER BY CASE membership.role WHEN 'parent' THEN 0 ELSE 1 END
      LIMIT 1`,
    [emailNormalized, config.oneTimeRuntimeTier, config.oneTimeVerificationEnvironmentId],
  );
  if (result.rows.length !== 1 || !result.rows[0]?.target_role) return undefined;
  return result.rows[0] as Record<string, unknown>;
}

async function hasControllerDualRoleInitialSetupReservation(
  client: Queryable,
  config: AppConfig,
  emailNormalized: string,
  account: Record<string, unknown>,
  now: Date,
) {
  const target = {
    normalizedEmail: emailNormalized,
    displayName: String(account.display_name ?? ''),
  };
  const isolatedSyntheticFixture =
    config.nodeEnv === 'test' &&
    config.oneTimeRuntimeTier === 'isolated_staging' &&
    config.oneTimeVerificationEnvironmentId === 'ci' &&
    isControllerDualRoleProvisioningSyntheticTestFixture(target);
  if (
    account.credential_state !== 'reset_required' ||
    (!isControllerDualRoleProvisioningTarget(target) && !isolatedSyntheticFixture)
  ) {
    return false;
  }
  const auditKey = controllerDualRoleProvisionAuditKey({
    accountKey: config.accountKey,
    productKey: config.productKey,
    runtimeTier: config.oneTimeRuntimeTier,
    verificationEnvironmentId: config.oneTimeVerificationEnvironmentId,
    normalizedEmail: emailNormalized,
  });
  const identityKeys = controllerDualRoleProvisioningIdentityKeys({
    accountKey: config.accountKey,
    productKey: config.productKey,
    runtimeTier: config.oneTimeRuntimeTier,
    verificationEnvironmentId: config.oneTimeVerificationEnvironmentId,
    normalizedEmail: emailNormalized,
  });
  if (
    account.adult_id !== identityKeys.adultId ||
    account.human_account_id !== identityKeys.humanAccountId
  ) {
    return false;
  }
  const result = await client.query(
    `SELECT credential.credential_state
       FROM onetime.v21_adult_credentials AS credential
       JOIN onetime.v21_households AS household
         ON household.household_id = $8
        AND household.owner_adult_id = credential.adult_id
        AND household.owner_human_account_id = credential.human_account_id
        AND household.product_key = credential.product_key
        AND household.runtime_tier = credential.runtime_tier
        AND household.verification_environment_id = credential.verification_environment_id
        AND household.classification = 'family' AND household.state = 'active'
       JOIN onetime.account_lifecycle_audit_events AS audit
         ON audit.audit_key = $6
        AND audit.account_key = $1
        AND audit.product_key = $2
        AND audit.action_type = 'controller_dual_role_adult_provisioned'
        AND audit.success = true
        AND audit.created_at <= $7::timestamptz
        AND audit.metadata = $9::jsonb
      WHERE credential.human_account_id = $3
        AND credential.product_key = $2
        AND credential.runtime_tier = $4
        AND credential.verification_environment_id = $5
        AND credential.credential_state = 'reset_required'
      LIMIT 2
      FOR UPDATE OF credential`,
    [
      config.accountKey,
      config.productKey,
      String(account.human_account_id),
      config.oneTimeRuntimeTier,
      config.oneTimeVerificationEnvironmentId,
      auditKey,
      now,
      identityKeys.householdId,
      JSON.stringify(controllerDualRoleProvisionAuditMetadata(identityKeys)),
    ],
  );
  if (result.rows.length !== 1) return false;
  const setupIdempotencyKey = controllerDualRoleSetupIdempotencyKey({
    accountKey: config.accountKey,
    productKey: config.productKey,
    runtimeTier: config.oneTimeRuntimeTier,
    verificationEnvironmentId: config.oneTimeVerificationEnvironmentId,
    normalizedEmail: emailNormalized,
  });
  const tokenKey = stableKey('account_lifecycle_token', [
    config.accountKey,
    config.productKey,
    'password_reset',
    setupIdempotencyKey,
  ]);
  const token = await client.query(
    `SELECT consumed_at, revoked_at, expires_at
       FROM onetime.account_lifecycle_tokens
      WHERE account_key = $1 AND product_key = $2 AND token_key = $3
      LIMIT 2
      FOR UPDATE`,
    [config.accountKey, config.productKey, tokenKey],
  );
  if (!token.rows.length) return true;
  const row = token.rows[0] as Record<string, unknown>;
  return (
    token.rows.length === 1 &&
    row.consumed_at === null &&
    row.revoked_at === null &&
    asDate(row.expires_at).getTime() > now.getTime()
  );
}

async function completeV21AdultPasswordReset(
  client: Queryable,
  config: AppConfig,
  token: TokenRecord,
  password: string,
  now: Date,
): Promise<AccountLifecycleCompletionResult> {
  const humanAccountId = requiredString(token.subject_human_account_id);
  const credential = await client.query(
    `UPDATE onetime.v21_adult_credentials
        SET password_hash = $1,
            credential_state = 'active',
            credential_version = credential_version + 1,
            updated_at = $2
      WHERE human_account_id = $3
        AND product_key = 'one_time_mishnayos'
        AND runtime_tier = $4
        AND verification_environment_id = $5
        AND credential_state IN ('active', 'reset_required')
      RETURNING adult_id`,
    [
      hashAuthPassword(password),
      now,
      humanAccountId,
      config.oneTimeRuntimeTier,
      config.oneTimeVerificationEnvironmentId,
    ],
  );
  if (credential.rowCount !== 1) {
    throw new AccountLifecycleError('NOT_FOUND', 'The account user was not found.');
  }
  const account = await client.query(
    `UPDATE onetime.v21_human_accounts
        SET security_version = security_version + 1,
            version = version + 1,
            updated_at = $2
      WHERE human_account_id = $1
        AND product_key = 'one_time_mishnayos'
        AND runtime_tier = $3
        AND verification_environment_id = $4
        AND state = 'active'
      RETURNING security_version`,
    [humanAccountId, now, config.oneTimeRuntimeTier, config.oneTimeVerificationEnvironmentId],
  );
  if (account.rowCount !== 1) {
    throw new AccountLifecycleError('NOT_FOUND', 'The account user was not found.');
  }
  const revoked = await client.query(
    `UPDATE onetime.v21_adult_sessions
        SET revoked_at = $1,
            revoke_reason = 'password_reset',
            version = version + 1,
            updated_at = $1
      WHERE human_account_id = $2
        AND product_key = 'one_time_mishnayos'
        AND runtime_tier = $3
        AND verification_environment_id = $4
        AND revoked_at IS NULL`,
    [now, humanAccountId, config.oneTimeRuntimeTier, config.oneTimeVerificationEnvironmentId],
  );
  await markV21TokenConsumed(client, token.token_key, now, humanAccountId);
  await audit(client, config, {
    actionType: 'password_reset_completed',
    tokenKey: token.token_key,
    metadata: {
      human_account_ref: digest(humanAccountId),
      sessions_invalidated: revoked.rowCount ?? 0,
      security_version_after: Number(account.rows[0]?.security_version),
    },
  });
  return completion(
    humanAccountId,
    lifecycleRoleFromUserRole(token.target_role),
    'active',
    false,
    revoked.rowCount ?? 0,
  );
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

async function findExpectedActiveParentGuardian(
  client: Queryable,
  config: AppConfig,
  input: {
    householdKey: string;
    guardianUserKey: string;
    emailNormalized: string;
  },
) {
  const link = await client.query(
    `SELECT link_key, contact_key
       FROM onetime.adult_household_contact_links
      WHERE account_key = $1
        AND product_key = $2
        AND household_key = $3
        AND guardian_user_ref = $4
      LIMIT 2
      FOR UPDATE`,
    [config.accountKey, config.productKey, input.householdKey, input.guardianUserKey],
  );
  const contactKey = link.rows[0]?.contact_key;
  const contact =
    link.rows.length === 1 && typeof contactKey === 'string'
      ? await client.query(
          `SELECT contact_key
             FROM onetime.contacts
            WHERE account_key = $1
              AND product_key = $2
              AND contact_key = $3
            LIMIT 2
            FOR UPDATE`,
          [config.accountKey, config.productKey, contactKey],
        )
      : { rows: [] };
  const user = await client.query(
    `SELECT user_key
       FROM onetime.account_users
      WHERE account_key = $1
        AND product_key = $2
        AND user_key = $3
      LIMIT 2
      FOR UPDATE`,
    [config.accountKey, config.productKey, input.guardianUserKey],
  );
  const relationship = await client.query(
    `SELECT relationship_key
       FROM onetime.portal_guardian_relationships
      WHERE account_key = $1
        AND product_key = $2
        AND household_key = $3
      LIMIT 2
      FOR UPDATE`,
    [config.accountKey, config.productKey, input.householdKey],
  );
  if (
    link.rows.length !== 1 ||
    contact.rows.length !== 1 ||
    user.rows.length !== 1 ||
    relationship.rows.length !== 1
  ) {
    throw new AccountLifecycleError(
      'IDENTITY_CONFLICT',
      'The Parent recovery identity is missing or ambiguous.',
    );
  }
  const result = await client.query(
    `SELECT users.user_key, users.email_normalized, users.display_name, users.role, users.status
       FROM onetime.adult_household_contact_links AS links
       JOIN onetime.contacts AS contacts
         ON contacts.account_key = links.account_key
        AND contacts.product_key = links.product_key
        AND contacts.contact_key = links.contact_key
       JOIN onetime.account_users AS users
         ON users.account_key = links.account_key
        AND users.product_key = links.product_key
        AND users.user_key = links.guardian_user_ref
       JOIN onetime.portal_guardian_relationships AS relationships
         ON relationships.account_key = links.account_key
        AND relationships.product_key = links.product_key
        AND relationships.household_key = links.household_key
        AND relationships.guardian_user_ref = users.user_key
      WHERE links.account_key = $1
        AND links.product_key = $2
        AND links.household_key = $3
        AND links.guardian_user_ref = $4
        AND contacts.email_normalized = $5
        AND users.email_normalized = $5
        AND users.role = 'parent'
        AND users.status = 'active'
        AND relationships.status = 'active'
        AND relationships.authority <> 'support_only'
      LIMIT 2`,
    [
      config.accountKey,
      config.productKey,
      input.householdKey,
      input.guardianUserKey,
      input.emailNormalized,
    ],
  );
  if (result.rows.length !== 1) {
    throw new AccountLifecycleError(
      'IDENTITY_CONFLICT',
      'The Parent recovery identity does not match the active adult guardian link.',
    );
  }
  return result.rows[0] as Record<string, unknown>;
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

function studentPasswordHashRef(password: string, tokenKey: string) {
  const salt = digest(['student-lifecycle-password-v1', tokenKey].join(':'));
  const derived = scryptSync(password, salt, 32).toString('base64url');
  return `scrypt:v1:${salt}:${derived}`;
}

function mapToken(row: Record<string, unknown>): TokenRecord {
  return {
    token_key: String(row.token_key),
    token_type: row.token_type as AccountLifecycleTokenType,
    email_normalized: nullableString(row.email_normalized),
    display_name: nullableString(row.display_name),
    target_role: row.target_role as TokenRecord['target_role'],
    subject_user_key: nullableString(row.subject_user_key),
    subject_human_account_id: nullableString(row.subject_human_account_id),
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

function requireOwnerAdminInvitationActor(
  actor: LifecycleActor,
  targetRole: 'owner' | 'admin' | 'rabbi',
) {
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

function lifecycleRoleFromUserRole(
  role: string,
): 'owner' | 'admin' | 'rabbi' | 'parent' | 'student' {
  if (role === 'owner') return 'owner';
  if (role === 'admin') return 'admin';
  if (role === 'rabbi') return 'rabbi';
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

function lifecycleAdvisoryLockKey(accountKey: string, productKey: string, idempotencyKey: string) {
  const value = Number.parseInt(
    digest([accountKey, productKey, idempotencyKey].join('\0')).slice(0, 8),
    16,
  );
  return value > 0x7fffffff ? value - 0x100000000 : value;
}

function lifecycleSubjectAdvisoryLockKey(
  accountKey: string,
  productKey: string,
  emailNormalized: string,
) {
  return lifecycleAdvisoryLockKey(accountKey, productKey, `password-reset:${emailNormalized}`);
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
