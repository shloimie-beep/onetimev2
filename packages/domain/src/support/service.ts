import type { AppConfig } from '../../../config/src/index.ts';
import {
  supportEventV1Schema,
  supportReceiptResponseSchema,
  supportStatusRequestSchema,
  supportStatusResponseSchema,
  supportSubmissionPayloadSchema,
  type SupportEventV1,
  type SupportReceiptResponse,
  type SupportStatusResponse,
  type SupportSubmissionPayload,
} from '../../../contracts/src/support/index.ts';
import type { DbPool, Queryable } from '../../../db/src/index.ts';
import { inTransaction } from '../../../db/src/index.ts';
import {
  normalizeSupportAttachments,
  SupportAttachmentError,
  type NormalizedSupportAttachment,
} from './attachments.ts';
import {
  OT89_ATTACHMENT_TARGET_PREFIX,
  OT89_EVENT_TARGET,
  OT89_STATUS_TARGET,
  sha256Hex,
  verifyOt89Signature,
  type Ot89Headers,
} from './hmac.ts';
import { createSupportId, isOt89Id } from './ids.ts';
import { redactSupportText, supportPrivacy } from './redaction.ts';

type SessionLike = {
  session_key: string;
  user: {
    user_key: string;
    role: string;
  };
};

type EntitlementProof = {
  entitlementId: string;
  checkedAt: string;
  validUntil: string | null;
};

export class SupportSubmissionError extends Error {
  constructor(
    public readonly code: string,
    public readonly status: number,
    message: string,
    public readonly fieldErrors?: Record<string, string>,
  ) {
    super(message);
  }
}

export type SupportReceiptProjection = {
  receipt_id: string;
  source_ticket_id: string;
  status: string;
  public_summary: string;
  status_version: number;
  delivery_state: 'queued' | 'delivery_delayed' | 'delivered' | 'dead_letter';
  bna_ticket_ref: string | null;
  updated_at: string;
};

export function isSupportSubmissionAvailable(config: AppConfig): boolean {
  return Boolean(
    config.ot89SupportEnabled &&
    config.ot89SupportDeliveryMode === 'mock' &&
    config.ot89SupportBnaBaseUrl &&
    config.ot89SupportHmacKeyId &&
    config.ot89SupportHmacSecret &&
    config.ot89BnaToOnetimeHmacKeyId &&
    config.ot89BnaToOnetimeHmacSecret,
  );
}

export async function hasActiveSupportEntitlement(input: {
  target: DbPool | Queryable;
  config: AppConfig;
  userKey: string;
  now?: Date | undefined;
}): Promise<boolean> {
  return Boolean(await resolveActiveSupportEntitlement(input));
}

