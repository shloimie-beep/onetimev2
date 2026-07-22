import { createHash, randomUUID } from 'node:crypto';
import type { AppConfig } from '../../../config/src/index.ts';
import type { DbPool } from '../../../db/src/index.ts';
import { inTransaction } from '../../../db/src/index.ts';
import { TISHA_BAV_EVENT_CODE } from './tisha-bav.ts';
import { TISHA_BAV_EMAIL_SENDER, TISHA_BAV_LANDING_PATH } from './tisha-bav-communications.ts';

const DEFAULT_LIMIT = 10;
const DEFAULT_LEASE_MS = 120_000;
const MAX_ATTEMPTS = 3;

type FallbackClaim = {
  delivery_key: string;
  registration_key: string;
  idempotency_key: string;
  protected_payload: Record<string, unknown>;
  attempts: number;
  lease_owner_hash: string;
};

export type TishaBavFallbackBatchSummary = {
  claimed: number;
  delivered: number;
  skipped: number;
  failed: number;
  external_send_performed: boolean;
};

export async function runTishaBavEventEmailFallbackBatch(input: {
  pool: DbPool;
  config: AppConfig;
  now?: Date;
  limit?: number;
  leaseMs?: number;
  workerId?: string;
  fetchImpl?: typeof fetch;
}): Promise<TishaBavFallbackBatchSummary> {
  if (input.config.oneTimeEventEmailFallback !== 'resend') return emptySummary();
  assertFallbackTransportReady(input.config);
  const now = input.now ?? new Date();
  const claims = await claimFallbacks(input.pool, input.config, {
    now,
    limit: Math.min(
      input.limit ?? DEFAULT_LIMIT,
      input.config.deliveryProviderPerRunBudget,
      input.config.deliveryProviderPerProviderBudget,
    ),
    leaseMs: input.leaseMs ?? DEFAULT_LEASE_MS,
    workerId: input.workerId ?? `tisha-fallback-${randomUUID()}`,
  });
  const summary = emptySummary();
  summary.claimed = claims.length;
  for (const claim of claims) {
    const eligibility = await fallbackEligibility(input.pool, input.config, claim.registration_key);
    if (!eligibility.allowed) {
      await finishFallback(input.pool, input.config, claim, {
        status: 'skipped',
        now,
        metadata: { blocked_reason: eligibility.reason },
      });
      summary.skipped += 1;
      continue;
    }
    if (now > payloadExpiry(claim.protected_payload)) {
      await finishFallback(input.pool, input.config, claim, {
        status: 'skipped',
        now,
        metadata: { blocked_reason: 'event_confirmation_window_expired' },
      });
      summary.skipped += 1;
      continue;
    }
    try {
      const providerReferenceHash = await sendFallback({
        config: input.config,
        claim,
        fetchImpl: input.fetchImpl ?? fetch,
      });
      await finishFallback(input.pool, input.config, claim, {
        status: 'succeeded',
        now,
        providerReferenceHash,
        metadata: { provider_accepted: true },
      });
      summary.delivered += 1;
      summary.external_send_performed = true;
    } catch (error) {
      await finishFallback(input.pool, input.config, claim, {
        status: 'failed',
        now,
        metadata: { failure_code: safeErrorCode(error) },
      });
      summary.failed += 1;
    }
  }
  return summary;
}

function assertFallbackTransportReady(config: AppConfig) {
  if (!config.deliveryProviderTransportEnabled || !config.resendTransportEnabled) {
    throw new Error('event_fallback_resend_transport_not_fully_enabled');
  }
  if (!config.deliveryProviderAuthorizationId) {
    throw new Error('event_fallback_authorization_missing');
  }
  if (!config.resendApiKey) throw new Error('event_fallback_resend_api_key_missing');
  if (config.deliveryProviderPerRunBudget <= 0 || config.deliveryProviderPerProviderBudget <= 0) {
    throw new Error('event_fallback_budget_missing');
  }
}

