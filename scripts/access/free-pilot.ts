import { createHash } from 'node:crypto';

import type { AppConfig } from '../../packages/config/src/index.ts';
import type { DbPool } from '../../packages/db/src/index.ts';
import {
  grantFreePilotAccess,
  readHouseholdAccess,
  revokeFreePilotAccess,
  type AccountAccessActorKind,
} from '../../packages/domain/src/index.ts';

const MAX_FREE_PILOT_DURATION_MS = 180 * 24 * 60 * 60 * 1000;

export const REVIEWED_STAGING_FREE_PILOT_AUTHORIZATION =
  'AUTHORIZE ONE TIME STAGING FREE PILOT ACCESS';

type GrantBoundedFreePilotInput = {
  pool: DbPool;
  config: AppConfig;
  householdKey: string;
  actorKind: AccountAccessActorKind;
  idempotencyKey: string;
  expiresAt: Date;
  policyVersion: string;
  opaqueSourceReference: string;
  now?: Date;
};

type RevokeBoundedFreePilotInput = {
  pool: DbPool;
  config: AppConfig;
  householdKey: string;
  actorKind: AccountAccessActorKind;
  idempotencyKey: string;
  reason: string;
  policyVersion: string;
  now?: Date;
};

type ReviewedFreePilotCommandInput = {
  pool: DbPool;
  config: AppConfig;
  operation: 'grant' | 'revoke';
  expectedAccountKey: string;
  expectedProductKey: string;
  householdKey: string;
  authorizationPhrase: string | undefined;
  idempotencyKey: string;
  policyVersion: string;
  expiresAt?: Date;
  opaqueSourceReference?: string;
  reason?: string;
  now?: Date;
};

export async function grantBoundedFreePilotAccess(input: GrantBoundedFreePilotInput) {
  const now = input.now ?? new Date();
  assertBoundedExpiry(input.expiresAt, now);
  return grantFreePilotAccess({
    pool: input.pool,
    accountKey: input.config.accountKey,
    productKey: input.config.productKey,
    actorKind: input.actorKind,
    command: {
      household_key: input.householdKey,
      idempotency_key: input.idempotencyKey,
      effective_at: now.toISOString(),
      expires_at: input.expiresAt.toISOString(),
      policy_version: input.policyVersion,
      opaque_source_reference: input.opaqueSourceReference,
    },
    now,
  });
}

export async function revokeBoundedFreePilotAccess(input: RevokeBoundedFreePilotInput) {
  const now = input.now ?? new Date();
  return revokeFreePilotAccess({
    pool: input.pool,
    accountKey: input.config.accountKey,
    productKey: input.config.productKey,
    actorKind: input.actorKind,
    command: {
      household_key: input.householdKey,
      idempotency_key: input.idempotencyKey,
      revoked_at: now.toISOString(),
      reason: input.reason,
      policy_version: input.policyVersion,
    },
    now,
  });
}

export async function runReviewedFreePilotCommand(input: ReviewedFreePilotCommandInput) {
  assertReviewedStagingScope(input);
  const now = input.now ?? new Date();
  const result =
    input.operation === 'grant'
      ? await grantBoundedFreePilotAccess({
          pool: input.pool,
          config: input.config,
          householdKey: input.householdKey,
          actorKind: 'admin',
          idempotencyKey: input.idempotencyKey,
          expiresAt: requiredDate(input.expiresAt, 'free_pilot_expiry_missing'),
          policyVersion: input.policyVersion,
          opaqueSourceReference: requiredString(
            input.opaqueSourceReference,
            'free_pilot_source_reference_missing',
          ),
          now,
        })
      : await revokeBoundedFreePilotAccess({
          pool: input.pool,
          config: input.config,
          householdKey: input.householdKey,
          actorKind: 'admin',
          idempotencyKey: input.idempotencyKey,
          reason: requiredString(input.reason, 'free_pilot_revoke_reason_missing'),
          policyVersion: input.policyVersion,
          now,
        });

  const readback = await readHouseholdAccess({
    db: input.pool,
    accountKey: input.config.accountKey,
    productKey: input.config.productKey,
    householdKey: input.householdKey,
    now,
  });
  if (!readback || readback.access_version !== result.projection.access_version) {
    throw new Error('free_pilot_readback_mismatch');
  }

  return {
    schema: 'onetime.reviewed_free_pilot_command.v1',
    operation: input.operation,
    result_state: result.state,
    current_state: readback.state,
    grants_access: readback.grants_access,
    source_kind: readback.source_kind,
    source_revision: readback.source_revision,
    expires_at: readback.expires_at,
    access_version: readback.access_version,
    sessions_revoked: result.sessions_revoked,
    payment_history_written: result.payment_history_written,
    account_ref: digestRef('account', input.config.accountKey),
    product_ref: digestRef('product', input.config.productKey),
    household_ref: digestRef('household', input.householdKey),
    source_ref: digestRef('access_source', readback.opaque_source_reference),
    credentials_printed: false as const,
    external_effects: 0 as const,
  };
}

export function assertReviewedStagingRuntime(
  config: Pick<AppConfig, 'deliveryEnvironment' | 'oneTimeRuntimeEnvironment'>,
  errorCode = 'free_pilot_command_forbidden_outside_reviewed_staging',
) {
  if (
    !['isolated_staging', 'test'].includes(config.deliveryEnvironment) ||
    !['isolated_staging', 'test'].includes(config.oneTimeRuntimeEnvironment)
  ) {
    throw new Error(errorCode);
  }
}

function assertReviewedStagingScope(input: ReviewedFreePilotCommandInput) {
  if (input.authorizationPhrase !== REVIEWED_STAGING_FREE_PILOT_AUTHORIZATION) {
    throw new Error('free_pilot_authorization_missing_or_invalid');
  }
  assertReviewedStagingRuntime(input.config);
  if (
    input.config.accountKey !== input.expectedAccountKey ||
    input.config.productKey !== input.expectedProductKey
  ) {
    throw new Error('free_pilot_command_scope_mismatch');
  }
}

function assertBoundedExpiry(expiresAt: Date, now: Date) {
  if (!Number.isFinite(expiresAt.getTime()) || expiresAt <= now) {
    throw new Error('free_pilot_expiry_must_be_future');
  }
  if (expiresAt.getTime() - now.getTime() > MAX_FREE_PILOT_DURATION_MS) {
    throw new Error('free_pilot_expiry_exceeds_governed_window');
  }
}

function requiredDate(value: Date | undefined, code: string) {
  if (!value || !Number.isFinite(value.getTime())) throw new Error(code);
  return value;
}

function requiredString(value: string | undefined, code: string) {
  if (!value?.trim()) throw new Error(code);
  return value.trim();
}

function digestRef(kind: string, value: string) {
  return `${kind}:sha256:${createHash('sha256').update(value).digest('hex')}`;
}
