import type { AppConfig } from '../../../config/src/index.ts';
import {
  supportStatusResponseSchema,
  type SupportStatusResponse,
} from '../../../contracts/src/support/index.ts';
import type { DbPool, Queryable } from '../../../db/src/index.ts';
import { inTransaction } from '../../../db/src/index.ts';
import {
  createOt89SignedHeaders,
  OT89_EVENT_TARGET,
  OT89_STATUS_TARGET,
  sha256Hex,
} from './hmac.ts';
import { insertSupportAudit, updateLocalSupportStatus } from './service.ts';

export const SUPPORT_CLAIM_BATCH_SQL = `
WITH candidates AS (
  SELECT outbox.id
    FROM onetime.support_outbox AS outbox
   WHERE outbox.account_key = $1
     AND outbox.product_key = $2
     AND (
       (outbox.status = 'PENDING' AND outbox.next_attempt_at <= $3::timestamptz)
       OR
       (outbox.status = 'PROCESSING' AND outbox.lease_expires_at <= $3::timestamptz)
     )
   ORDER BY outbox.next_attempt_at ASC, outbox.created_at ASC, outbox.id ASC
   LIMIT $4
   FOR UPDATE SKIP LOCKED
), claimed AS (
  UPDATE onetime.support_outbox AS outbox
     SET status = 'PROCESSING',
         attempts = outbox.attempts + 1,
         lease_expires_at = $5::timestamptz,
         first_attempt_at = COALESCE(outbox.first_attempt_at, $3::timestamptz),
         updated_at = $3::timestamptz
    FROM candidates
   WHERE outbox.id = candidates.id
     AND outbox.account_key = $1
     AND outbox.product_key = $2
  RETURNING outbox.*
)
SELECT * FROM claimed
ORDER BY next_attempt_at ASC, created_at ASC, id ASC
`;

const SUPPORT_CLAIM_BATCH_SQL_NO_SKIP_LOCKED = SUPPORT_CLAIM_BATCH_SQL.replace(
  '   FOR UPDATE SKIP LOCKED',
  '',
);

type SupportClaim = {
  id: string;
  outboxId: string;
  eventId: string;
  sourceTicketId: string;
  rawBody: string;
  bodyFingerprint: string;
  attempts: number;
  createdAt: Date;
  leaseExpiresAt: Date;
};

export type SupportDeliverySummary = {
  claimed: number;
  delivered: number;
  retried: number;
  deadLettered: number;
  skipped: number;
  leaseLost: number;
  statusRefreshed: number;
};

export type SupportDeliveryOptions = {
  batchSize?: number | undefined;
  claimLeaseMs?: number | undefined;
  requestTimeoutMs?: number | undefined;
  maxAttempts?: number | undefined;
  maxAgeMs?: number | undefined;
};

type NormalizedSupportDeliveryOptions = {
  batchSize: number;
  claimLeaseMs: number;
  requestTimeoutMs: number;
  maxAttempts: number;
  maxAgeMs: number;
};

type FetchLike = typeof fetch;

export async function runSupportDeliveryBatch(input: {
  pool: DbPool;
  config: AppConfig;
  options?: SupportDeliveryOptions | undefined;
  fetchImpl?: FetchLike | undefined;
  clock?: () => Date;
}): Promise<SupportDeliverySummary> {
  const summary = emptySummary();
  if (input.config.ot89SupportDeliveryMode !== 'mock') {
    summary.skipped += 1;
    return summary;
  }
  const baseUrl = input.config.ot89SupportBnaBaseUrl;
  if (!baseUrl) {
    summary.skipped += 1;
    return summary;
  }
  const options = normalizeOptions(input.options);
  const clock = input.clock ?? (() => new Date());
  const claims = await claimSupportOutbox({
    pool: input.pool,
    config: input.config,
    now: clock(),
    limit: options.batchSize,
    leaseMs: options.claimLeaseMs,
  });
  summary.claimed = claims.length;
  for (const claim of claims) {
    const outcome = await deliverClaim({
      claim,
      config: input.config,
      baseUrl,
      fetchImpl: input.fetchImpl ?? fetch,
      options,
      clock,
    });
    const completed = await completeClaim({
      pool: input.pool,
      config: input.config,
      claim,
      outcome,
      now: clock(),
    });
    if (!completed) {
      summary.leaseLost += 1;
      continue;
    }
    if (outcome.kind === 'delivered') summary.delivered += 1;
    else if (outcome.kind === 'retry') summary.retried += 1;
    else summary.deadLettered += 1;
  }
  return summary;
}