export async function createSupportSubmission(input: {
  pool: DbPool;
  config: AppConfig;
  session: SessionLike;
  payload: unknown;
  requestId: string;
  correlationId?: string | undefined;
  now?: Date | undefined;
}): Promise<SupportReceiptResponse> {
  if (!isSupportSubmissionAvailable(input.config)) {
    throw new SupportSubmissionError('SUPPORT_DISABLED', 503, 'Support is unavailable.');
  }
  const parsed = supportSubmissionPayloadSchema.safeParse(input.payload);
  if (!parsed.success) {
    throw new SupportSubmissionError('VALIDATION_ERROR', 400, 'Please check the support form.');
  }
  let attachments: NormalizedSupportAttachment[];
  try {
    attachments = await normalizeSupportAttachments(parsed.data.attachments);
  } catch (error) {
    if (error instanceof SupportAttachmentError) {
      throw new SupportSubmissionError(error.code, 400, error.message);
    }
    throw error;
  }
  const sanitized = sanitizePayload(parsed.data, attachments);
  const requestHash = sha256Hex(stableJson(sanitized.requestFingerprintSource));
  const now = input.now ?? new Date();

  return inTransaction(input.pool, async (client) => {
    const duplicate = await client.query(
      `SELECT submissions.receipt_id, submissions.source_ticket_id, submissions.request_hash,
              projection.delivery_state
         FROM onetime.support_submissions AS submissions
         JOIN onetime.support_status_projection AS projection
           ON projection.source_ticket_id = submissions.source_ticket_id
        WHERE submissions.account_key = $1
          AND submissions.product_key = $2
          AND submissions.actor_user_key = $3
          AND submissions.idempotency_key = $4
        LIMIT 1`,
      [
        input.config.accountKey,
        input.config.productKey,
        input.session.user.user_key,
        parsed.data.idempotency_key,
      ],
    );
    const existing = duplicate.rows[0];
    if (existing) {
      if (String(existing.request_hash) !== requestHash) {
        throw new SupportSubmissionError(
          'IDEMPOTENCY_CONFLICT',
          409,
          'This support idempotency key was already used.',
        );
      }
      return supportReceiptResponseSchema.parse({
        success: true,
        receipt_id: String(existing.receipt_id),
        source_ticket_id: String(existing.source_ticket_id),
        status_path: `/app/support/receipts/${String(existing.receipt_id)}`,
        delivery_state: String(existing.delivery_state),
        duplicate_submission: true,
      });
    }

    const entitlement = await resolveActiveSupportEntitlement({
      target: client,
      config: input.config,
      userKey: input.session.user.user_key,
      now,
    });
    if (!entitlement) {
      throw new SupportSubmissionError(
        'SUBSCRIBER_REQUIRED',
        403,
        'Subscriber support requires an active One Time entitlement.',
      );
    }

    const sourceTicketId = createSupportId('ots');
    const receiptId = createSupportId('otr');
    const outboxId = createSupportId('otx');
    const eventId = createSupportId('evt');
    const occurredAt = now.toISOString();
    const event = buildSupportEvent({
      config: input.config,
      payload: sanitized.payload,
      attachments,
      entitlement,
      session: input.session,
      sourceTicketId,
      receiptId,
      outboxId,
      eventId,
      occurredAt,
      requestId: safeTraceId(input.requestId, 'req'),
      correlationId: safeTraceId(input.correlationId ?? createSupportId('corr'), 'corr'),
      privacy: sanitized.privacy,
    });
    const rawBody = JSON.stringify(event);
    const bodyFingerprint = sha256Hex(rawBody);

    await client.query(
      `INSERT INTO onetime.support_submissions
       (source_ticket_id, receipt_id, event_id, outbox_id, account_key, product_key,
        actor_user_key, actor_role, entitlement_id, entitlement_checked_at, entitlement_valid_until,
        category, title, message, issue_details, client_context, reply_preference, idempotency_key,
        request_hash, body_fingerprint, privacy, delivery_state)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10::timestamptz,$11::timestamptz,
        $12,$13,$14,$15::jsonb,$16::jsonb,$17,$18,$19,$20,$21::jsonb,'QUEUED')`,
      [
        sourceTicketId,
        receiptId,
        eventId,
        outboxId,
        input.config.accountKey,
        input.config.productKey,
        input.session.user.user_key,
        input.session.user.role,
        entitlement.entitlementId,
        entitlement.checkedAt,
        entitlement.validUntil,
        sanitized.payload.category,
        sanitized.payload.title,
        sanitized.payload.message,
        JSON.stringify(sanitized.payload.issue_details),
        JSON.stringify(sanitized.payload.client_context),
        sanitized.payload.reply_preference,
        parsed.data.idempotency_key,
        requestHash,
        bodyFingerprint,
        JSON.stringify(sanitized.privacy),
      ],
    );

    for (const attachment of attachments) {
      await client.query(
        `INSERT INTO onetime.support_attachments
         (attachment_id, source_ticket_id, normalized_filename, media_type, size_bytes, sha256,
          transfer_locator, normalization, storage_class, content_disposition, pixel_width,
          pixel_height, blob_bytes)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'private','attachment',$9,$10,$11)`,
        [
          attachment.attachment_id,
          sourceTicketId,
          attachment.normalized_filename,
          attachment.media_type,
          attachment.size_bytes,
          attachment.sha256,
          attachment.transfer_locator,
          attachment.normalization,
          attachment.pixel_width,
          attachment.pixel_height,
          attachment.blob_bytes,
        ],
      );
    }

    await client.query(
      `INSERT INTO onetime.support_outbox
       (outbox_id, event_id, source_ticket_id, account_key, product_key, raw_body,
        body_fingerprint, event_json)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8::jsonb)`,
      [
        outboxId,
        eventId,
        sourceTicketId,
        input.config.accountKey,
        input.config.productKey,
        rawBody,
        bodyFingerprint,
        rawBody,
      ],
    );

    await client.query(
      `INSERT INTO onetime.support_status_projection
       (source_ticket_id, receipt_id, account_key, product_key, actor_user_key,
        status, public_summary, delivery_state)
       VALUES ($1,$2,$3,$4,$5,'new',$6,'queued')`,
      [
        sourceTicketId,
        receiptId,
        input.config.accountKey,
        input.config.productKey,
        input.session.user.user_key,
        'Support request received. Delivery to the support desk is queued.',
      ],
    );

    await insertSupportAudit(client, input.config, {
      sourceTicketId,
      actorUserKey: input.session.user.user_key,
      eventType: 'support_submission_accepted',
      metadata: {
        receipt_id: receiptId,
        event_id: eventId,
        outbox_id: outboxId,
        attachment_count: attachments.length,
        redaction_count: sanitized.privacy.redaction_count,
      },
    });

    return supportReceiptResponseSchema.parse({
      success: true,
      receipt_id: receiptId,
      source_ticket_id: sourceTicketId,
      status_path: `/app/support/receipts/${receiptId}`,
      delivery_state: 'queued',
      duplicate_submission: false,
    });
  });
}

