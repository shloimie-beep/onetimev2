export type BotEnvironment = 'local' | 'staging' | 'production';
export type BotKey = string & { readonly __brand: 'BotKey' };
export type ProviderUserRef = string & { readonly __brand: 'ProviderUserRef' };
export type ChatRef = string & { readonly __brand: 'ChatRef' };
export type CanonicalUserKey = string & { readonly __brand: 'CanonicalUserKey' };

export type ChatContext = 'private' | 'group' | 'supergroup' | 'channel';
export type OneTimeBotRole = 'owner' | 'admin' | 'crm_agent' | 'viewer';
export type OneTimeTelegramGatewayRole = 'one_time_owner' | 'one_time_admin';

export type BotUpdateKind = 'message' | 'callback_query' | 'unsupported';

export type NormalizedBotUpdate = {
  updateId: string;
  kind: BotUpdateKind;
  botKey: BotKey;
  environment: BotEnvironment;
  providerUserRef?: ProviderUserRef;
  chatRef?: ChatRef;
  chatContext: ChatContext;
  text?: string;
  callbackData?: string;
  messageId?: string;
  isForwarded: boolean;
  isEdited: boolean;
  isAnonymousAdmin: boolean;
  receivedAt: string;
};

export type TelegramIdentityMapping = {
  mappingKey: string;
  botKey: BotKey;
  environment: BotEnvironment;
  providerUserRef: ProviderUserRef;
  chatRef: ChatRef;
  canonicalUserKey: CanonicalUserKey;
  accountKey: string;
  productKey: string;
  membershipKey: string;
  mappingVersion: number;
  securityVersion: number;
  status: 'active' | 'revoked';
};

export type CanonicalOneTimeActor = {
  userKey: CanonicalUserKey;
  displayLabel: string;
  accountKey: string;
  productKey: string;
  membershipKey: string;
  membershipStatus: 'active' | 'inactive' | 'suspended';
  userStatus: 'active' | 'disabled' | 'suspended';
  role: OneTimeBotRole;
  securityVersion: number;
  capabilities: BotCapability[];
};

export const botCapabilities = [
  'gateway.help',
  'gateway.status.read',
  'gateway.identity.read_self',
  'gateway.scope.read',
  'crm.lead.list',
  'crm.lead.read',
  'crm.signup.recent',
  'crm.lead.create',
  'crm.contact.read_redacted',
  'crm.lead_tag.list',
  'crm.lead_tag.add',
  'crm.lead_tag.remove',
  'class.schedule.read',
  'class.status.read',
  'class.status.update',
  'content.pipeline.read',
  'content.item.read',
  'content.knowledge.read',
  'content.item.retry',
  'task.list',
  'task.read',
  'task.create',
  'task.update',
  'support.ticket.list',
  'support.ticket.read_redacted',
  'support.ticket.decision_needed',
  'support.ticket.assign_self',
  'support.ticket.status.update',
  'class.question.list',
  'class.question.read_redacted',
  'class.question.select',
  'class.question.resolve',
  'social.draft.list',
  'social.draft.read',
  'social.draft.approval_link',
  'telegram.audit.read_recent',
] as const;

export type BotCapability = (typeof botCapabilities)[number];
export type BotCommandSource = 'deterministic' | 'natural_language' | 'callback';
export type BotRiskClass = 'R0' | 'R1' | 'R2' | 'R3';
export type BotConfirmationMode = 'none' | 'nl_preview' | 'always';

export const botWriteCapabilities = [
  'crm.lead.create',
  'crm.lead_tag.add',
  'crm.lead_tag.remove',
  'class.status.update',
  'content.item.retry',
  'task.create',
  'task.update',
  'support.ticket.assign_self',
  'support.ticket.status.update',
  'class.question.select',
  'class.question.resolve',
] as const satisfies readonly BotCapability[];

export type BotWriteCapability = (typeof botWriteCapabilities)[number];
export type BotReadCapability = Exclude<BotCapability, BotWriteCapability>;

export type BotActionArgs = Record<string, string | number | boolean | null | undefined>;
export type BotActionRequest = {
  capability: BotCapability;
  source: BotCommandSource;
  args: BotActionArgs;
  confirmationMode: BotConfirmationMode;
  riskClass: BotRiskClass;
};