export async function refreshSupportStatusProjection(input: {
  pool: DbPool;
  config: AppConfig;
  sourceTicketId: string;
  fetchImpl?: FetchLike | undefined;
  now?: Date | undefined;
}): Promise<SupportStatusResponse | null> {
  if (input.config.ot89SupportDeliveryMode !== 'mock' || !input.config.ot89SupportBnaBaseUrl) {
    return null;
  }
  const body = JSON.stringify({
    source_ticket_id: input.sourceTicketId,
    onetime_account_id: input.config.accountKey,
  });
  const response = await (input.fetchImpl ?? fetch)(
    `${input.config.ot89SupportBnaBaseUrl}${OT89_STATUS_TARGET}`,
    {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        ...createOt89SignedHeaders({
          keyId: input.config.ot89SupportHmacKeyId,
          secret: input.config.ot89SupportHmacSecret,
          method: 'POST',
          requestTarget: OT89_STATUS_TARGET,
          rawBody: body,
          now: input.now,
        }),
      },
      body,
    },
  );
  if (!response.ok) return null;
  const parsed = supportStatusResponseSchema.safeParse(await response.json());
  if (!parsed.success) return null;
  await updateLocalSupportStatus({ target: input.pool, config: input.config, status: parsed.data });
  await insertSupportAudit(input.pool, input.config, {
    sourceTicketId: input.sourceTicketId,
    actorUserKey: null,
    eventType: 'support_status_projection_refreshed',
    metadata: { status: parsed.data.status, status_version: parsed.data.status_version },
  });
  return parsed.data;
}

export async function requeueSupportDeadLetter(input: {
  pool: DbPool;
  config: AppConfig;
  sourceTicketId: string;
  actorUserKey: string;
  reason: string;
  now?: Date | undefined;
}): Promise<boolean> {
  const now = input.now ?? new Date();
  return inTransaction(input.pool, async (client) => {
    const updated = await client.query(
      `UPDATE onetime.support_outbox
          SET status = 'PENDING',
              next_attempt_at = $4::timestamptz,
              lease_expires_at = NULL,
              last_error_code = NULL,
              last_http_status = NULL,
              updated_at = $4::timestamptz
        WHERE account_key = $1
          AND product_key = $2
          AND source_ticket_id = $3
          AND status = 'DEAD_LETTER'
        RETURNING outbox_id`,
      [input.config.accountKey, input.config.productKey, input.sourceTicketId, now.toISOString()],
    );
    if (!updated.rowCount) return false;
    await client.query(
      `UPDATE onetime.support_status_projection
          SET delivery_state = 'delivery_delayed',
              public_summary = 'Support delivery was requeued by an operator.',
              updated_at = $4::timestamptz
        WHERE account_key = $1
          AND product_key = $2
          AND source_ticket_id = $3`,
      [input.config.accountKey, input.config.productKey, input.sourceTicketId, now.toISOString()],
    );
    await insertSupportAudit(client, input.config, {
      sourceTicketId: input.sourceTicketId,
      actorUserKey: input.actorUserKey,
      eventType: 'support_dead_letter_requeued',
      metadata: { reason: input.reason.slice(0, 120) },
    });
    return true;
  });
}