export async function readSupportReceipt(input: {
  pool: DbPool;
  config: AppConfig;
  session: SessionLike;
  receiptId: string;
}): Promise<SupportReceiptProjection | null> {
  if (!isOt89Id(input.receiptId, 'otr')) return null;
  const result = await input.pool.query(
    `SELECT receipt_id, source_ticket_id, status, public_summary, status_version,
            delivery_state, bna_ticket_ref, updated_at
       FROM onetime.support_status_projection
      WHERE account_key = $1
        AND product_key = $2
        AND actor_user_key = $3
        AND receipt_id = $4`,
    [
      input.config.accountKey,
      input.config.productKey,
      input.session.user.user_key,
      input.receiptId,
    ],
  );
  const row = result.rows[0];
  if (!row) return null;
  return {
    receipt_id: String(row.receipt_id),
    source_ticket_id: String(row.source_ticket_id),
    status: String(row.status),
    public_summary: String(row.public_summary),
    status_version: Number(row.status_version),
    delivery_state: row.delivery_state as SupportReceiptProjection['delivery_state'],
    bna_ticket_ref: row.bna_ticket_ref ? String(row.bna_ticket_ref) : null,
    updated_at: toIso(row.updated_at),
  };
}

export async function getAuthorizedSupportAttachment(input: {
  pool: DbPool;
  config: AppConfig;
  attachmentId: string;
  requestTarget: string;
  headers: Ot89Headers;
  now?: Date | undefined;
}): Promise<null | {
  mediaType: string;
  filename: string;
  sha256: string;
  bytes: Buffer;
}> {
  if (!isOt89Id(input.attachmentId, 'ota')) return null;
  const verified = verifyOt89Signature({
    expectedKeyId: input.config.ot89BnaToOnetimeHmacKeyId,
    secret: input.config.ot89BnaToOnetimeHmacSecret,
    method: 'GET',
    requestTarget: input.requestTarget,
    rawBody: Buffer.alloc(0),
    headers: input.headers,
    now: input.now,
  });
  if (!verified.ok) return null;
  const reserved = await reserveNonce({
    target: input.pool,
    keyId: input.config.ot89BnaToOnetimeHmacKeyId,
    nonce: input.headers.nonce ?? '',
    now: input.now ?? new Date(),
  });
  if (!reserved) return null;
  const result = await input.pool.query(
    `SELECT attachments.media_type, attachments.normalized_filename, attachments.sha256,
            attachments.blob_bytes
       FROM onetime.support_attachments AS attachments
       JOIN onetime.support_outbox AS outbox
         ON outbox.source_ticket_id = attachments.source_ticket_id
      WHERE attachments.attachment_id = $1
        AND outbox.status = 'DELIVERED'
      LIMIT 1`,
    [input.attachmentId],
  );
  const row = result.rows[0];
  if (!row) return null;
  return {
    mediaType: String(row.media_type),
    filename: String(row.normalized_filename),
    sha256: String(row.sha256),
    bytes: Buffer.isBuffer(row.blob_bytes)
      ? row.blob_bytes
      : Buffer.from(row.blob_bytes as Uint8Array),
  };
}

