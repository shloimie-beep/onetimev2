import { z } from 'zod';

const isoDateTime = z.string().datetime({ offset: true });
const sha256Hex = z.string().regex(/^[a-f0-9]{64}$/);

export const highLevelModeSchema = z.enum(['disabled', 'mock', 'provider']);
export type HighLevelMode = z.infer<typeof highLevelModeSchema>;

export const highLevelEntitlementStatusSchema = z.enum([
  'active',
  'grace',
  'complimentary',
  'inactive',
]);
export type HighLevelEntitlementStatus = z.infer<typeof highLevelEntitlementStatusSchema>;

export const highLevelBusinessEventTypeSchema = z.enum([
  'subscription.active',
  'payment.succeeded',
  'payment.failed',
  'payment.recovered',
  'subscription.canceled',
  'refund.full',
  'refund.partial',
  'chargeback',
]);
export type HighLevelBusinessEventType = z.infer<typeof highLevelBusinessEventTypeSchema>;

export const highLevelOutboxEventTypeSchema = z.enum([
  'lead.created',
  'portal.invited',
  'portal.activated',
  'payment.active',
  'payment.failed',
  'subscription.canceled',
  'class.reminder',
  'recording.available',
]);
export type HighLevelOutboxEventType = z.infer<typeof highLevelOutboxEventTypeSchema>;

export const highLevelWebhookPayloadSchema = z
  .object({
    provider_event_id: z.string().trim().min(6).max(180),
    event_type: highLevelBusinessEventTypeSchema,
    location_id: z.string().trim().min(4).max(120),
    contact_id: z.string().trim().min(4).max(120).nullable().default(null),
    subscription_id: z.string().trim().min(4).max(160).nullable().default(null),
    transaction_id: z.string().trim().min(4).max(160).nullable().default(null),
    opportunity_id: z.string().trim().min(4).max(160).nullable().default(null),
    occurred_at: isoDateTime,
    current_period_end: isoDateTime.nullable().default(null),
    amount_ref: z.string().trim().max(80).nullable().default(null),
    payload_digest: sha256Hex.optional(),
  })
  .strict();
export type HighLevelWebhookPayload = z.infer<typeof highLevelWebhookPayloadSchema>;

export const highLevelSupportEventSchema = z
  .object({
    contract_version: z.literal('onetime.highlevel.support-producer.v1'),
    ticket_id: z.string().trim().min(8).max(160),
    account_key: z.string().trim().min(1).max(128),
    product_key: z.string().trim().min(1).max(128),
    parent_ref: z.string().trim().min(6).max(160).nullable(),
    household_ref: z.string().trim().min(6).max(160).nullable(),
    category: z.enum(['access', 'billing', 'classroom', 'content', 'technical', 'other']),
    redacted_summary: z.string().trim().min(1).max(800),
    structured_reproduction: z
      .object({
        route: z.string().trim().max(240).nullable(),
        steps: z.array(z.string().trim().min(1).max(300)).max(10),
        expected: z.string().trim().max(500).nullable(),
        actual: z.string().trim().max(500).nullable(),
      })
      .strict(),
    safe_attachment_metadata: z
      .array(
        z
          .object({
            attachment_id: z.string().trim().min(6).max(160),
            media_type: z.string().trim().min(3).max(100),
            size_bytes: z.number().int().min(1).max(5_242_880),
            sha256: sha256Hex,
          })
          .strict(),
      )
      .max(5),
    entitlement: z
      .object({
        status: highLevelEntitlementStatusSchema,
        checked_at: isoDateTime,
      })
      .strict(),
    occurred_at: isoDateTime,
    idempotency_key: z.string().trim().min(8).max(160),
    signing: z
      .object({
        algorithm: z.literal('hmac-sha256'),
        key_id: z.string().trim().min(1).max(120),
        canonical_target: z.string().trim().min(1).max(240),
      })
      .strict(),
    status_callback: z
      .object({
        target: z.string().trim().min(1).max(240),
        event_types: z.array(z.enum(['accepted', 'triaged', 'resolved', 'rejected'])).min(1),
      })
      .strict(),
  })
  .strict();
export type HighLevelSupportEvent = z.infer<typeof highLevelSupportEventSchema>;

export type HighLevelContactIdentity = {
  email: string | null;
  phone: string | null;
  firstName?: string | undefined;
  lastName?: string | undefined;
};