async function claimSupportOutbox(input: {
  pool: DbPool;
  config: AppConfig;
  now: Date;
  limit: number;
  leaseMs: number;
}): Promise<SupportClaim[]> {
  const client = await input.pool.connect();
  const leaseExpiresAt = new Date(input.now.getTime() + input.leaseMs);
  try {
    await client.query('BEGIN');
    const result = isMemoryPool(input.pool)
      ? await claimSupportOutboxMemoryCompatible(client, input, leaseExpiresAt)
      : await claimSupportOutboxPostgres(client, input, leaseExpiresAt);
    await client.query('COMMIT');
    return result.rows.map(parseClaim);
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

async function claimSupportOutboxPostgres(
  client: Queryable,
  input: {
    config: AppConfig;
    now: Date;
    limit: number;
  },
  leaseExpiresAt: Date,
) {
  try {
    return await client.query(SUPPORT_CLAIM_BATCH_SQL, [
      input.config.accountKey,
      input.config.productKey,
      input.now,
      input.limit,
      leaseExpiresAt,
    ]);
  } catch (error) {
    if (!String(error).includes('SKIP LOCKED')) throw error;
    return client.query(SUPPORT_CLAIM_BATCH_SQL_NO_SKIP_LOCKED, [
      input.config.accountKey,
      input.config.productKey,
      input.now,
      input.limit,
      leaseExpiresAt,
    ]);
  }
}

async function claimSupportOutboxMemoryCompatible(
  client: Queryable,
  input: {
    config: AppConfig;
    now: Date;
    limit: number;
  },
  leaseExpiresAt: Date,
) {
  const candidates = await client.query(
    `SELECT *
       FROM onetime.support_outbox
      WHERE account_key = $1
        AND product_key = $2
        AND (
          (status = 'PENDING' AND next_attempt_at <= $3::timestamptz)
          OR
          (status = 'PROCESSING' AND lease_expires_at <= $3::timestamptz)
        )
      ORDER BY next_attempt_at ASC, created_at ASC, id ASC
      LIMIT $4`,
    [input.config.accountKey, input.config.productKey, input.now, input.limit],
  );
  const rows: Record<string, unknown>[] = [];
  for (const candidate of candidates.rows) {
    const updated = await client.query(
      `UPDATE onetime.support_outbox
          SET status = 'PROCESSING',
              attempts = attempts + 1,
              lease_expires_at = $2::timestamptz,
              first_attempt_at = COALESCE(first_attempt_at, $3::timestamptz),
              updated_at = $3::timestamptz
        WHERE id = $1
        RETURNING *`,
      [candidate.id, leaseExpiresAt, input.now],
    );
    if (updated.rows[0]) rows.push(updated.rows[0]);
  }
  return { rows, rowCount: rows.length };
}

function isMemoryPool(pool: DbPool) {
  return Boolean((pool as DbPool & { __memory?: boolean }).__memory);
}

type DeliveryOutcome =
  | {
      kind: 'delivered';
      bnaTicketRef: string;
      status: SupportStatusResponse;
      responseFingerprint: string;
    }
  | { kind: 'retry'; errorCode: string; httpStatus: number | null; nextAttemptAt: Date }
  | { kind: 'dead_letter'; errorCode: string; httpStatus: number | null };

async function deliverClaim(input: {
  claim: SupportClaim;
  config: AppConfig;
  baseUrl: string;
  fetchImpl: FetchLike;
  options: NormalizedSupportDeliveryOptions;
  clock: () => Date;
}): Promise<DeliveryOutcome> {
  if (sha256Hex(input.claim.rawBody) !== input.claim.bodyFingerprint) {
    return { kind: 'dead_letter', errorCode: 'body_fingerprint_mismatch', httpStatus: null };
  }
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), input.options.requestTimeoutMs);
  try {
    const response = await input.fetchImpl(`${input.baseUrl}${OT89_EVENT_TARGET}`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        ...createOt89SignedHeaders({
          keyId: input.config.ot89SupportHmacKeyId,
          secret: input.config.ot89SupportHmacSecret,
          method: 'POST',
          requestTarget: OT89_EVENT_TARGET,
          rawBody: input.claim.rawBody,
          eventId: input.claim.eventId,
          now: input.clock(),
        }),
      },
      body: input.claim.rawBody,
      signal: controller.signal,
    });
    const responseText = await response.text();
    const responseFingerprint = sha256Hex(responseText);
    if (response.status === 200 || response.status === 202) {
      const parsed = parseAcceptedResponse(responseText, input.claim.sourceTicketId);
      if (parsed) {
        return {
          kind: 'delivered',
          bnaTicketRef: parsed.bna_ticket_ref,
          status: parsed,
          responseFingerprint,
        };
      }
      return {
        kind: 'dead_letter',
        errorCode: 'accepted_response_invalid',
        httpStatus: response.status,
      };
    }
    if (
      isRetryableStatus(response.status) &&
      !shouldStopRetrying(input.claim, input.options, input.clock())
    ) {
      return {
        kind: 'retry',
        errorCode: `http_${response.status}`,
        httpStatus: response.status,
        nextAttemptAt: nextSupportRetryAt(input.claim, input.clock()),
      };
    }
    return {
      kind: 'dead_letter',
      errorCode: `http_${response.status}`,
      httpStatus: response.status,
    };
  } catch (error) {
    void error;
    if (shouldStopRetrying(input.claim, input.options, input.clock())) {
      return { kind: 'dead_letter', errorCode: 'network_or_timeout', httpStatus: null };
    }
    return {
      kind: 'retry',
      errorCode: 'network_or_timeout',
      httpStatus: null,
      nextAttemptAt: nextSupportRetryAt(input.claim, input.clock()),
    };
  } finally {
    clearTimeout(timeout);
  }
}