export async function ingestMockBnaSupportEvent(input: {
  pool: DbPool;
  config: AppConfig;
  headers: Ot89Headers;
  rawBody: Buffer;
  requestTarget?: string | undefined;
  now?: Date | undefined;
}): Promise<{ status: number; body: Record<string, unknown> }> {
  if (!input.config.ot89MockBnaEnabled) {
    return { status: 404, body: { accepted: false, code: 'MOCK_BNA_DISABLED' } };
  }
  if (input.config.ot89MockBnaOutage) {
    return { status: 503, body: { accepted: false, code: 'MOCK_BNA_OUTAGE' } };
  }
  if (input.rawBody.length > 131_072) {
    return { status: 413, body: { accepted: false, code: 'BODY_TOO_LARGE' } };
  }
  const now = input.now ?? new Date();
  const verified = verifyOt89Signature({
    expectedKeyId: input.config.ot89SupportHmacKeyId,
    secret: input.config.ot89SupportHmacSecret,
    method: 'POST',
    requestTarget: input.requestTarget ?? OT89_EVENT_TARGET,
    rawBody: input.rawBody,
    headers: input.headers,
    now,
  });
  if (!verified.ok) {
    return { status: verified.status, body: { accepted: false, code: verified.code } };
  }
  let parsedJson: unknown;
  try {
    parsedJson = JSON.parse(input.rawBody.toString('utf8'));
  } catch {
    return { status: 400, body: { accepted: false, code: 'JSON_INVALID' } };
  }
  const parsed = supportEventV1Schema.safeParse(parsedJson);
  if (!parsed.success) {
    return { status: 422, body: { accepted: false, code: 'CONTRACT_INVALID' } };
  }
  const event = parsed.data;
  if (input.headers.eventId !== event.event_id) {
    return { status: 409, body: { accepted: false, code: 'EVENT_HEADER_MISMATCH' } };
  }
  const semanticError = supportEventSemanticError(event);
  if (semanticError) {
    return { status: 422, body: { accepted: false, code: semanticError } };
  }

  return inTransaction(input.pool, async (client) => {
    const nonceReserved = await reserveNonce({
      target: client,
      keyId: input.config.ot89SupportHmacKeyId,
      nonce: input.headers.nonce ?? '',
      now,
    });
    if (!nonceReserved) {
      return { status: 409, body: { accepted: false, code: 'NONCE_REPLAYED' } };
    }

    const bodyFingerprint = verified.bodyFingerprint;
    const immutableFingerprint = immutableEventFingerprint(event);
    const byEvent = await client.query(
      `SELECT bna_ticket_ref, source_ticket_id, body_fingerprint, status, status_version, received_at
         FROM onetime.support_mock_bna_events
        WHERE event_id = $1
        LIMIT 1`,
      [event.event_id],
    );
    const existingEvent = byEvent.rows[0];
    if (existingEvent) {
      if (String(existingEvent.body_fingerprint) !== bodyFingerprint) {
        await insertSupportAudit(client, input.config, {
          sourceTicketId: event.submission.source_ticket_id,
          actorUserKey: null,
          eventType: 'mock_bna_event_collision',
          metadata: { event_id: event.event_id },
        });
        return { status: 409, body: { accepted: false, code: 'EVENT_COLLISION' } };
      }
      return acceptedMockBody({
        duplicate: true,
        event,
        bnaTicketRef: String(existingEvent.bna_ticket_ref),
        status: String(existingEvent.status),
        statusVersion: Number(existingEvent.status_version),
        receivedAt: toIso(existingEvent.received_at),
      });
    }

    const bySource = await client.query(
      `SELECT bna_ticket_ref, immutable_payload_fingerprint, status, status_version, received_at
         FROM onetime.support_mock_bna_events
        WHERE source_ticket_id = $1
        LIMIT 1`,
      [event.submission.source_ticket_id],
    );
    const existingSource = bySource.rows[0];
    if (existingSource) {
      if (String(existingSource.immutable_payload_fingerprint) !== immutableFingerprint) {
        return { status: 409, body: { accepted: false, code: 'SOURCE_COLLISION' } };
      }
      return acceptedMockBody({
        duplicate: true,
        event,
        bnaTicketRef: String(existingSource.bna_ticket_ref),
        status: String(existingSource.status),
        statusVersion: Number(existingSource.status_version),
        receivedAt: toIso(existingSource.received_at),
      });
    }

    const bnaTicketRef = createSupportId('bna');
    await client.query(
      `INSERT INTO onetime.support_mock_bna_events
       (event_id, source_ticket_id, body_fingerprint, immutable_payload_fingerprint,
        bna_ticket_ref, status, public_summary, status_version, received_at)
       VALUES ($1,$2,$3,$4,$5,'new',$6,1,$7::timestamptz)`,
      [
        event.event_id,
        event.submission.source_ticket_id,
        bodyFingerprint,
        immutableFingerprint,
        bnaTicketRef,
        'Support ticket accepted by the mock BNA support desk.',
        now.toISOString(),
      ],
    );
    await insertSupportAudit(client, input.config, {
      sourceTicketId: event.submission.source_ticket_id,
      actorUserKey: null,
      eventType: 'mock_bna_event_accepted',
      metadata: { event_id: event.event_id, bna_ticket_ref: bnaTicketRef },
    });
    return acceptedMockBody({
      duplicate: false,
      event,
      bnaTicketRef,
      status: 'new',
      statusVersion: 1,
      receivedAt: now.toISOString(),
    });
  });
}

