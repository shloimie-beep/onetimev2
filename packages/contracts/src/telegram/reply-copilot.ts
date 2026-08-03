import type { SensitivePayloadRef } from './types.ts';

export const REPLY_COPILOT_PRODUCT_KEY = 'one_time' as const;
export const REPLY_COPILOT_ROUTE_TABLE_VERSION = 'ot-live-003.02-route-v1' as const;
export const REPLY_COPILOT_PROMPT_VERSION = 'ot-live-003.02-suggestion-v1' as const;
export const REPLY_COPILOT_MODEL_VERSION = 'deterministic-grounded-v1' as const;
export const NO_SUGGESTION_REVIEW_REQUIRED = 'NO_SUGGESTION_REVIEW_REQUIRED' as const;

export type ReplyCopilotIngressKind = 'workflow_shared_secret' | 'oauth_ed25519';
export type ReplyCopilotRoute = 'RABBI' | 'SHLOIMIE';
export type ReplyCopilotOutcome = 'accepted_exact' | 'edited' | 'rejected';
export type ReplyCopilotSuggestionState = 'suggested' | 'review_required';

export type NormalizedGhlInboundEmail = Readonly<{
  eventKey: string;
  ingressKind: ReplyCopilotIngressKind;
  locationId: string;
  contactId: string;
  conversationId: string;
  messageId: string;
  emailMessageId: string;
  threadId: string;
  direction: 'inbound';
  channel: 'email';
  senderDisplayName: string;
  from: string;
  to: string;
  subject: string;
  body: string;
  attachmentMetadata: ReadonlyArray<{
    name: string;
    contentType: string;
    sizeBytes: number | null;
    pointer: string | null;
  }>;
  receivedAt: string;
}>;

export type ReplyCopilotRoutingDecision = Readonly<{
  route: ReplyCopilotRoute;
  reasonCode: string;
  protectedAdministrativeClass: boolean;
  confidence: 'hard_rule' | 'low';
  routeTableVersion: typeof REPLY_COPILOT_ROUTE_TABLE_VERSION;
}>;

export type ReplyCopilotSuggestion = Readonly<{
  state: ReplyCopilotSuggestionState;
  text: string;
  digest: string;
  promptVersion: typeof REPLY_COPILOT_PROMPT_VERSION;
  modelVersion: typeof REPLY_COPILOT_MODEL_VERSION;
  voiceProfileVersion: string;
}>;

export type ReplyCopilotPrivatePayload = {
  inbound: NormalizedGhlInboundEmail;
  suggestionText?: string;
  draftText?: string;
  finalText?: string;
};

export type ReplyCopilotIntentState =
  | 'pending_card'
  | 'card_queued'
  | 'card_delivered'
  | 'awaiting_draft'
  | 'preview_queued'
  | 'approved'
  | 'send_queued'
  | 'sent'
  | 'dismissed'
  | 'returned'
  | 'blocked_mapping'
  | 'review_required'
  | 'expired'
  | 'failed';

export type ReplyCopilotIntent = Readonly<{
  intentKey: string;
  productKey: typeof REPLY_COPILOT_PRODUCT_KEY;
  workspaceKey: string;
  sourceEventKey: string;
  sourceMessageDigest: string;
  locationId: string;
  conversationDigest: string;
  route: ReplyCopilotRoute;
  routeReasonCode: string;
  routeTableVersion: typeof REPLY_COPILOT_ROUTE_TABLE_VERSION;
  suggestionState: ReplyCopilotSuggestionState;
  suggestionDigest: string;
  promptVersion: string;
  modelVersion: string;
  voiceProfileVersion: string;
  expectedChatRefHash: string | null;
  expectedUserRefHash: string | null;
  openInGhlUrl: string;
  version: number;
  state: ReplyCopilotIntentState;
  expiresAt: string;
  payloadRef: SensitivePayloadRef;
  createdAt: string;
  updatedAt: string;
}>;

export type ReplyCopilotActionKind =
  | 'send_suggested'
  | 'write_own'
  | 'confirm_send'
  | 'send_to_rabbi'
  | 'return_to_shloimie'
  | 'dismiss'
  | 'cancel';

export type ReplyCopilotActionBinding = Readonly<{
  tokenDigest: string;
  intentKey: string;
  action: ReplyCopilotActionKind;
  expectedChatRefHash: string;
  expectedUserRefHash: string;
  productKey: typeof REPLY_COPILOT_PRODUCT_KEY;
  workspaceKey: string;
  conversationDigest: string;
  sourceMessageDigest: string;
  intentVersion: number;
  expiresAt: string;
  consumedAt: string | null;
}>;

export type ReplyCopilotButton =
  Readonly<{ label: string; callbackData: string }> | Readonly<{ label: string; url: string }>;

export type ReplyCopilotTelegramCard = Readonly<{
  intentKey: string;
  chatRef: string;
  text: string;
  buttons: ReadonlyArray<ReadonlyArray<ReplyCopilotButton>>;
  kind: 'inbound_card' | 'final_preview' | 'status';
}>;

export type ReplyCopilotTelegramDelivery = Readonly<{
  outboxKey: string;
  intentKey: string;
  chatRefHash: string;
  idempotencyKey: string;
  payloadRef: SensitivePayloadRef;
  state: 'queued' | 'leased' | 'retry' | 'unknown' | 'sent' | 'dead_letter';
  attempts: number;
  maxAttempts: number;
  nextAttemptAt: string;
  leaseOwner: string | null;
  leaseGeneration: number;
  leaseExpiresAt: string | null;
  providerMessageRefHash: string | null;
  lastErrorCode: string | null;
}>;

