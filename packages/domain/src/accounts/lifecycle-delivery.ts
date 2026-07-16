import { createCipheriv, createDecipheriv, createHash, randomBytes, randomUUID } from 'node:crypto';
import type { AppConfig } from '../../../config/src/index.ts';
import type { DbPool, Queryable } from '../../../db/src/index.ts';
import { inTransaction } from '../../../db/src/index.ts';
import type { AccountLifecycleTokenType } from '../../../contracts/src/accounts/index.ts';
import { stableKey } from '../lead/normalize.ts';

const KEY_VERSION = 1;
const DEFAULT_BATCH_SIZE = 10;
const DEFAULT_LEASE_MS = 120_000;

type LifecycleDeliveryState =
  | 'queued'
  | 'leased'
  | 'retry'
  | 'sink_delivered'
  | 'provider_delivered'
  | 'provider_off'
  | 'dead_letter'
  | 'superseded'
  | 'expired'
  | 'cleared';

type ClaimedLifecycleDelivery = {
  id: string;
  delivery_key: string;
  token_key: string;
  purpose: AccountLifecycleTokenType;
  nonce: string;
  ciphertext: string;
  auth_tag: string;
  attempts: number;
  max_attempts: number;
  lease_expires_at: Date;
  encrypted_payload_expires_at: Date;
};

export type LifecycleDeliveryCreateResult = {
  delivery_key: string;
  destination_ref: string;
  state: LifecycleDeliveryState;
  encrypted_payload_expires_at: string;
  raw_token_included: false;
};

export type LifecycleDeliveryBatchSummary = {
  claimed: number;
  sink_delivered: number;
  expired: number;
  retried: number;
  dead_lettered: number;
  lease_lost: number;
  external_send_performed: false;
  raw_token_logged: false;
};

export async function createLifecycleDeliveryOutbox(
  client: Queryable,
  config: AppConfig,
  input: {
    token: string;
    tokenKey: string;
    intentKey: string;
    tokenType: AccountLifecycleTokenType;
    recipientEmail: string;
    targetRole: string;
    idempotencyKey: string;
    expiresAt: Date;
    now: Date;
  },
): Promise<LifecycleDeliveryCreateResult> {
  const destinationRef = destinationReference(input.recipientEmail);
  const deliveryKey = stableKey('account_lifecycle_delivery_outbox', [
    config.accountKey,
    config.productKey,
    input.tokenType,
    input.idempotencyKey,
  ]);
  await supersedePriorDeliveries(client, config, {
    purpose: input.tokenType,
    destinationRef,
    deliveryKey,
    now: input.now,
  });
  const encrypted = encryptDeliveryPayload(config, {
    schema_version: 1,
    purpose: input.tokenType,
    token_key: input.tokenKey,
    token: input.token,
    activation_url: lifecycleUrl(config, input.tokenType, input.token),
    fragment_parameter: 'token',
    target_role: input.targetRole,
    issued_at: input.now.toISOString(),
    expires_at: input.expiresAt.toISOString(),
  });
  await client.query(
    `INSERT INTO onetime.account_lifecycle_delivery_outbox
       (delivery_key, account_key, product_key, token_key, intent_key, purpose, channel,
        transport_mode, destination_ref, key_id, key_version, nonce, ciphertext, auth_tag,
        encrypted_payload_expires_at, state, attempts, max_attempts, next_attempt_at,
        idempotency_key, metadata, created_at, updated_at)
     VALUES ($1,$2,$3,$4,$5,$6,'email','sink',$7,$8,$9,$10,$11,$12,$13,'queued',0,5,$14,$15,$16::jsonb,$17,$17)
     ON CONFLICT (account_key, product_key, purpose, idempotency_key)
     DO UPDATE SET updated_at = EXCLUDED.updated_at
     RETURNING delivery_key`,
    [
      deliveryKey,
      config.accountKey,
      config.productKey,
      input.tokenKey,
      input.intentKey,
      input.tokenType,
      destinationRef,
      config.lifecycleDeliveryKeyId,
      KEY_VERSION,
      encrypted.nonce,
      encrypted.ciphertext,
      encrypted.authTag,
      input.expiresAt,
      input.now,
      input.idempotencyKey,
      JSON.stringify({
        policy_version: 'ops03a-lifecycle-delivery-v1',
        raw_token_included: false,
        raw_url_included: false,
        destination_ref: destinationRef,
      }),
      input.now,
    ],
  );
  return {
    delivery_key: deliveryKey,
    destination_ref: destinationRef,
    state: 'queued',
    encrypted_payload_expires_at: input.expiresAt.toISOString(),
    raw_token_included: false,
  };
}