export async function readMockBnaStatus(input: {
  pool: DbPool;
  config: AppConfig;
  headers: Ot89Headers;
  rawBody: Buffer;
  requestTarget?: string | undefined;
  now?: Date | undefined;
}): Promise<{ status: number; body: Record<string, unknown> }> {
  if (!input.config.ot89MockBnaEnabled) {
    return { status: 404, body: { code: 'MOCK_BNA_DISABLED' } };
  }
  const verified = verifyOt89Signature({
    expectedKeyId: input.config.ot89SupportHmacKeyId,
    secret: input.config.ot89SupportHmacSecret,
    method: 'POST',
    requestTarget: input.requestTarget ?? OT89_STATUS_TARGET,
    rawBody: input.rawBody,
    headers: input.headers,
    now: input.now,
  });
  if (!verified.ok) return { status: verified.status, body: { code: verified.code } };
  const reserved = await reserveNonce({
    target: input.pool,
    keyId: input.config.ot89SupportHmacKeyId,
    nonce: input.headers.nonce ?? '',
    now: input.now ?? new Date(),
  });
  if (!reserved) return { status: 409, body: { code: 'NONCE_REPLAYED' } };
  const parsed = supportStatusRequestSchema.safeParse(JSON.parse(input.rawBody.toString('utf8')));
  if (!parsed.success) return { status: 422, body: { code: 'STATUS_REQUEST_INVALID' } };
  const result = await input.pool.query(
    `SELECT source_ticket_id, bna_ticket_ref, status, public_summary, status_version, received_at
       FROM onetime.support_mock_bna_events
      WHERE source_ticket_id = $1
      LIMIT 1`,
    [parsed.data.source_ticket_id],
  );
  const row = result.rows[0];
  if (!row) return { status: 404, body: { code: 'STATUS_NOT_FOUND' } };
  return {
    status: 200,
    body: supportStatusResponseSchema.parse({
      source_ticket_id: String(row.source_ticket_id),
      bna_ticket_ref: String(row.bna_ticket_ref),
      status: row.status,
      public_summary: String(row.public_summary),
      status_version: Number(row.status_version),
      updated_at: toIso(row.received_at),
    }),
  };
}