export type ReplyCopilotGhlReply = Readonly<{
  locationId: string;
  contactId: string;
  conversationId: string;
  type: 'Email';
  status: 'pending';
  message: string;
  subject: string;
  replyMessageId: string;
  threadId: string;
  emailFrom: string;
  emailTo: string;
  emailReplyMode: 'reply';
  idempotencyKey: string;
  approvedAt: string;
}>;

export type ReplyCopilotGhlDelivery = Readonly<{
  outboxKey: string;
  intentKey: string;
  idempotencyKey: string;
  replyDigest: string;
  payloadRef: SensitivePayloadRef;
  state: 'queued' | 'leased' | 'retry' | 'unknown' | 'sent' | 'dead_letter';
  attempts: number;
  maxAttempts: number;
  nextAttemptAt: string;
  leaseOwner: string | null;
  leaseGeneration: number;
  leaseExpiresAt: string | null;
  providerMessageRefHash: string | null;
  providerConversationRefHash: string | null;
  providerThreadRefHash: string | null;
  lastErrorCode: string | null;
}>;

export type ReplyCopilotProviderMessage = Readonly<{
  messageId: string;
  conversationId: string;
  threadId: string;
  emailMessageId: string;
  direction: 'outbound';
  body: string;
}>;

export type ReplyCopilotVoiceExample = Readonly<{
  exampleKey: string;
  intentKey: string;
  messageClass: string;
  outcome: ReplyCopilotOutcome;
  suggestionDigest: string;
  finalDigest: string;
  promptVersion: string;
  modelVersion: string;
  approvedForVoice: boolean;
  actorUserRefHash: string;
  finalTextRef: SensitivePayloadRef | null;
  recordedAt: string;
}>;

export type ReplyCopilotAuditEvent = Readonly<{
  eventKey: string;
  intentKey: string | null;
  outcome: string;
  reasonCode: string;
  actorUserRefHash: string | null;
  metadata: Readonly<Record<string, string | number | boolean | null>>;
  occurredAt: string;
}>;

export type ReplyCopilotMappedActor = Readonly<{
  route: ReplyCopilotRoute;
  chatRef: string;
  userRef: string;
}>;

export type ReplyCopilotActorDirectory = {
  resolve(route: ReplyCopilotRoute): Promise<ReplyCopilotMappedActor | null>;
};

export type ReplyCopilotTelegramProvider = {
  send(
    card: ReplyCopilotTelegramCard,
    idempotencyKey: string,
  ): Promise<
    | { outcome: 'sent'; providerMessageRef: string }
    | { outcome: 'retry'; errorCode: string }
    | { outcome: 'unknown'; errorCode: string }
  >;
  reconcile(
    card: ReplyCopilotTelegramCard,
    idempotencyKey: string,
  ): Promise<
    { outcome: 'sent'; providerMessageRef: string } | { outcome: 'absent' } | { outcome: 'unknown' }
  >;
};

export type ReplyCopilotGhlProvider = {
  send(
    reply: ReplyCopilotGhlReply,
  ): Promise<
    | { outcome: 'sent'; message: ReplyCopilotProviderMessage }
    | { outcome: 'retry'; errorCode: string }
    | { outcome: 'unknown'; errorCode: string }
  >;
  reconcile(reply: ReplyCopilotGhlReply): Promise<ReplyCopilotProviderMessage | null>;
  readMessage(messageId: string): Promise<ReplyCopilotProviderMessage | null>;
};

export type ReplyCopilotStore = {
  ingest(input: {
    intent: ReplyCopilotIntent;
    sourceIdentity: string;
  }): Promise<{ duplicate: boolean; intent: ReplyCopilotIntent }>;
  getIntent(intentKey: string): Promise<ReplyCopilotIntent | null>;
  updateIntent(intent: ReplyCopilotIntent): Promise<boolean>;
  saveAction(binding: ReplyCopilotActionBinding): Promise<void>;
  consumeAction(input: {
    tokenDigest: string;
    expectedChatRefHash: string;
    expectedUserRefHash: string;
    consumedAt: string;
  }): Promise<ReplyCopilotActionBinding | null>;
  enqueueTelegram(delivery: ReplyCopilotTelegramDelivery): Promise<boolean>;
  claimTelegram(
    now: string,
    ownerId: string,
    leaseMs: number,
  ): Promise<ReplyCopilotTelegramDelivery | null>;
  updateTelegram(delivery: ReplyCopilotTelegramDelivery): Promise<boolean>;
  bindTelegramMessage(intentKey: string, providerMessageRefHash: string): Promise<void>;
  findIntentByTelegramMessage(providerMessageRefHash: string): Promise<ReplyCopilotIntent | null>;
  enqueueGhl(delivery: ReplyCopilotGhlDelivery): Promise<boolean>;
  claimGhl(now: string, ownerId: string, leaseMs: number): Promise<ReplyCopilotGhlDelivery | null>;
  updateGhl(delivery: ReplyCopilotGhlDelivery): Promise<boolean>;
  saveVoiceExample(example: ReplyCopilotVoiceExample): Promise<boolean>;
  listVoiceExamples(): Promise<ReplyCopilotVoiceExample[]>;
  appendAudit(event: ReplyCopilotAuditEvent): Promise<void>;
};
