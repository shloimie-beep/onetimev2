import { createHmac } from 'node:crypto';
import {
  highLevelSupportEventSchema,
  type HighLevelEntitlementStatus,
  type HighLevelSupportEvent,
} from '../../../contracts/src/highlevel/index.ts';
import { redactSupportText } from '../support/redaction.ts';
import { stableDigest } from './normalization.ts';

export function buildHighLevelSupportProducerEvent(input: {
  ticketId: string;
  accountKey: string;
  productKey: string;
  parentRef: string | null;
  householdRef: string | null;
  category: HighLevelSupportEvent['category'];
  rawSummary: string;
  route: string | null;
  steps: readonly string[];
  expected: string | null;
  actual: string | null;
  attachments: Array<{
    attachmentId: string;
    mediaType: string;
    sizeBytes: number;
    sha256: string;
  }>;
  entitlementStatus: HighLevelEntitlementStatus;
  occurredAt: Date;
  idempotencyKey: string;
  signingKeyId: string;
}) {
  const summary = redactSupportText(input.rawSummary).text;
  const event = {
    contract_version: 'onetime.highlevel.support-producer.v1',
    ticket_id: input.ticketId,
    account_key: input.accountKey,
    product_key: input.productKey,
    parent_ref: input.parentRef,
    household_ref: input.householdRef,
    category: input.category,
    redacted_summary: summary,
    structured_reproduction: {
      route: input.route,
      steps: input.steps.map((step) => redactSupportText(step).text),
      expected: input.expected ? redactSupportText(input.expected).text : null,
      actual: input.actual ? redactSupportText(input.actual).text : null,
    },
    safe_attachment_metadata: input.attachments.map((attachment) => ({
      attachment_id: attachment.attachmentId,
      media_type: attachment.mediaType,
      size_bytes: attachment.sizeBytes,
      sha256: attachment.sha256,
    })),
    entitlement: {
      status: input.entitlementStatus,
      checked_at: input.occurredAt.toISOString(),
    },
    occurred_at: input.occurredAt.toISOString(),
    idempotency_key: input.idempotencyKey,
    signing: {
      algorithm: 'hmac-sha256',
      key_id: input.signingKeyId,
      canonical_target: '/internal/bna/support/onetime/v1',
    },
    status_callback: {
      target: '/internal/highlevel/support/status/v1',
      event_types: ['accepted', 'triaged', 'resolved', 'rejected'],
    },
  } satisfies HighLevelSupportEvent;
  return highLevelSupportEventSchema.parse(event);
}

export function signHighLevelSupportEvent(input: { event: HighLevelSupportEvent; secret: string }) {
  const bodyDigest = stableDigest(input.event);
  return `v1=${createHmac('sha256', input.secret).update(bodyDigest).digest('hex')}`;
}