export async function updateLocalSupportStatus(input: {
  target: DbPool | Queryable;
  config: AppConfig;
  status: SupportStatusResponse;
}) {
  await input.target.query(
    `UPDATE onetime.support_status_projection
        SET bna_ticket_ref = $2,
            status = $3,
            public_summary = $4,
            status_version = $5,
            delivery_state = 'delivered',
            updated_at = $6::timestamptz
      WHERE account_key = $7
        AND product_key = $8
        AND source_ticket_id = $1`,
    [
      input.status.source_ticket_id,
      input.status.bna_ticket_ref,
      input.status.status,
      input.status.public_summary,
      input.status.status_version,
      input.status.updated_at,
      input.config.accountKey,
      input.config.productKey,
    ],
  );
}

async function resolveActiveSupportEntitlement(input: {
  target: DbPool | Queryable;
  config: AppConfig;
  userKey: string;
  now?: Date | undefined;
}): Promise<EntitlementProof | null> {
  const now = input.now ?? new Date();
  const entitlements = await input.target.query(
    `SELECT entitlement_key, evaluated_at
       FROM onetime.billing_entitlement_projections
      WHERE account_key = $1
        AND product_key = $2
        AND principal_key = $3
        AND principal_type = 'account_user'
        AND status = 'active'
      ORDER BY evaluated_at DESC, updated_at DESC
      LIMIT 1`,
    [input.config.accountKey, input.config.productKey, input.userKey],
  );
  const entitlement = entitlements.rows[0];
  if (!entitlement) return null;
  const subscription = await input.target.query(
    `SELECT current_period_end
       FROM onetime.billing_subscription_projections
      WHERE account_key = $1
        AND product_key = $2
        AND principal_key = $3
        AND principal_type = 'account_user'
      ORDER BY provider_updated_at DESC, updated_at DESC
      LIMIT 1`,
    [input.config.accountKey, input.config.productKey, input.userKey],
  );
  const periodEnd = subscription.rows[0]?.current_period_end;
  const validUntil = periodEnd ? toIso(periodEnd) : null;
  if (validUntil && new Date(validUntil).getTime() <= now.getTime()) return null;
  return {
    entitlementId: String(entitlement.entitlement_key),
    checkedAt: now.toISOString(),
    validUntil,
  };
}

function sanitizePayload(
  payload: SupportSubmissionPayload,
  attachments: NormalizedSupportAttachment[],
) {
  const redactedFields: string[] = [];
  let redactionCount = 0;
  const title = redactField('ticket.title', payload.title);
  const message = redactField('ticket.message', payload.message);
  const steps = payload.issue_details.steps_to_reproduce.map((step) =>
    redactField('ticket.issue_details.steps_to_reproduce', step),
  );
  const expected =
    payload.issue_details.expected_behavior === null
      ? null
      : redactField(
          'ticket.issue_details.expected_behavior',
          payload.issue_details.expected_behavior,
        );
  const actual =
    payload.issue_details.actual_behavior === null
      ? null
      : redactField('ticket.issue_details.actual_behavior', payload.issue_details.actual_behavior);
  for (const attachment of attachments) {
    if (attachment.redacted_filename) redactedFields.push('attachments.normalized_filename');
  }
  const sanitizedPayload = {
    ...payload,
    title,
    message,
    issue_details: {
      ...payload.issue_details,
      steps_to_reproduce: steps,
      expected_behavior: expected,
      actual_behavior: actual,
    },
  };
  return {
    payload: sanitizedPayload,
    privacy: supportPrivacy(redactedFields, redactionCount),
    requestFingerprintSource: {
      category: sanitizedPayload.category,
      title: sanitizedPayload.title,
      message: sanitizedPayload.message,
      issue_details: sanitizedPayload.issue_details,
      client_context: sanitizedPayload.client_context,
      reply_preference: sanitizedPayload.reply_preference,
      attachments: attachments.map((attachment) => ({
        filename: attachment.normalized_filename,
        media_type: attachment.media_type,
        sha256: attachment.sha256,
        size_bytes: attachment.size_bytes,
      })),
    },
  };

  function redactField(field: string, value: string) {
    const redacted = redactSupportText(value);
    if (redacted.changed) redactedFields.push(field);
    redactionCount += redacted.count;
    return redacted.text;
  }
}