async function completeClaim(input: {
  pool: DbPool;
  config: AppConfig;
  claim: SupportClaim;
  outcome: DeliveryOutcome;
  now: Date;
}): Promise<boolean> {
  return inTransaction(input.pool, async (client) => {
    const columns = outcomeColumns(input.outcome, input.now);
    const updated = await client.query(
      `UPDATE onetime.support_outbox
          SET status = $2,
              next_attempt_at = $3::timestamptz,
              delivered_at = $4::timestamptz,
              lease_expires_at = NULL,
              bna_ticket_ref = $5,
              last_error_code = $6,
              last_http_status = $7,
              updated_at = $8::timestamptz
        WHERE outbox_id = $1
          AND account_key = $9
          AND product_key = $10
          AND status = 'PROCESSING'
          AND lease_expires_at = $11::timestamptz
          AND lease_expires_at > $8::timestamptz
        RETURNING outbox_id`,
      [
        input.claim.outboxId,
        columns.status,
        columns.nextAttemptAt.toISOString(),
        columns.deliveredAt?.toISOString() ?? null,
        input.outcome.kind === 'delivered' ? input.outcome.bnaTicketRef : null,
        input.outcome.kind === 'delivered' ? null : input.outcome.errorCode,
        input.outcome.kind === 'delivered' ? null : input.outcome.httpStatus,
        input.now.toISOString(),
        input.config.accountKey,
        input.config.productKey,
        input.claim.leaseExpiresAt.toISOString(),
      ],
    );
    if (!updated.rowCount) return false;
    await client.query(
      `INSERT INTO onetime.support_delivery_attempts
       (attempt_key, outbox_id, event_id, source_ticket_id, attempt_number, outcome,
        http_status, error_code, response_fingerprint)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [
        `support_attempt_${sha256Hex(
          `${input.claim.outboxId}\0${input.claim.attempts}\0${input.outcome.kind}`,
        ).slice(0, 24)}`,
        input.claim.outboxId,
        input.claim.eventId,
        input.claim.sourceTicketId,
        input.claim.attempts,
        input.outcome.kind === 'delivered'
          ? 'DELIVERED'
          : input.outcome.kind === 'retry'
            ? 'RETRY'
            : 'DEAD_LETTER',
        input.outcome.kind === 'delivered' ? null : input.outcome.httpStatus,
        input.outcome.kind === 'delivered' ? null : input.outcome.errorCode,
        input.outcome.kind === 'delivered' ? input.outcome.responseFingerprint : null,
      ],
    );
    if (input.outcome.kind === 'delivered') {
      await updateLocalSupportStatus({
        target: client,
        config: input.config,
        status: input.outcome.status,
      });
      await client.query(
        `UPDATE onetime.support_submissions
            SET delivery_state = 'DELIVERED', updated_at = $4::timestamptz
          WHERE account_key = $1 AND product_key = $2 AND source_ticket_id = $3`,
        [
          input.config.accountKey,
          input.config.productKey,
          input.claim.sourceTicketId,
          input.now.toISOString(),
        ],
      );
    } else {
      const deliveryState = input.outcome.kind === 'retry' ? 'delivery_delayed' : 'dead_letter';
      await client.query(
        `UPDATE onetime.support_status_projection
            SET delivery_state = $4,
                public_summary = $5,
                updated_at = $6::timestamptz
          WHERE account_key = $1 AND product_key = $2 AND source_ticket_id = $3`,
        [
          input.config.accountKey,
          input.config.productKey,
          input.claim.sourceTicketId,
          deliveryState,
          input.outcome.kind === 'retry'
            ? 'Support request is saved. Delivery to the support desk is delayed and will retry.'
            : 'Support request is saved, but delivery needs operator review.',
          input.now.toISOString(),
        ],
      );
      await client.query(
        `UPDATE onetime.support_submissions
            SET delivery_state = $4, updated_at = $5::timestamptz
          WHERE account_key = $1 AND product_key = $2 AND source_ticket_id = $3`,
        [
          input.config.accountKey,
          input.config.productKey,
          input.claim.sourceTicketId,
          input.outcome.kind === 'retry' ? 'DELIVERY_DELAYED' : 'DEAD_LETTER',
          input.now.toISOString(),
        ],
      );
    }
    await insertSupportAudit(client, input.config, {
      sourceTicketId: input.claim.sourceTicketId,
      actorUserKey: null,
      eventType:
        input.outcome.kind === 'delivered'
          ? 'support_delivery_delivered'
          : input.outcome.kind === 'retry'
            ? 'support_delivery_retry_scheduled'
            : 'support_delivery_dead_lettered',
      metadata: {
        outbox_id: input.claim.outboxId,
        attempt: input.claim.attempts,
        ...(input.outcome.kind === 'delivered'
          ? { bna_ticket_ref: input.outcome.bnaTicketRef }
          : { error_code: input.outcome.errorCode, http_status: input.outcome.httpStatus }),
      },
    });
    return true;
  });
}

function parseAcceptedResponse(
  responseText: string,
  sourceTicketId: string,
): SupportStatusResponse | null {
  try {
    const body = JSON.parse(responseText) as Record<string, unknown>;
    if (body.accepted !== true || body.source_ticket_id !== sourceTicketId) return null;
    return supportStatusResponseSchema.parse({
      source_ticket_id: body.source_ticket_id,
      bna_ticket_ref: body.bna_ticket_ref,
      status: body.ingestion_status === 'accepted' ? 'new' : body.ingestion_status,
      public_summary: 'Support ticket accepted by the support desk.',
      status_version: body.status_version,
      updated_at: body.received_at,
    });
  } catch {
    return null;
  }
}

function normalizeOptions(options?: SupportDeliveryOptions): NormalizedSupportDeliveryOptions {
  return {
    batchSize: options?.batchSize ?? 25,
    claimLeaseMs: options?.claimLeaseMs ?? 120_000,
    requestTimeoutMs: options?.requestTimeoutMs ?? 15_000,
    maxAttempts: options?.maxAttempts ?? 12,
    maxAgeMs: options?.maxAgeMs ?? 172_800_000,
  };
}

function emptySummary(): SupportDeliverySummary {
  return {
    claimed: 0,
    delivered: 0,
    retried: 0,
    deadLettered: 0,
    skipped: 0,
    leaseLost: 0,
    statusRefreshed: 0,
  };
}

function parseClaim(row: Record<string, unknown>): SupportClaim {
  return {
    id: String(row.id),
    outboxId: String(row.outbox_id),
    eventId: String(row.event_id),
    sourceTicketId: String(row.source_ticket_id),
    rawBody: String(row.raw_body),
    bodyFingerprint: String(row.body_fingerprint),
    attempts: Number(row.attempts),
    createdAt: asDate(row.created_at),
    leaseExpiresAt: asDate(row.lease_expires_at),
  };
}

function outcomeColumns(outcome: DeliveryOutcome, now: Date) {
  if (outcome.kind === 'delivered') {
    return { status: 'DELIVERED', nextAttemptAt: now, deliveredAt: now };
  }
  if (outcome.kind === 'retry') {
    return { status: 'PENDING', nextAttemptAt: outcome.nextAttemptAt, deliveredAt: null };
  }
  return { status: 'DEAD_LETTER', nextAttemptAt: now, deliveredAt: null };
}

function isRetryableStatus(status: number) {
  return [408, 425, 429, 500, 502, 503, 504].includes(status);
}

function shouldStopRetrying(
  claim: SupportClaim,
  options: NormalizedSupportDeliveryOptions,
  now: Date,
) {
  return (
    claim.attempts >= options.maxAttempts ||
    now.getTime() - claim.createdAt.getTime() >= options.maxAgeMs
  );
}

function nextSupportRetryAt(claim: SupportClaim, now: Date) {
  const cap = Math.min(6 * 60 * 60 * 1000, 30_000 * 2 ** Math.max(0, claim.attempts - 1));
  const byte = Buffer.from(sha256Hex(`${claim.outboxId}\0${claim.attempts}`), 'hex')[0] ?? 128;
  return new Date(now.getTime() + Math.max(1_000, Math.round((byte / 255) * cap)));
}

function asDate(value: unknown) {
  if (value instanceof Date) return value;
  return new Date(String(value));
}