async function claimFallbacks(
  pool: DbPool,
  config: AppConfig,
  input: { now: Date; limit: number; leaseMs: number; workerId: string },
) {
  if (input.limit <= 0) return [];
  return inTransaction(pool, async (client) => {
    const lockClause = isMemoryPool(pool) ? '' : 'FOR UPDATE SKIP LOCKED';
    const selected = await client.query<FallbackClaim>(
      `SELECT delivery_key, registration_key, idempotency_key, protected_payload, attempts
         FROM onetime.event_delivery_events
        WHERE account_key = $1
          AND product_key = $2
          AND event_code = $3
          AND provider = 'resend_fallback'
          AND status IN ('pending','failed')
          AND next_attempt_at <= $4
          AND attempts < $5
          AND (lease_expires_at IS NULL OR lease_expires_at <= $4)
        ORDER BY next_attempt_at, created_at, delivery_key
        LIMIT $6
        ${lockClause}`,
      [
        config.accountKey,
        config.productKey,
        TISHA_BAV_EVENT_CODE,
        input.now,
        MAX_ATTEMPTS,
        input.limit,
      ],
    );
    const claims: FallbackClaim[] = [];
    for (const row of selected.rows) {
      const updated = await client.query<FallbackClaim>(
        `UPDATE onetime.event_delivery_events
            SET attempts = attempts + 1,
                lease_owner_hash = $5,
                lease_expires_at = $6,
                updated_at = $4
          WHERE delivery_key = $1
            AND account_key = $2
            AND product_key = $3
            AND status IN ('pending','failed')
            AND (lease_expires_at IS NULL OR lease_expires_at <= $4)
          RETURNING delivery_key, registration_key, idempotency_key, protected_payload, attempts,
                    lease_owner_hash`,
        [
          row.delivery_key,
          config.accountKey,
          config.productKey,
          input.now,
          hash(input.workerId),
          new Date(input.now.getTime() + input.leaseMs),
        ],
      );
      if (updated.rows[0]) claims.push(normalizeClaim(updated.rows[0]));
    }
    return claims;
  });
}

async function fallbackEligibility(pool: DbPool, config: AppConfig, registrationKey: string) {
  const result = await pool.query<{
    status: string;
    contact_suppression_state: string | null;
  }>(
    `SELECT permissions.status,
            contacts.suppression_state AS contact_suppression_state
       FROM onetime.event_email_permissions AS permissions
       LEFT JOIN onetime.contacts AS contacts
         ON contacts.account_key = permissions.account_key
        AND contacts.product_key = permissions.product_key
        AND contacts.email_normalized = permissions.email_normalized
      WHERE permissions.account_key = $1
        AND permissions.product_key = $2
        AND permissions.event_code = $3
        AND permissions.registration_key = $4
      LIMIT 1`,
    [config.accountKey, config.productKey, TISHA_BAV_EVENT_CODE, registrationKey],
  );
  const row = result.rows[0];
  if (!row) return { allowed: false, reason: 'event_permission_missing' } as const;
  if (row.status !== 'granted') {
    return { allowed: false, reason: `event_permission_${row.status}` } as const;
  }
  if (row.contact_suppression_state && row.contact_suppression_state !== 'active') {
    return { allowed: false, reason: 'contact_suppression_active' } as const;
  }
  return { allowed: true, reason: null } as const;
}

async function sendFallback(input: {
  config: AppConfig;
  claim: FallbackClaim;
  fetchImpl: typeof fetch;
}) {
  const payload = input.claim.protected_payload;
  const email = requiredString(payload, 'email_normalized');
  const firstName = optionalString(payload, 'first_name') ?? 'there';
  const subject = requiredString(payload, 'subject');
  const body = requiredString(payload, 'body')
    .replace('{{default contact.first_name "there"}}', firstName)
    .replace('[View Event Details]', `${input.config.publicBaseUrl}${TISHA_BAV_LANDING_PATH}`);
  const response = await input.fetchImpl('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${input.config.resendApiKey ?? ''}`,
      'Content-Type': 'application/json',
      'Idempotency-Key': input.claim.idempotency_key,
    },
    body: JSON.stringify({
      from: `${TISHA_BAV_EMAIL_SENDER.visibleName} <${TISHA_BAV_EMAIL_SENDER.from}>`,
      to: [email],
      reply_to: [TISHA_BAV_EMAIL_SENDER.replyTo],
      subject,
      text: body,
      html: `<div style="white-space:pre-line">${escapeHtml(body)}</div>`,
      tags: [
        { name: 'message_key', value: 'tisha_bav_2026_registration_confirmation' },
        { name: 'purpose', value: 'event_service_email' },
      ],
    }),
  });
  if (!response.ok) throw new Error(`event_fallback_resend_http_${response.status}`);
  const result = (await response.json().catch(() => ({}))) as { id?: unknown };
  return hash(typeof result.id === 'string' ? `resend:${result.id}` : `resend:${response.status}`);
}

