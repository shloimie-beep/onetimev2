export const DELIVERY_CHANNELS = ['email', 'whatsapp', 'internal_email'] as const;
export type DeliveryChannel = (typeof DELIVERY_CHANNELS)[number];

export const SUPPORTED_DELIVERY_EVENT_CHANNEL_PAIRS = [
  { eventType: 'email_acknowledgement', channel: 'email' },
  { eventType: 'whatsapp_confirmation', channel: 'whatsapp' },
  { eventType: 'internal_lead_alert', channel: 'internal_email' },
] as const;

export type SupportedDeliveryEventType =
  (typeof SUPPORTED_DELIVERY_EVENT_CHANNEL_PAIRS)[number]['eventType'];

export type DeliveryTransportMode = 'sink';
export type ReminderPreference = 'email' | 'whatsapp' | 'both' | 'none';
export type RecipientClass = 'public' | 'internal_owner';

export type DeliveryOutboxStatus =
  | 'pending'
  | 'processing'
  | 'sink_delivered'
  | 'delivered'
  | 'suppressed'
  | 'skipped'
  | 'dead_lettered';

export type DeliveryContact = {
  contactKey: string;
  displayName: string;
  familySchoolClassification: 'family' | 'school';
  familyOrSchool: string;
  locationText: string;
  timezone: string;
  emailNormalized: string;
  phoneNormalized: string | null;
  reminderPreference: ReminderPreference;
  consentRecordedAt: Date | null;
  suppressionState: string;
};

export type DeliverySignup = {
  signupKey: string;
  classification: 'family' | 'school';
  metadata: Readonly<Record<string, unknown>>;
};

export type ClaimedDelivery = {
  id: string;
  deliveryKey: string;
  accountKey: string;
  productKey: string;
  contactKey: string | null;
  signupKey: string | null;
  eventType: string;
  channel: DeliveryChannel;
  transportMode: string;
  payload: Readonly<Record<string, unknown>>;
  attempts: number;
  createdAt: Date;
  claimLeaseExpiresAt: Date;
  contact: DeliveryContact | null;
  signup: DeliverySignup | null;
};

export type DeliveryTag = {
  name: string;
  value: string;
};

export type EmailDeliveryRequest = {
  channel: 'email' | 'internal_email';
  provider: 'resend';
  recipientClass: RecipientClass;
  idempotencyKey: string;
  from: string;
  to: string;
  replyTo?: string;
  subject: string;
  text: string;
  html: string;
  tags: readonly DeliveryTag[];
};

export type WhatsAppDeliveryRequest = {
  channel: 'whatsapp';
  provider: 'one_time_wapi';
  recipientClass: 'public';
  idempotencyKey: string;
  to: string;
  text: string;
  noLinkPreview?: boolean;
};

export type DeliveryRequest = EmailDeliveryRequest | WhatsAppDeliveryRequest;

export type ProviderReceipt = {
  provider: 'sink' | 'resend' | 'one_time_wapi';
  messageId?: string;
  acceptedAt: Date;
  sink: boolean;
};

export type ProviderSendContext = {
  deliveryKey: string;
  attempt: number;
  signal: AbortSignal;
};

export interface DeliveryProviderRouter {
  send(request: DeliveryRequest, context: ProviderSendContext): Promise<ProviderReceipt>;
}

export type DeliveryFailure = {
  code: string;
  category: 'transient' | 'permanent';
  provider?: 'resend' | 'one_time_wapi' | 'worker';
  httpStatus?: number;
  retryAfterMs?: number;
};

export type DeliveryTerminalReason =
  | 'contact_missing'
  | 'signup_missing'
  | 'unsupported_event_type'
  | 'email_missing_or_invalid'
  | 'whatsapp_preference_not_selected'
  | 'whatsapp_consent_missing'
  | 'whatsapp_phone_missing_or_invalid'
  | 'contact_suppressed'
  | 'protected_owner_destination_missing'
  | 'school_follow_up_requires_manual_review';

export type DeliveryOutcome =
  | {
      kind: 'delivered';
      at: Date;
      receipt: ProviderReceipt;
    }
  | {
      kind: 'retry';
      at: Date;
      failure: DeliveryFailure;
      nextAttemptAt: Date;
    }
  | {
      kind: 'dead_lettered';
      at: Date;
      failure: DeliveryFailure;
    }
  | {
      kind: 'suppressed';
      at: Date;
      reason: 'contact_suppressed';
    }
  | {
      kind: 'skipped';
      at: Date;
      reason: Exclude<DeliveryTerminalReason, 'contact_suppressed'>;
    };

export type ClaimBatchInput = {
  accountKey: string;
  productKey: string;
  transportMode: DeliveryTransportMode;
  now: Date;
  limit: number;
  leaseMs: number;
};

export interface DeliveryRepository {
  claimBatch(input: ClaimBatchInput): Promise<ClaimedDelivery[]>;
  complete(claim: ClaimedDelivery, outcome: DeliveryOutcome): Promise<boolean>;
}

export interface DeliveryLogger {
  info(event: string, fields?: Readonly<Record<string, unknown>>): void;
  warn(event: string, fields?: Readonly<Record<string, unknown>>): void;
  error(event: string, fields?: Readonly<Record<string, unknown>>): void;
}

export type DeliveryRunSummary = {
  claimed: number;
  delivered: number;
  sinkDelivered: number;
  retried: number;
  deadLettered: number;
  suppressed: number;
  skipped: number;
  leaseLost: number;
};