export async function runLifecycleDeliveryOutboxBatch(input: {
  pool: DbPool;
  config: AppConfig;
  now?: Date;
  limit?: number;
  leaseMs?: number;
  workerId?: string;
}): Promise<LifecycleDeliveryBatchSummary> {
  const now = input.now ?? new Date();
  const expired = await expireLifecycleDeliveries(input.pool, input.config, now);
  const claims = await claimLifecycleDeliveries(input.pool, input.config, {
    now,
    limit: input.limit ?? DEFAULT_BATCH_SIZE,
    leaseMs: input.leaseMs ?? DEFAULT_LEASE_MS,
    workerId: input.workerId ?? `lifecycle-worker-${randomUUID()}`,
  });
  const summary: LifecycleDeliveryBatchSummary = {
    claimed: claims.length,
    sink_delivered: 0,
    expired,
    retried: 0,
    dead_lettered: 0,
    lease_lost: 0,
    external_send_performed: false,
    raw_token_logged: false,
  };
  for (const claim of claims) {
    try {
      decryptDeliveryPayload(input.config, claim);
      const completed = await completeLifecycleDelivery(input.pool, input.config, claim, {
        state: 'sink_delivered',
        now,
        providerMessageRefHash: destinationReference(`sink:${claim.delivery_key}`),
      });
      if (completed) summary.sink_delivered += 1;
      else summary.lease_lost += 1;
    } catch (error) {
      const terminal = claim.attempts >= claim.max_attempts;
      const completed = await failLifecycleDelivery(input.pool, input.config, claim, {
        state: terminal ? 'dead_letter' : 'retry',
        now,
        errorCode: safeErrorCode(error),
      });
      if (!completed) summary.lease_lost += 1;
      else if (terminal) summary.dead_lettered += 1;
      else summary.retried += 1;
    }
  }
  return summary;
}

export function decryptLifecycleDeliveryPayloadForTests(
  config: AppConfig,
  row: {
    nonce: string;
    ciphertext: string;
    auth_tag: string;
  },
): Record<string, unknown> {
  return decryptDeliveryPayload(config, row);
}

function encryptDeliveryPayload(config: AppConfig, payload: Record<string, unknown>) {
  const nonce = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', lifecycleDeliveryKey(config), nonce);
  const ciphertext = Buffer.concat([
    cipher.update(JSON.stringify(payload), 'utf8'),
    cipher.final(),
  ]);
  return {
    nonce: nonce.toString('base64url'),
    ciphertext: ciphertext.toString('base64url'),
    authTag: cipher.getAuthTag().toString('base64url'),
  };
}

function decryptDeliveryPayload(
  config: AppConfig,
  row: { nonce: string; ciphertext: string; auth_tag: string },
): Record<string, unknown> {
  const decipher = createDecipheriv(
    'aes-256-gcm',
    lifecycleDeliveryKey(config),
    Buffer.from(row.nonce, 'base64url'),
  );
  decipher.setAuthTag(Buffer.from(row.auth_tag, 'base64url'));
  const text = Buffer.concat([
    decipher.update(Buffer.from(row.ciphertext, 'base64url')),
    decipher.final(),
  ]).toString('utf8');
  const parsed = JSON.parse(text) as unknown;
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('Lifecycle delivery payload did not decrypt to an object.');
  }
  return parsed as Record<string, unknown>;
}