export type AuthorizationDecision =
  | { allowed: true; actor: CanonicalOneTimeActor; mapping: TelegramIdentityMapping }
  | {
      allowed: false;
      reason:
        | 'unsupported_context'
        | 'anonymous_admin'
        | 'forwarded_or_edited'
        | 'missing_provider_identity'
        | 'unmapped_identity'
        | 'mapping_revoked'
        | 'unapproved_private_chat'
        | 'inactive_user'
        | 'inactive_membership'
        | 'wrong_account_or_product'
        | 'unsupported_role'
        | 'capability_not_advertised'
        | 'security_version_mismatch'
        | 'rate_limited';
    };

export type BotCommand =
  | { type: 'help' }
  | {
      type: 'read';
      capability: BotReadCapability;
      source: BotCommandSource;
      args: BotActionArgs;
    }
  | {
      type: 'write';
      capability: BotWriteCapability;
      source: BotCommandSource;
      args: BotActionArgs;
      confirmationMode: BotConfirmationMode;
      riskClass: BotRiskClass;
    }
  | { type: 'confirm'; confirmationKey: string }
  | { type: 'cancel'; confirmationKey: string }
  | { type: 'unsupported'; reason: 'unknown' | 'ambiguous' | 'forbidden' | 'missing_argument' };

export type BotCommandPreview = {
  confirmationKey: string;
  capability: BotWriteCapability;
  summary: string;
  actionDigest: string;
  targetVersion?: number;
  expiresAt: string;
};

export type BotCommandResult = {
  status:
    | 'completed'
    | 'already_completed'
    | 'cancelled'
    | 'expired'
    | 'denied'
    | 'unsupported'
    | 'feature_unavailable'
    | 'stale'
    | 'failed';
  publicMessage: string;
  idempotencyKey?: string;
  eventIds?: string[];
  resultRef?: string;
};

export type BotReply = {
  chatRef: ChatRef;
  text: string;
  correlationKey: string;
  buttons?: Array<{ label: string; callbackData: string }>;
};

export type BotTransportAdapter = {
  mode: 'mock' | 'telegram';
  sendReply(reply: BotReply): Promise<void>;
};

export type SensitivePayloadCodec = {
  encrypt(payload: unknown, context: SensitivePayloadContext): Promise<SensitivePayloadRef>;
  decrypt(ref: SensitivePayloadRef, context: SensitivePayloadContext): Promise<unknown>;
};

export type SensitivePayloadContext = {
  botKey: BotKey;
  environment: BotEnvironment;
  accountKey?: string;
  productKey?: string;
  actorKey?: string;
  classification:
    | 'normalized_update'
    | 'contact_query'
    | 'task_command'
    | 'confirmation_payload'
    | 'action_arguments'
    | 'intent_payload';
};

export type SensitivePayloadRef = {
  ciphertext: string;
  digest: string;
  classification: SensitivePayloadContext['classification'];
  expiresAt?: string;
};

export type BotInboxItem = {
  inboxKey: string;
  botKey: BotKey;
  environment: BotEnvironment;
  updateId: string;
  payloadRef: SensitivePayloadRef;
  attempts: number;
  leaseGeneration: number;
};

export type BotInboxRepository = {
  enqueue(
    update: NormalizedBotUpdate,
    payloadRef: SensitivePayloadRef,
  ): Promise<{ duplicate: boolean; inboxKey: string }>;
  claimNext(now: Date, ownerId: string, leaseMs: number): Promise<BotInboxItem | null>;
  complete(inboxKey: string, leaseGeneration: number): Promise<boolean>;
  retry(
    inboxKey: string,
    leaseGeneration: number,
    nextAttemptAt: Date,
    reasonCode: string,
  ): Promise<boolean>;
  deadLetter(inboxKey: string, leaseGeneration: number, reasonCode: string): Promise<boolean>;
};

export type ConsumerLeaseRepository = {
  acquire(input: {
    botKey: BotKey;
    environment: BotEnvironment;
    tokenFingerprint: string;
    ownerId: string;
    leaseMs: number;
    now: Date;
  }): Promise<
    { acquired: true; generation: number } | { acquired: false; reason: 'already_owned' }
  >;
  heartbeat(ownerId: string, generation: number, leaseMs: number, now: Date): Promise<boolean>;
  release(ownerId: string, generation: number): Promise<void>;
};