function buildSupportEvent(input: {
  config: AppConfig;
  payload: SupportSubmissionPayload;
  attachments: NormalizedSupportAttachment[];
  entitlement: EntitlementProof;
  session: SessionLike;
  sourceTicketId: string;
  receiptId: string;
  outboxId: string;
  eventId: string;
  occurredAt: string;
  requestId: string;
  correlationId: string;
  privacy: ReturnType<typeof supportPrivacy>;
}): SupportEventV1 {
  const event = {
    contract_version: '1.0.0',
    event_type: 'onetime.support.ticket.submitted.v1',
    event_id: input.eventId,
    occurred_at: input.occurredAt,
    producer: {
      service: 'onetime',
      environment: producerEnvironment(input.config),
      deployment_id: input.config.ot89SupportDeploymentId,
      source_commit: sourceCommit(input.config.commitSha),
    },
    submission: {
      source_ticket_id: input.sourceTicketId,
      receipt_id: input.receiptId,
      outbox_id: input.outboxId,
    },
    actor: {
      onetime_user_id: safeActorId(input.session.user.user_key, 'user'),
      onetime_account_id: safeActorId(input.config.accountKey, 'acct'),
    },
    authorization: {
      policy_version: 'ot89-subscriber-support-v1',
      authenticated: true,
      account_id: safeActorId(input.config.accountKey, 'acct'),
      entitlement_product: 'one_time',
      entitlement_id: safeActorId(input.entitlement.entitlementId, 'ent'),
      entitlement_status: 'active',
      checked_at: input.entitlement.checkedAt,
      valid_until: input.entitlement.validUntil,
    },
    ticket: {
      category: input.payload.category,
      title: input.payload.title,
      message: input.payload.message,
      issue_details: input.payload.issue_details,
      client_context: input.payload.client_context,
      reply_preference: input.payload.reply_preference,
    },
    attachments: input.attachments.map((attachment) => ({
      attachment_id: attachment.attachment_id,
      normalized_filename: attachment.normalized_filename,
      media_type: attachment.media_type,
      size_bytes: attachment.size_bytes,
      sha256: attachment.sha256,
      transfer_locator: attachment.transfer_locator,
      normalization: attachment.normalization,
      storage_class: attachment.storage_class,
      content_disposition: attachment.content_disposition,
      pixel_width: attachment.pixel_width,
      pixel_height: attachment.pixel_height,
    })),
    privacy: input.privacy,
    trace: {
      correlation_id: input.correlationId,
      request_id: input.requestId,
    },
  } satisfies SupportEventV1;
  return supportEventV1Schema.parse(event);
}

export async function insertSupportAudit(
  target: DbPool | Queryable,
  config: AppConfig,
  event: {
    sourceTicketId: string | null;
    actorUserKey: string | null;
    eventType: string;
    metadata?: Record<string, unknown> | undefined;
  },
) {
  await target.query(
    `INSERT INTO onetime.support_audit_events
     (audit_key, account_key, product_key, source_ticket_id, actor_user_key, event_type, metadata)
     VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb)
     ON CONFLICT (audit_key) DO NOTHING`,
    [
      `support_audit_${sha256Hex(
        `${event.eventType}\0${event.sourceTicketId ?? ''}\0${Date.now()}\0${Math.random()}`,
      ).slice(0, 24)}`,
      config.accountKey,
      config.productKey,
      event.sourceTicketId,
      event.actorUserKey,
      event.eventType,
      JSON.stringify(event.metadata ?? {}),
    ],
  );
}