function lifecycleDeliveryKey(config: AppConfig) {
  if (!config.lifecycleDeliveryKey) {
    throw new Error('ONE_TIME_LIFECYCLE_DELIVERY_KEY is required for lifecycle delivery.');
  }
  return createHash('sha256').update(config.lifecycleDeliveryKey).digest();
}

function lifecycleUrl(config: AppConfig, purpose: AccountLifecycleTokenType, token: string) {
  const path = purpose === 'password_reset' ? '/reset-password' : '/activate';
  return `${config.publicBaseUrl.replace(/\/+$/, '')}${path}#token=${encodeURIComponent(token)}`;
}

function destinationReference(emailNormalized: string) {
  return createHash('sha256').update(emailNormalized.trim().toLowerCase()).digest('hex');
}

async function supersedePriorDeliveries(
  client: Queryable,
  config: AppConfig,
  input: {
    purpose: AccountLifecycleTokenType;
    destinationRef: string;
    deliveryKey: string;
    now: Date;
  },
) {
  await client.query(
    `UPDATE onetime.account_lifecycle_delivery_outbox
        SET state = 'superseded',
            nonce = NULL,
            ciphertext = NULL,
            auth_tag = NULL,
            cleared_at = $5,
            updated_at = $5
      WHERE account_key = $1
        AND product_key = $2
        AND purpose = $3
        AND destination_ref = $4
        AND delivery_key <> $6
        AND state IN ('queued', 'leased', 'retry', 'provider_off')`,
    [
      config.accountKey,
      config.productKey,
      input.purpose,
      input.destinationRef,
      input.now,
      input.deliveryKey,
    ],
  );
}

async function expireLifecycleDeliveries(pool: DbPool, config: AppConfig, now: Date) {
  const result = await pool.query(
    `UPDATE onetime.account_lifecycle_delivery_outbox
        SET state = 'expired',
            nonce = NULL,
            ciphertext = NULL,
            auth_tag = NULL,
            cleared_at = $3,
            updated_at = $3
      WHERE account_key = $1
        AND product_key = $2
        AND state IN ('queued', 'leased', 'retry', 'provider_off')
        AND encrypted_payload_expires_at <= $3
      RETURNING delivery_key`,
    [config.accountKey, config.productKey, now],
  );
  return result.rowCount ?? 0;
}

async function claimLifecycleDeliveries(
  pool: DbPool,
  config: AppConfig,
  input: { now: Date; limit: number; leaseMs: number; workerId: string },
) {
  return inTransaction(pool, async (client) => {
    const leaseExpiresAt = new Date(input.now.getTime() + input.leaseMs);
    const lockClause = isMemoryPool(pool) ? '' : 'FOR UPDATE SKIP LOCKED';
    const selected = await client.query(
      `SELECT id
         FROM onetime.account_lifecycle_delivery_outbox
        WHERE account_key = $1
          AND product_key = $2
          AND transport_mode = 'sink'
          AND encrypted_payload_expires_at > $3::timestamptz
          AND (
            (state IN ('queued', 'retry') AND next_attempt_at <= $3::timestamptz)
            OR (state = 'leased' AND lease_expires_at <= $3::timestamptz)
          )
        ORDER BY next_attempt_at ASC, created_at ASC, id ASC
        LIMIT $4
        ${lockClause}`,
      [config.accountKey, config.productKey, input.now, input.limit],
    );
    const claims: ClaimedLifecycleDelivery[] = [];
    for (const row of selected.rows) {
      const updated = await client.query(
        `UPDATE onetime.account_lifecycle_delivery_outbox
            SET state = 'leased',
                attempts = attempts + 1,
                lease_owner = $5,
                lease_expires_at = $6::timestamptz,
                updated_at = $4::timestamptz
          WHERE id = $1
            AND account_key = $2
            AND product_key = $3
          RETURNING id, delivery_key, token_key, purpose, nonce, ciphertext, auth_tag,
                    attempts, max_attempts, lease_expires_at, encrypted_payload_expires_at`,
        [row.id, config.accountKey, config.productKey, input.now, input.workerId, leaseExpiresAt],
      );
      if (updated.rows[0]) claims.push(mapClaim(updated.rows[0]));
    }
    return claims;
  });
}

