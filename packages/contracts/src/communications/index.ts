import { z } from 'zod';

export const communicationsChannels = ['email', 'whatsapp', 'internal_email'] as const;
export const communicationsIntentTypes = [
  'family_signup_email_ack',
  'family_signup_whatsapp_confirmation',
  'internal_lead_alert',
  'single_recipient_reply',
] as const;
export const communicationsLocalStates = [
  'queued',
  'provider_accepted',
  'delivered',
  'failed',
  'bounced',
  'complained',
  'suppressed',
  'draft_saved',
  'unknown',
] as const;

export const communicationsAvailabilitySchema = z.enum(['available', 'unavailable']);
export const communicationsChannelSchema = z.enum(communicationsChannels);
export const communicationsIntentTypeSchema = z.enum(communicationsIntentTypes);
export const communicationsLocalStateSchema = z.enum(communicationsLocalStates);

export type CommunicationsAvailability = z.infer<typeof communicationsAvailabilitySchema>;
export type CommunicationsChannel = z.infer<typeof communicationsChannelSchema>;
export type CommunicationsIntentType = z.infer<typeof communicationsIntentTypeSchema>;
export type CommunicationsLocalState = z.infer<typeof communicationsLocalStateSchema>;

export const communicationsCapabilitiesSchema = z.object({
  read: z.literal(true),
  provider_acceptance: z.literal(false),
  provider_delivery: z.literal(false),
  inbound_import: z.literal(false),
  replies: z.literal(true),
  threads: z.literal(false),
  subject_body_access: z.literal(false),
  attachments: z.literal(false),
  reminder_execution: z.literal(false),
  compose: z.literal(true),
  resend: z.literal(false),
  campaigns: z.literal(false),
  templates: z.literal(false),
  integration_settings: z.literal(false),
  channels: z.array(communicationsChannelSchema),
  intent_types: z.array(communicationsIntentTypeSchema),
  local_states: z.array(communicationsLocalStateSchema),
});

export const communicationsFiltersSchema = z.object({
  from: z.string().datetime(),
  to: z.string().datetime(),
  channel: communicationsChannelSchema.optional(),
  intent_type: communicationsIntentTypeSchema.optional(),
  status: communicationsLocalStateSchema.optional(),
  limit: z.number().int().min(1).max(25),
});

export const communicationsItemSchema = z.object({
  channel: communicationsChannelSchema,
  intent_type: communicationsIntentTypeSchema,
  event_label: z.string(),
  local_state: communicationsLocalStateSchema,
  state_label: z.string(),
  recipient_masked: z.string(),
  queued_at: z.string().datetime(),
  state_at: z.string().datetime().nullable(),
  contact_path: z.string().nullable(),
});

export const communicationsListResponseSchema = z.object({
  success: z.literal(true),
  availability: communicationsAvailabilitySchema,
  source_scope: z.literal('local_communication_intents_only'),
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
  threads: false,
  subject_body_access: false,
  attachments: false,
  reminder_execution: false,
  compose: true,
  resend: false,
  campaigns: false,
  templates: false,
  integration_settings: false,
  channels: [...communicationsChannels],
  intent_types: [...communicationsIntentTypes],
  local_states: [...communicationsLocalStates],
};