async function finishFallback(
  pool: DbPool,
  config: AppConfig,
  claim: FallbackClaim,
  input: {
    status: 'succeeded' | 'failed' | 'skipped';
    now: Date;
    metadata: Record<string, unknown>;
    providerReferenceHash?: string;
  },
) {
  const current = await pool.query<{ public_metadata: Record<string, unknown> }>(
    `SELECT public_metadata
       FROM onetime.event_delivery_events
      WHERE delivery_key = $1
      LIMIT 1`,
    [claim.delivery_key],
  );
  const publicMetadata = {
    ...normalizeJsonRecord(current.rows[0]?.public_metadata),
    ...input.metadata,
  };
  const nextAttemptAt =
    input.status === 'failed'
      ? new Date(input.now.getTime() + Math.min(60_000 * claim.attempts, 300_000))
      : input.now;
  await pool.query(
    `UPDATE onetime.event_delivery_events
        SET status = $4,
            provider_result_reference_hash = COALESCE($5, provider_result_reference_hash),
            public_metadata = $6::jsonb,
            next_attempt_at = $7,
            completed_at = CASE WHEN $4 IN ('succeeded','skipped') THEN $8 ELSE completed_at END,
            lease_owner_hash = NULL,
            lease_expires_at = NULL,
            updated_at = $8
      WHERE delivery_key = $1
        AND account_key = $2
        AND product_key = $3
        AND lease_owner_hash = $9`,
    [
      claim.delivery_key,
      config.accountKey,
      config.productKey,
      input.status,
      input.providerReferenceHash ?? null,
      JSON.stringify(publicMetadata),
      nextAttemptAt,
      input.now,
      claim.lease_owner_hash,
    ],
  );
}

function normalizeClaim(row: FallbackClaim): FallbackClaim {
  return {
    delivery_key: String(row.delivery_key),
    registration_key: String(row.registration_key),
    idempotency_key: String(row.idempotency_key),
    protected_payload:
      typeof row.protected_payload === 'string'
        ? (JSON.parse(row.protected_payload) as Record<string, unknown>)
        : row.protected_payload,
    attempts: Number(row.attempts ?? 0),
    lease_owner_hash: String(row.lease_owner_hash ?? ''),
  };
}

function payloadExpiry(payload: Record<string, unknown>) {
  const value = new Date(requiredString(payload, 'expires_after'));
  if (Number.isNaN(value.getTime())) throw new Error('event_fallback_expiry_invalid');
  return value;
}

function requiredString(value: Record<string, unknown>, key: string) {
  const item = value[key];
  if (typeof item !== 'string' || !item) throw new Error(`event_fallback_${key}_missing`);
  return item;
}

function optionalString(value: Record<string, unknown>, key: string) {
  const item = value[key];
  return typeof item === 'string' && item ? item : null;
}

function emptySummary(): TishaBavFallbackBatchSummary {
  return { claimed: 0, delivered: 0, skipped: 0, failed: 0, external_send_performed: false };
}

function safeErrorCode(error: unknown) {
  const value = error instanceof Error ? error.message : String(error);
  return value.replace(/[^a-z0-9_.:-]/gi, '_').slice(0, 120) || 'event_fallback_unknown';
}

function hash(value: string) {
  return createHash('sha256').update(value).digest('hex');
}

function normalizeJsonRecord(value: unknown): Record<string, unknown> {
  if (typeof value === 'string') {
    const parsed = JSON.parse(value) as unknown;
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : {};
  }
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function isMemoryPool(pool: DbPool) {
  return Boolean((pool as DbPool & { __memory?: boolean }).__memory);
}
