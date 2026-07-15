export type BotEnvironment = 'local' | 'staging' | 'production';
export type BotKey = string & { readonly __brand: 'BotKey' };
export type ProviderUserRef = string & { readonly __brand: 'ProviderUserRef' };
export type ChatRef = string & { readonly __brand: 'ChatRef' };
export type CanonicalUserKey = string & { readonly __brand: 'CanonicalUserKey' };

export type ChatContext = 'private' | 'group' | 'supergroup' | 'channel';
export type OneTimeBotRole = 'owner' | 'admin' | 'crm_agent' | 'viewer';

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
  canonicalUserKey: CanonicalUserKey;
  accountKey: string;
  productKey: string;
  membershipKey: string;
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
  'product_status',
  'upcoming_classes',
  'content_pipeline_status',
  'contact_lookup',
  'task_lookup',
  'task_create',
  'task_update',
] as const;

export type BotCapability = (typeof botCapabilities)[number];

export type AuthorizationDecision =
  | { allowed: true; actor: CanonicalOneTimeActor }
  | {
      allowed: false;
      reason:
        | 'unsupported_context'
        | 'anonymous_admin'
        | 'forwarded_or_edited'
        | 'missing_provider_identity'
        | 'unmapped_identity'
        | 'mapping_revoked'
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
      capability: Exclude<BotCapability, 'task_create' | 'task_update'>;
      query?: string;
    }
  | {
      type: 'write_preview';
      capability: 'task_create' | 'task_update';
      title?: string;
      taskKey?: string;
      nextStatus?: 'open' | 'done' | 'blocked';
      entityVersion?: number;
    }
  | { type: 'confirm'; confirmationKey: string }
  | { type: 'cancel'; confirmationKey: string }
  | { type: 'unsupported'; reason: 'unknown' | 'ambiguous' | 'forbidden' | 'missing_argument' };

export type BotCommandPreview = {
  confirmationKey: string;
  capability: 'task_create' | 'task_update';
  summary: string;
  actionDigest: string;
  entityVersion?: number;
  expiresAt: string;
};

export type BotCommandResult = {
  status: 'completed' | 'already_completed' | 'cancelled' | 'expired' | 'denied' | 'unsupported';
  publicMessage: string;
  idempotencyKey?: string;
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
  classification: 'normalized_update' | 'contact_query' | 'task_command' | 'confirmation_payload';
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
  capability: 'task_create' | 'task_update';
  actionDigest: string;
  entityVersion?: number;
  securityVersion: number;
  idempotencyKey: string;
  payloadRef: SensitivePayloadRef;
  expiresAt: string;
  consumedAt?: string;
  cancelledAt?: string;
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
  getProductStatus?(actor: CanonicalOneTimeActor): Promise<string>;
  listUpcomingClasses?(actor: CanonicalOneTimeActor): Promise<string>;
  getContentPipelineStatus?(actor: CanonicalOneTimeActor): Promise<string>;
  searchContacts?(actor: CanonicalOneTimeActor, query: string): Promise<string>;
  lookupTasks?(actor: CanonicalOneTimeActor, query?: string): Promise<string>;
  previewTaskCreate?(actor: CanonicalOneTimeActor, title: string): Promise<string>;
  createTask?(
    actor: CanonicalOneTimeActor,
    input: { title: string; idempotencyKey: string },
  ): Promise<BotCommandResult>;
  previewTaskUpdate?(
    actor: CanonicalOneTimeActor,
    input: { taskKey: string; nextStatus: 'open' | 'done' | 'blocked'; entityVersion: number },
  ): Promise<string>;
  updateTask?(
    actor: CanonicalOneTimeActor,
    input: {
      taskKey: string;
      nextStatus: 'open' | 'done' | 'blocked';
      entityVersion: number;
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