function isMemoryPool(pool: DbPool) {
  return Boolean((pool as DbPool & { __memory?: boolean }).__memory);
}

async function completeLifecycleDelivery(
  pool: DbPool,
  config: AppConfig,
  claim: ClaimedLifecycleDelivery,
  input: {
    state: 'sink_delivered' | 'provider_delivered';
    now: Date;
    providerMessageRefHash: string;
  },
) {
  const result = await pool.query(
    `UPDATE onetime.account_lifecycle_delivery_outbox
        SET state = $4,
            nonce = NULL,
            ciphertext = NULL,
            auth_tag = NULL,
            provider_message_ref_hash = $5,
            delivered_at = $6,
            cleared_at = $6,
            updated_at = $6
      WHERE id = $1
        AND account_key = $2
        AND product_key = $3
        AND state = 'leased'
        AND lease_expires_at = $7
      RETURNING delivery_key`,
    [
      claim.id,
      config.accountKey,
      config.productKey,
      input.state,
      input.providerMessageRefHash,
      input.now,
      claim.lease_expires_at,
    ],
  );
  return Boolean(result.rowCount);
}

async function failLifecycleDelivery(
  pool: DbPool,
  config: AppConfig,
  claim: ClaimedLifecycleDelivery,
  input: { state: 'retry' | 'dead_letter'; now: Date; errorCode: string },
) {
  const nextAttemptAt =
    input.state === 'retry'
      ? new Date(input.now.getTime() + Math.min(60_000 * Math.max(1, claim.attempts), 300_000))
      : input.now;
  const result = await pool.query(
    `UPDATE onetime.account_lifecycle_delivery_outbox
        SET state = $4,
            next_attempt_at = $5,
            last_error_code = $6,
            dead_lettered_at = CASE WHEN $4 = 'dead_letter' THEN $7::timestamptz ELSE dead_lettered_at END,
            nonce = CASE WHEN $4 = 'dead_letter' THEN NULL ELSE nonce END,
            ciphertext = CASE WHEN $4 = 'dead_letter' THEN NULL ELSE ciphertext END,
            auth_tag = CASE WHEN $4 = 'dead_letter' THEN NULL ELSE auth_tag END,
            cleared_at = CASE WHEN $4 = 'dead_letter' THEN $7::timestamptz ELSE cleared_at END,
            updated_at = $7
      WHERE id = $1
        AND account_key = $2
        AND product_key = $3
        AND state = 'leased'
        AND lease_expires_at = $8
      RETURNING delivery_key`,
    [
      claim.id,
      config.accountKey,
      config.productKey,
      input.state,
      nextAttemptAt,
      input.errorCode,
      input.now,
      claim.lease_expires_at,
    ],
  );
  return Boolean(result.rowCount);
}

function mapClaim(row: Record<string, unknown>): ClaimedLifecycleDelivery {
  return {
    id: stringValue(row.id),
    delivery_key: stringValue(row.delivery_key),
    token_key: stringValue(row.token_key),
    purpose: stringValue(row.purpose) as AccountLifecycleTokenType,
    nonce: stringValue(row.nonce),
    ciphertext: stringValue(row.ciphertext),
    auth_tag: stringValue(row.auth_tag),
    attempts: Number(row.attempts ?? 0),
    max_attempts: Number(row.max_attempts ?? 5),
    lease_expires_at: dateValue(row.lease_expires_at),
    encrypted_payload_expires_at: dateValue(row.encrypted_payload_expires_at),
  };
}

function stringValue(value: unknown) {
  if (typeof value === 'string') return value;
  return String(value ?? '');
}

function dateValue(value: unknown) {
  if (value instanceof Date) return value;
  const parsed = new Date(String(value));
  if (Number.isNaN(parsed.getTime())) {
    throw new Error('Invalid lifecycle delivery timestamp.');
  }
  return parsed;
}

function safeErrorCode(error: unknown) {
  const value = error instanceof Error ? error.message : String(error);
  return value.replace(/[^a-z0-9_.:-]/gi, '_').slice(0, 120) || 'unknown_lifecycle_error';
}