export type ConfirmationRecord = {
  confirmationKey: string;
  botKey: BotKey;
  environment: BotEnvironment;
  providerUserRef: ProviderUserRef;
  chatRef: ChatRef;
  actorUserKey: CanonicalUserKey;
  accountKey: string;
  productKey: string;
  capability: BotWriteCapability;
  source: BotCommandSource;
  riskClass: BotRiskClass;
  actionDigest: string;
  targetVersion?: number;
  mappingKey: string;
  mappingVersion: number;
  roleAtPreview: OneTimeBotRole;
  securityVersion: number;
  idempotencyKey: string;
  previewDigest: string;
  payloadRef: SensitivePayloadRef;
  expiresAt: string;
  consumedAt?: string;
  cancelledAt?: string;
  result?: BotCommandResult;
};

export type ConfirmationRepository = {
  create(record: ConfirmationRecord): Promise<void>;
  get(confirmationKey: string): Promise<ConfirmationRecord | null>;
  consume(
    confirmationKey: string,
    now: Date,
  ): Promise<'consumed' | 'already_consumed' | 'expired' | 'missing'>;
  cancel(
    confirmationKey: string,
    now: Date,
  ): Promise<'cancelled' | 'already_consumed' | 'expired' | 'missing'>;
  recordResult(confirmationKey: string, result: BotCommandResult, now: Date): Promise<void>;
};

export type BotAuditEvent = {
  botKey: BotKey;
  environment: BotEnvironment;
  accountKey?: string;
  productKey?: string;
  actorUserKey?: string;
  capability?: BotCapability;
  correlationKey: string;
  outcome:
    | 'accepted'
    | 'denied'
    | 'unsupported'
    | 'previewed'
    | 'confirmed'
    | 'cancelled'
    | 'expired'
    | 'completed'
    | 'duplicate'
    | 'failed'
    | 'dead_letter';
  reason?: string;
  metadata?: Record<string, unknown>;
};

export type BotAuditSink = {
  record(event: BotAuditEvent): Promise<void>;
};

export type BotRateLimiter = {
  check(input: {
    botKey: BotKey;
    environment: BotEnvironment;
    actorUserKey?: string;
    chatRef?: ChatRef;
    capability?: BotCapability;
    now: Date;
  }): Promise<{ allowed: true } | { allowed: false; retryAfterSeconds: number }>;
};

export type OneTimeBotApplicationAdapter = {
  adapterId: string;
  supportedCapabilities(): BotCapability[];
  resolveActor(input: {
    mapping: TelegramIdentityMapping;
    botKey: BotKey;
    environment: BotEnvironment;
  }): Promise<CanonicalOneTimeActor | null>;
  readAction?(
    actor: CanonicalOneTimeActor,
    request: Extract<BotActionRequest, { capability: BotReadCapability }> | BotActionRequest,
  ): Promise<string>;
  previewAction?(
    actor: CanonicalOneTimeActor,
    request: Extract<BotActionRequest, { capability: BotWriteCapability }> | BotActionRequest,
  ): Promise<string>;
  executeAction?(
    actor: CanonicalOneTimeActor,
    input: {
      request: Extract<BotActionRequest, { capability: BotWriteCapability }> | BotActionRequest;
      idempotencyKey: string;
    },
  ): Promise<BotCommandResult>;
};

export type IdentityMappingRepository = {
  findActiveMapping(input: {
    botKey: BotKey;
    environment: BotEnvironment;
    providerUserRef: ProviderUserRef;
  }): Promise<TelegramIdentityMapping | null>;
  upsertProtectedMapping(mapping: TelegramIdentityMapping): Promise<void>;
  revoke(mappingKey: string, reason: string): Promise<void>;
};

export function asBotKey(value: string): BotKey {
  return value as BotKey;
}

export function asProviderUserRef(value: string): ProviderUserRef {
  return value as ProviderUserRef;
}

export function asChatRef(value: string): ChatRef {
  return value as ChatRef;
}

export function asCanonicalUserKey(value: string): CanonicalUserKey {
  return value as CanonicalUserKey;
}