async function reserveNonce(input: {
  target: DbPool | Queryable;
  keyId: string;
  nonce: string;
  now: Date;
}): Promise<boolean> {
  await input.target.query('DELETE FROM onetime.support_mock_bna_nonces WHERE expires_at < $1', [
    input.now,
  ]);
  try {
    await input.target.query(
      `INSERT INTO onetime.support_mock_bna_nonces (key_id, nonce, seen_at, expires_at)
       VALUES ($1,$2,$3::timestamptz,$4::timestamptz)`,
      [
        input.keyId,
        input.nonce,
        input.now.toISOString(),
        new Date(input.now.getTime() + 86_400_000).toISOString(),
      ],
    );
    return true;
  } catch {
    return false;
  }
}

function supportEventSemanticError(event: SupportEventV1): string | null {
  if (event.actor.onetime_account_id !== event.authorization.account_id) return 'ACCOUNT_MISMATCH';
  const occurredAt = new Date(event.occurred_at).getTime();
  const checkedAt = new Date(event.authorization.checked_at).getTime();
  if (checkedAt < occurredAt - 300_000 || checkedAt > occurredAt + 60_000) {
    return 'AUTHORIZATION_CHECK_STALE';
  }
  if (event.authorization.valid_until) {
    const validUntil = new Date(event.authorization.valid_until).getTime();
    if (validUntil <= checkedAt || validUntil < occurredAt) return 'AUTHORIZATION_EXPIRED';
  }
  return null;
}

function acceptedMockBody(input: {
  duplicate: boolean;
  event: SupportEventV1;
  bnaTicketRef: string;
  status: string;
  statusVersion: number;
  receivedAt: string;
}) {
  return {
    status: input.duplicate ? 200 : 202,
    body: {
      accepted: true,
      duplicate: input.duplicate,
      event_id: input.event.event_id,
      source_ticket_id: input.event.submission.source_ticket_id,
      bna_ticket_ref: input.bnaTicketRef,
      ingestion_status: 'accepted',
      status_version: input.statusVersion,
      received_at: input.receivedAt,
    },
  };
}

function immutableEventFingerprint(event: SupportEventV1) {
  return sha256Hex(
    stableJson({
      source_ticket_id: event.submission.source_ticket_id,
      actor: event.actor,
      authorization: event.authorization,
      ticket: event.ticket,
      attachments: event.attachments,
      privacy: event.privacy,
    }),
  );
}

function stableJson(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map((item) => stableJson(item)).join(',')}]`;
  const object = value as Record<string, unknown>;
  return `{${Object.keys(object)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${stableJson(object[key])}`)
    .join(',')}}`;
}

function safeActorId(value: string, fallbackPrefix: string) {
  if (/^[A-Za-z0-9][A-Za-z0-9._:-]{5,127}$/.test(value)) return value;
  return `${fallbackPrefix}_${sha256Hex(value).slice(0, 24)}`;
}

function safeTraceId(value: string, prefix: 'corr' | 'req') {
  if (/^[A-Za-z0-9][A-Za-z0-9._:-]{5,127}$/.test(value)) return value;
  return createSupportId(prefix);
}

function producerEnvironment(config: AppConfig): 'development' | 'staging' | 'production' {
  if (config.nodeEnv === 'production') return 'production';
  if (config.nodeEnv === 'development') return 'development';
  return 'staging';
}

function sourceCommit(value: string) {
  return /^[a-f0-9]{40}$/.test(value) ? value : '0000000000000000000000000000000000000000';
}

function toIso(value: unknown) {
  if (value instanceof Date) return value.toISOString();
  return new Date(String(value)).toISOString();
}

export function attachmentRequestTarget(attachmentId: string) {
  return `${OT89_ATTACHMENT_TARGET_PREFIX}${encodeURIComponent(attachmentId)}`;
}
