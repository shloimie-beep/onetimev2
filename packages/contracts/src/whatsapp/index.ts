import { z } from 'zod';

export const whatsappConversationStates = [
  'PUBLIC_IDLE',
  'QUALIFY_AUDIENCE',
  'CAPTURE_GUARDIAN_NAME',
  'CAPTURE_SCHOOL_CONTACT_NAME',
  'CAPTURE_CONTACT_PREFERENCE',
  'CAPTURE_FAMILY_REMINDER_PREFERENCE',
  'FAMILY_PERSIST_PENDING',
  'SCHOOL_PERSIST_PENDING',
  'HUMAN_HANDOFF_PENDING',
  'ACCOUNT_LINK_OFFERED',
  'ACCOUNT_LINK_PENDING',
  'ACCOUNT_LINKED',
  'SUPPRESSED',
  'CLOSED',
] as const;

export const whatsappConversationStateSchema = z.enum(whatsappConversationStates);
export type WhatsAppConversationState = z.infer<typeof whatsappConversationStateSchema>;

export const whatsappIntentTypes = [
  'conversation.greeting',
  'program.question',
  'lead.family_interest',
  'lead.school_interest',
  'lead.guardian_name',
  'lead.school_contact_name',
  'lead.contact_preference',
  'lead.reminder_preference',
  'lead.confirm',
  'human.request',
  'consent.stop',
  'consent.start',
  'account.link_request',
  'account.safe_status_request',
  'account.technical_help_request',
  'account.private_data_request',
  'abuse.detected',
  'conversation.unknown',
] as const;

export const whatsappIntentTypeSchema = z.enum(whatsappIntentTypes);
export type WhatsAppIntentType = z.infer<typeof whatsappIntentTypeSchema>;

export const whatsappEntitySchema = z.object({
  kind: z.enum([
    'audience',
    'person_name',
    'school_name',
    'contact_preference',
    'reminder_preference',
    'program_fact_key',
  ]),
  value: z.string().trim().min(1).max(240),
  confidence: z.number().min(0).max(1),
});
export type WhatsAppEntity = z.infer<typeof whatsappEntitySchema>;

export const whatsappCompiledIntentSchema = z.object({
  type: whatsappIntentTypeSchema,
  confidence: z.number().min(0).max(1),
  deterministic: z.boolean(),
  entities: z.array(whatsappEntitySchema).default([]),
  safety: z.object({
    private_data_requested: z.boolean().default(false),
    technical_ticket_requested: z.boolean().default(false),
    account_link_requested: z.boolean().default(false),
    abuse_detected: z.boolean().default(false),
  }),
});
export type WhatsAppCompiledIntent = z.infer<typeof whatsappCompiledIntentSchema>;

export const whatsappMessageKinds = [
  'PUBLIC_PROGRAM_ANSWER',
  'QUALIFY_AUDIENCE',
  'ASK_GUARDIAN_NAME',
  'ASK_SCHOOL_CONTACT_NAME',
  'ASK_CONTACT_PREFERENCE',
  'ASK_FAMILY_REMINDER_PREFERENCE',
  'FAMILY_LEAD_ACK',
  'SCHOOL_LEAD_ACK',
  'HUMAN_HANDOFF_ACK',
  'STOP_CONFIRMATION',
  'START_CONFIRMATION',
  'SUPPRESSION_STATE_NOTICE',
  'ACCOUNT_LINK_OFFER',
  'ACCOUNT_LINK_CONFIRMED',
  'SAFE_STATUS_RESPONSE',
  'PRIVATE_DATA_BLOCKED',
  'TECHNICAL_HELP_REDIRECT',
  'UNKNOWN_FALLBACK',
] as const;

export const whatsappMessageKindSchema = z.enum(whatsappMessageKinds);
export type WhatsAppMessageKind = z.infer<typeof whatsappMessageKindSchema>;

export const whatsappProviderDeliveryStatuses = [
  'accepted',
  'sent',
  'delivered',
  'read',
  'failed',
  'retriable_failure',
  'dead_lettered',
  'suppressed',
] as const;

export const whatsappProviderDeliveryStatusSchema = z.enum(whatsappProviderDeliveryStatuses);
export type WhatsAppProviderDeliveryStatus = z.infer<typeof whatsappProviderDeliveryStatusSchema>;

export type WhatsAppInboundMessage = {
  kind: 'message';
  providerMessageId: string;
  senderE164: string;
  text: string;
  timestamp?: Date | undefined;
};

export type WhatsAppInboundStatus = {
  kind: 'status';
  providerMessageId: string;
  recipientE164?: string | undefined;
  status: WhatsAppProviderDeliveryStatus;
  timestamp?: Date | undefined;
  failureCode?: string | undefined;
};

export type WhatsAppProviderWebhookEvent = WhatsAppInboundMessage | WhatsAppInboundStatus;

export type WhatsAppProviderSendRequest = {
  idempotencyKey: string;
  toE164: string;
  text: string;
  kind: WhatsAppMessageKind;
  metadata?: Record<string, unknown> | undefined;
};

export type WhatsAppProviderSendReceipt = {
  provider: 'meta_cloud' | 'sink';
  providerMessageId?: string | undefined;
  acceptedAt: Date;
  sink: boolean;
};

export type WhatsAppProviderWebhookParseResult = {
  providerAccountKey: string;
  events: WhatsAppProviderWebhookEvent[];
};

export interface WhatsAppProviderAdapter {
  verifyWebhook(input: {
    rawBody: Buffer;
    signatureHeader?: string | undefined;
    secret?: string | undefined;
  }): boolean;
  parseWebhook(input: {
    rawBody: Buffer;
    providerAccountKey: string;
  }): WhatsAppProviderWebhookParseResult;
  sendMessage(input: WhatsAppProviderSendRequest): Promise<WhatsAppProviderSendReceipt>;
}
