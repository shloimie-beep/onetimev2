import { z } from 'zod';

export const communicationsChannels = ['email', 'whatsapp', 'internal_email'] as const;
export const communicationsDirections = ['inbound', 'outbound', 'internal'] as const;
export const communicationsIntentTypes = [
  'family_signup_email_ack',
  'family_signup_whatsapp_confirmation',
  'internal_lead_alert',
  'single_recipient_reply',
  'whatsapp_inbound_message',
  'whatsapp_provider_event',
  'historical_import_event',
  'history_unavailable',
] as const;
export const communicationsLocalStates = [
  'queued',
  'provider_accepted',
  'provider_sent',
  'delivered',
  'read',
  'received',
  'processed',
  'failed',
  'bounced',
  'complained',
  'suppressed',
  'draft_saved',
  'duplicate',
  'unknown',
  'history_unavailable',
] as const;
export const communicationsSources = [
  'canonical_history_event',
  'local_outbox_intent',
  'crm_reply_draft',
  'stored_whatsapp_webhook',
  'stored_provider_delivery_event',
  'historical_import',
  'provider_history_unavailable',
] as const;
export const communicationsProvenance = [
  'local_database',
  'stored_webhook',
  'stored_provider_event',
  'redacted_export',
  'capability_limitation',
] as const;

export const communicationsAvailabilitySchema = z.enum(['available', 'unavailable']);
export const communicationsChannelSchema = z.enum(communicationsChannels);
export const communicationsDirectionSchema = z.enum(communicationsDirections);
export const communicationsIntentTypeSchema = z.enum(communicationsIntentTypes);
export const communicationsLocalStateSchema = z.enum(communicationsLocalStates);
export const communicationsSourceSchema = z.enum(communicationsSources);
export const communicationsProvenanceSchema = z.enum(communicationsProvenance);

export type CommunicationsAvailability = z.infer<typeof communicationsAvailabilitySchema>;
export type CommunicationsChannel = z.infer<typeof communicationsChannelSchema>;
export type CommunicationsDirection = z.infer<typeof communicationsDirectionSchema>;
export type CommunicationsIntentType = z.infer<typeof communicationsIntentTypeSchema>;
export type CommunicationsLocalState = z.infer<typeof communicationsLocalStateSchema>;
export type CommunicationsSource = z.infer<typeof communicationsSourceSchema>;
export type CommunicationsProvenance = z.infer<typeof communicationsProvenanceSchema>;

export const communicationsCapabilitiesSchema = z.object({
  read: z.literal(true),
  provider_acceptance: z.boolean(),
  provider_delivery: z.boolean(),
  inbound_import: z.boolean(),
  replies: z.literal(true),
  threads: z.literal(true),
  subject_body_access: z.literal(false),
  attachments: z.literal(false),
  reminder_execution: z.literal(false),
  compose: z.literal(true),
  draft_only_replies: z.literal(true),
  transport_send: z.literal(false),
  resend: z.literal(false),
  campaigns: z.literal(false),
  templates: z.literal(false),
  integration_settings: z.literal(false),
  historical_backfill_dry_run: z.literal(true),
  provider_history_complete: z.literal(false),
  stored_webhooks: z.boolean(),
  channels: z.array(communicationsChannelSchema),
  directions: z.array(communicationsDirectionSchema),
  intent_types: z.array(communicationsIntentTypeSchema),
  local_states: z.array(communicationsLocalStateSchema),
  sources: z.array(communicationsSourceSchema),
});

export const communicationsFiltersSchema = z.object({
  from: z.string().datetime(),
  to: z.string().datetime(),
  channel: communicationsChannelSchema.optional(),
  direction: communicationsDirectionSchema.optional(),
  intent_type: communicationsIntentTypeSchema.optional(),
  status: communicationsLocalStateSchema.optional(),
  source: communicationsSourceSchema.optional(),
  limit: z.number().int().min(1).max(25),
});

export const communicationsItemSchema = z.object({
  event_id: z.string(),
  thread_id: z.string(),
  thread_label: z.string(),
  channel: communicationsChannelSchema,
  direction: communicationsDirectionSchema,
  intent_type: communicationsIntentTypeSchema,
  event_label: z.string(),
  local_state: communicationsLocalStateSchema,
  state_label: z.string(),
  source: communicationsSourceSchema,
  source_label: z.string(),
  provenance: communicationsProvenanceSchema,
  participant_kind: z.enum(['contact', 'household', 'unknown']),
  participant_label: z.string(),
  recipient_masked: z.string(),
  queued_at: z.string().datetime(),
  occurred_at: z.string().datetime(),
  state_at: z.string().datetime().nullable(),
  contact_path: z.string().nullable(),
  household_path: z.string().nullable(),
  preview_redacted: z.string(),
  provider_reference_digest: z.string().nullable(),
  import_batch_key: z.string().nullable(),
  idempotency_key: z.string().nullable(),
  draft_only: z.boolean(),
  transport_available: z.literal(false),
});

export const communicationsListResponseSchema = z.object({
  success: z.literal(true),
  availability: communicationsAvailabilitySchema,
  source_scope: z.enum(['local_communication_intents_only', 'canonical_communication_history']),
  mailbox_complete: z.literal(false),
  capabilities: communicationsCapabilitiesSchema,
  applied_filters: communicationsFiltersSchema,
  items: z.array(communicationsItemSchema),
  next_cursor: z.string().nullable(),
});

export const communicationsErrorResponseSchema = z.object({
  success: z.literal(false),
  code: z.string(),
  message: z.string(),
  request_id: z.string().optional(),
});

export type CommunicationsCapabilities = z.infer<typeof communicationsCapabilitiesSchema>;
export type CommunicationsFilters = z.infer<typeof communicationsFiltersSchema>;
export type CommunicationsItem = z.infer<typeof communicationsItemSchema>;
export type CommunicationsListResponse = z.infer<typeof communicationsListResponseSchema>;
export type CommunicationsErrorResponse = z.infer<typeof communicationsErrorResponseSchema>;

export const communicationsCapabilities: CommunicationsCapabilities = {
  read: true,
  provider_acceptance: false,
  provider_delivery: false,
  inbound_import: false,
  replies: true,
  threads: true,
  subject_body_access: false,
  attachments: false,
  reminder_execution: false,
  compose: true,
  draft_only_replies: true,
  transport_send: false,
  resend: false,
  campaigns: false,
  templates: false,
  integration_settings: false,
  historical_backfill_dry_run: true,
  provider_history_complete: false,
  stored_webhooks: true,
  channels: [...communicationsChannels],
  directions: [...communicationsDirections],
  intent_types: [...communicationsIntentTypes],
  local_states: [...communicationsLocalStates],
  sources: [...communicationsSources],
};
