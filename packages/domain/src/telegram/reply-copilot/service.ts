import { createHash, randomUUID } from 'node:crypto';
import {
  NO_SUGGESTION_REVIEW_REQUIRED,
  REPLY_COPILOT_PRODUCT_KEY,
  type NormalizedGhlInboundEmail,
  type ReplyCopilotActionKind,
  type ReplyCopilotActorDirectory,
  type ReplyCopilotGhlDelivery,
  type ReplyCopilotGhlReply,
  type ReplyCopilotIntent,
  type ReplyCopilotPrivatePayload,
  type ReplyCopilotRoute,
  type ReplyCopilotStore,
  type ReplyCopilotTelegramCard,
  type ReplyCopilotTelegramDelivery,
  type ReplyCopilotVoiceExample,
} from '../../../../contracts/src/telegram/reply-copilot.ts';
import {
  asBotKey,
  type BotEnvironment,
  type BotKey,
  type SensitivePayloadCodec,
  type SensitivePayloadRef,
} from '../../../../contracts/src/telegram/types.ts';
import {
  buildFinalPreviewCard,
  buildInboundTelegramCard,
  parseAndVerifyActionToken,
} from './cards.ts';
import { routeReplyCopilotInbound } from './routing.ts';
import { suggestReplyCopilotResponse } from './voice.ts';

export type ReplyCopilotServiceConfig = Readonly<{
  botKey?: string;
  environment: BotEnvironment;
  workspaceKey: string;
  actionSigningSecret: string;
  intentTtlMs: number;
  telegramDeliveryEnabled: boolean;
  ghlDeliveryEnabled: boolean;
  ghlConversationBaseUrl: string;
  maxAttempts?: number;
}>;

export class ReplyCopilotService {
  private readonly botKey: BotKey;
  private readonly maxAttempts: number;

  constructor(
    private readonly store: ReplyCopilotStore,
    private readonly codec: SensitivePayloadCodec,
    private readonly directory: ReplyCopilotActorDirectory,
    private readonly config: ReplyCopilotServiceConfig,
  ) {
    this.botKey = asBotKey(config.botKey ?? 'one_time_rabbi_torah_console');
    this.maxAttempts = config.maxAttempts ?? 5;
    if (config.actionSigningSecret.length < 32) {
      throw new Error('REPLY_COPILOT_ACTION_SECRET_TOO_SHORT');
    }
    if (config.intentTtlMs < 60_000 || config.intentTtlMs > 7 * 24 * 60 * 60 * 1000) {
      throw new Error('REPLY_COPILOT_INTENT_TTL_INVALID');
    }
  }

  async ingest(
    inbound: NormalizedGhlInboundEmail,
    options: {
      now?: Date;
      aiRouteSuggestion?: Readonly<{ route: ReplyCopilotRoute; confidence: number }>;
      actionIdFactory?: () => string;
    } = {},
  ) {
    const now = options.now ?? new Date();
    const routing = routeReplyCopilotInbound(inbound, options.aiRouteSuggestion);
    const suggestion = suggestReplyCopilotResponse({ inbound, routing });
    const mappedActor = await this.directory.resolve(routing.route);
    const privatePayload: ReplyCopilotPrivatePayload = {
      inbound,
      ...(suggestion.state === 'suggested' ? { suggestionText: suggestion.text } : {}),
    };
    const intentKey = `ot3_intent_${sha256(`${inbound.locationId}:${inbound.emailMessageId}`).slice(0, 32)}`;
    const payloadRef = await this.encrypt(privatePayload, intentKey);
    const intent: ReplyCopilotIntent = {
      intentKey,
      productKey: REPLY_COPILOT_PRODUCT_KEY,
      workspaceKey: this.config.workspaceKey,
      sourceEventKey: inbound.eventKey,
      sourceMessageDigest: sha256(`${inbound.locationId}:${inbound.emailMessageId}`),
      locationId: inbound.locationId,
      conversationDigest: sha256(inbound.conversationId),
      route: routing.route,
      routeReasonCode: routing.reasonCode,
      routeTableVersion: routing.routeTableVersion,
      suggestionState: suggestion.state,
      suggestionDigest: suggestion.digest,
      promptVersion: suggestion.promptVersion,
      modelVersion: suggestion.modelVersion,
      voiceProfileVersion: suggestion.voiceProfileVersion,
      expectedChatRefHash: mappedActor ? sha256(mappedActor.chatRef) : null,
      expectedUserRefHash: mappedActor ? sha256(mappedActor.userRef) : null,
      openInGhlUrl: ghlConversationUrl(this.config.ghlConversationBaseUrl, inbound.conversationId),
      version: 1,
      state: mappedActor ? 'pending_card' : 'blocked_mapping',
      expiresAt: new Date(now.getTime() + this.config.intentTtlMs).toISOString(),
      payloadRef,
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
    };
    const ingested = await this.store.ingest({
      intent,
      sourceIdentity: `${inbound.locationId}:${inbound.emailMessageId}`,
    });
    if (ingested.duplicate) {
      await this.audit(ingested.intent.intentKey, 'duplicate_fenced', 'GHL_DUPLICATE_FENCED', now);
      return { duplicate: true, cardEnqueued: false, intent: ingested.intent };
    }
    await this.audit(intent.intentKey, 'ingested', routing.reasonCode, now, {
      route: routing.route,
      protectedAdministrativeClass: routing.protectedAdministrativeClass,
    });
    if (!mappedActor || !this.config.telegramDeliveryEnabled) {
      const reason = !mappedActor ? 'TARGET_MAPPING_UNCONFIGURED' : 'TELEGRAM_DELIVERY_DISABLED';
      await this.audit(intent.intentKey, 'delivery_blocked', reason, now);
      return { duplicate: false, cardEnqueued: false, intent };
    }
    const card = await buildInboundTelegramCard({
      intent,
      inbound,
      suggestionText: suggestion.text,
      expectedChatRef: mappedActor.chatRef,
      expectedUserRef: mappedActor.userRef,
      store: this.store,
      actionSecret: this.config.actionSigningSecret,
      ...(options.actionIdFactory ? { actionIdFactory: options.actionIdFactory } : {}),
    });
    const enqueued = await this.enqueueTelegram(intent, card, now);
    const updated = { ...intent, state: 'card_queued' as const, updatedAt: now.toISOString() };
    await this.store.updateIntent(updated);
    return { duplicate: false, cardEnqueued: enqueued, intent: updated };
  }

  async handleAction(input: {
    callbackData: string;
    chatRef: string;
    userRef: string;
    now?: Date;
    actionIdFactory?: () => string;
  }) {
    const now = input.now ?? new Date();
    const parsed = parseAndVerifyActionToken(input.callbackData, this.config.actionSigningSecret);
    if (!parsed) return this.denied(null, 'ACTION_TOKEN_INVALID', now);
    const binding = await this.store.consumeAction({
      tokenDigest: parsed.tokenDigest,
      expectedChatRefHash: sha256(input.chatRef),
      expectedUserRefHash: sha256(input.userRef),
      consumedAt: now.toISOString(),
    });
    if (!binding) return this.denied(null, 'ACTION_IDENTITY_OR_REPLAY_DENIED', now);
    const intent = await this.store.getIntent(binding.intentKey);
    if (!intent) return this.denied(binding.intentKey, 'ACTION_INTENT_MISSING', now);
    if (
      parsed.action !== binding.action ||
      parsed.version !== binding.intentVersion ||
      intent.version !== binding.intentVersion ||
      intent.productKey !== binding.productKey ||
      intent.workspaceKey !== binding.workspaceKey ||
      intent.conversationDigest !== binding.conversationDigest ||
      intent.sourceMessageDigest !== binding.sourceMessageDigest ||
      intent.expectedChatRefHash !== binding.expectedChatRefHash ||
      intent.expectedUserRefHash !== binding.expectedUserRefHash
    ) {
      return this.denied(intent.intentKey, 'ACTION_BINDING_STALE', now);
    }
    if (new Date(binding.expiresAt).getTime() <= now.getTime()) {
      await this.store.updateIntent({ ...intent, state: 'expired', updatedAt: now.toISOString() });
      return this.denied(intent.intentKey, 'ACTION_EXPIRED', now);
    }
    return this.executeAction(intent, binding.action, input.chatRef, input.userRef, now, {
      ...(input.actionIdFactory ? { actionIdFactory: input.actionIdFactory } : {}),
    });
  }

  async captureDraft(input: {
    replyToTelegramMessageRef: string;
    chatRef: string;
    userRef: string;
    text: string;
    now?: Date;
    actionIdFactory?: () => string;
  }) {
    const now = input.now ?? new Date();
    const intent = await this.store.findIntentByTelegramMessage(
      sha256(input.replyToTelegramMessageRef),
    );
    if (!intent) return this.denied(null, 'DRAFT_INTENT_NOT_FOUND', now);
    if (
      intent.expectedChatRefHash !== sha256(input.chatRef) ||
      intent.expectedUserRefHash !== sha256(input.userRef) ||
      intent.state !== 'awaiting_draft' ||
      new Date(intent.expiresAt).getTime() <= now.getTime()
    ) {
      return this.denied(intent.intentKey, 'DRAFT_BINDING_DENIED', now);
    }
    const finalText = validReplyText(input.text);
    const payload = await this.decrypt(intent);
    const nextIntent: ReplyCopilotIntent = {
      ...intent,
      version: intent.version + 1,
      state: 'preview_queued',
      payloadRef: await this.encrypt(
        { ...payload, draftText: finalText, finalText },
        intent.intentKey,
      ),
      updatedAt: now.toISOString(),
    };
    const card = await buildFinalPreviewCard({
      intent: nextIntent,
      finalText,
      expectedChatRef: input.chatRef,
      expectedUserRef: input.userRef,
      store: this.store,
      actionSecret: this.config.actionSigningSecret,
      ...(input.actionIdFactory ? { actionIdFactory: input.actionIdFactory } : {}),
    });
    await this.store.updateIntent(nextIntent);
    const enqueued = await this.enqueueTelegram(nextIntent, card, now);
    await this.audit(
      intent.intentKey,
      'draft_previewed',
      'FINAL_CONFIRMATION_REQUIRED',
      now,
      {
        enqueued,
      },
      sha256(input.userRef),
    );
    return { status: 'preview_queued' as const, intent: nextIntent, cardEnqueued: enqueued };
  }

  private async executeAction(
    intent: ReplyCopilotIntent,
    action: ReplyCopilotActionKind,
    chatRef: string,
    userRef: string,
    now: Date,
    options: { actionIdFactory?: () => string },
  ) {
    if (action === 'write_own' || action === 'cancel') {
      const next = {
        ...intent,
        version: intent.version + 1,
        state: 'awaiting_draft' as const,
        updatedAt: now.toISOString(),
      };
      await this.store.updateIntent(next);
      await this.audit(
        intent.intentKey,
        'awaiting_draft',
        action.toUpperCase(),
        now,
        {},
        sha256(userRef),
      );
      return { status: 'awaiting_draft' as const, intent: next };
    }
    if (action === 'dismiss') {
      const next = {
        ...intent,
        version: intent.version + 1,
        state: 'dismissed' as const,
        updatedAt: now.toISOString(),
      };
      await this.store.updateIntent(next);
      await this.recordVoiceOutcome(next, 'rejected', userRef, now, false);
      await this.audit(intent.intentKey, 'dismissed', 'HUMAN_DISMISSED', now, {}, sha256(userRef));
      return { status: 'dismissed' as const, intent: next };
    }
    if (action === 'send_to_rabbi' || action === 'return_to_shloimie') {
      const route: ReplyCopilotRoute = action === 'send_to_rabbi' ? 'RABBI' : 'SHLOIMIE';
      return this.reroute(intent, route, chatRef, userRef, now, options);
    }
    const payload = await this.decrypt(intent);
    if (action === 'send_suggested') {
      if (!payload.suggestionText || intent.suggestionState !== 'suggested') {
        return this.denied(intent.intentKey, 'SUGGESTION_NOT_SENDABLE', now);
      }
      return this.approve(intent, payload.suggestionText, 'accepted_exact', userRef, now);
    }
    if (action === 'confirm_send') {
      if (intent.state !== 'preview_queued' || !payload.finalText) {
        return this.denied(intent.intentKey, 'FINAL_PREVIEW_NOT_CURRENT', now);
      }
      return this.approve(intent, payload.finalText, 'edited', userRef, now);
    }
    return this.denied(intent.intentKey, 'ACTION_UNSUPPORTED', now);
  }

  private async reroute(
    intent: ReplyCopilotIntent,
    route: ReplyCopilotRoute,
    _chatRef: string,
    userRef: string,
    now: Date,
    options: { actionIdFactory?: () => string },
  ) {
    const actor = await this.directory.resolve(route);
    if (!actor) return this.denied(intent.intentKey, 'TARGET_MAPPING_UNCONFIGURED', now);
    const payload = await this.decrypt(intent);
    const next: ReplyCopilotIntent = {
      ...intent,
      route,
      routeReasonCode: 'human_reclassified',
      expectedChatRefHash: sha256(actor.chatRef),
      expectedUserRefHash: sha256(actor.userRef),
      version: intent.version + 1,
      state: 'returned',
      updatedAt: now.toISOString(),
    };
    const card = await buildInboundTelegramCard({
      intent: next,
      inbound: payload.inbound,
      suggestionText: payload.suggestionText ?? NO_SUGGESTION_REVIEW_REQUIRED,
      expectedChatRef: actor.chatRef,
      expectedUserRef: actor.userRef,
      store: this.store,
      actionSecret: this.config.actionSigningSecret,
      ...(options.actionIdFactory ? { actionIdFactory: options.actionIdFactory } : {}),
    });
    const enqueued = await this.enqueueTelegram(next, card, now);
    const queued = { ...next, state: 'card_queued' as const };
    await this.store.updateIntent(queued);
    await this.audit(intent.intentKey, 'rerouted', route, now, { enqueued }, sha256(userRef));
    return { status: 'rerouted' as const, intent: queued, cardEnqueued: enqueued };
  }

  private async approve(
    intent: ReplyCopilotIntent,
    finalText: string,
    outcome: 'accepted_exact' | 'edited',
    userRef: string,
    now: Date,
  ) {
    if (!this.config.ghlDeliveryEnabled) {
      await this.audit(
        intent.intentKey,
        'provider_off',
        'GHL_DELIVERY_DISABLED',
        now,
        {},
        sha256(userRef),
      );
      return { status: 'provider_off' as const, intent };
    }
    const payload = await this.decrypt(intent);
    const reply = buildGhlReply(payload.inbound, validReplyText(finalText), intent, now);
    const outboxKey = `ot3_ghl_${sha256(intent.intentKey).slice(0, 32)}`;
    const deliveryPayload = await this.encrypt(reply, outboxKey);
    const delivery: ReplyCopilotGhlDelivery = {
      outboxKey,
      intentKey: intent.intentKey,
      idempotencyKey: reply.idempotencyKey,
      replyDigest: sha256(reply.message),
      payloadRef: deliveryPayload,
      state: 'queued',
      attempts: 0,
      maxAttempts: this.maxAttempts,
      nextAttemptAt: now.toISOString(),
      leaseOwner: null,
      leaseGeneration: 0,
      leaseExpiresAt: null,
      providerMessageRefHash: null,
      providerConversationRefHash: null,
      providerThreadRefHash: null,
      lastErrorCode: null,
    };
    const enqueued = await this.store.enqueueGhl(delivery);
    const next: ReplyCopilotIntent = {
      ...intent,
      version: intent.version + 1,
      state: 'send_queued',
      payloadRef: await this.encrypt({ ...payload, finalText: reply.message }, intent.intentKey),
      updatedAt: now.toISOString(),
    };
    await this.store.updateIntent(next);
    await this.recordVoiceOutcome(next, outcome, userRef, now, true);
    await this.audit(intent.intentKey, 'approved', outcome, now, { enqueued }, sha256(userRef));
    return { status: 'send_queued' as const, intent: next, enqueued };
  }

  private async recordVoiceOutcome(
    intent: ReplyCopilotIntent,
    outcome: 'accepted_exact' | 'edited' | 'rejected',
    userRef: string,
    now: Date,
    approvedForVoice: boolean,
  ) {
    const payload = await this.decrypt(intent);
    const finalText =
      payload.finalText ?? (outcome === 'accepted_exact' ? payload.suggestionText : undefined);
    const finalTextRef = finalText
      ? await this.encrypt({ finalText }, `${intent.intentKey}:voice`)
      : null;
    const example: ReplyCopilotVoiceExample = {
      exampleKey: `ot3_voice_${sha256(`${intent.intentKey}:${outcome}`).slice(0, 32)}`,
      intentKey: intent.intentKey,
      messageClass: intent.routeReasonCode,
      outcome,
      suggestionDigest: intent.suggestionDigest,
      finalDigest: sha256(finalText ?? ''),
      promptVersion: intent.promptVersion,
      modelVersion: intent.modelVersion,
      approvedForVoice,
      actorUserRefHash: sha256(userRef),
      finalTextRef,
      recordedAt: now.toISOString(),
    };
    await this.store.saveVoiceExample(example);
  }

  private async enqueueTelegram(
    intent: ReplyCopilotIntent,
    card: ReplyCopilotTelegramCard,
    now: Date,
  ) {
    const outboxKey = `ot3_tg_${sha256(`${intent.intentKey}:${card.kind}:${intent.version}`).slice(0, 32)}`;
    const payloadRef = await this.encrypt(card, outboxKey);
    const delivery: ReplyCopilotTelegramDelivery = {
      outboxKey,
      intentKey: intent.intentKey,
      chatRefHash: sha256(card.chatRef),
      idempotencyKey: `${intent.intentKey}:${card.kind}:${intent.version}`,
      payloadRef,
      state: 'queued',
      attempts: 0,
      maxAttempts: this.maxAttempts,
      nextAttemptAt: now.toISOString(),
      leaseOwner: null,
      leaseGeneration: 0,
      leaseExpiresAt: null,
      providerMessageRefHash: null,
      lastErrorCode: null,
    };
    return this.store.enqueueTelegram(delivery);
  }

  private async encrypt(payload: unknown, actorKey: string): Promise<SensitivePayloadRef> {
    return this.codec.encrypt(payload, {
      botKey: this.botKey,
      environment: this.config.environment,
      productKey: REPLY_COPILOT_PRODUCT_KEY,
      actorKey,
      classification: 'intent_payload',
    });
  }

  private async decrypt(intent: ReplyCopilotIntent) {
    const value = await this.codec.decrypt(intent.payloadRef, {
      botKey: this.botKey,
      environment: this.config.environment,
      productKey: REPLY_COPILOT_PRODUCT_KEY,
      actorKey: intent.intentKey,
      classification: 'intent_payload',
    });
    if (!isPrivatePayload(value)) throw new Error('REPLY_COPILOT_PRIVATE_PAYLOAD_INVALID');
    return value;
  }

  private async denied(intentKey: string | null, reasonCode: string, now: Date) {
    await this.audit(intentKey, 'denied', reasonCode, now);
    return { status: 'denied' as const, reasonCode };
  }

  private async audit(
    intentKey: string | null,
    outcome: string,
    reasonCode: string,
    now: Date,
    metadata: Record<string, string | number | boolean | null> = {},
    actorUserRefHash: string | null = null,
  ) {
    await this.store.appendAudit({
      eventKey: `ot3_audit_${randomUUID()}`,
      intentKey,
      outcome,
      reasonCode,
      actorUserRefHash,
      metadata,
      occurredAt: now.toISOString(),
    });
  }
}

function buildGhlReply(
  inbound: NormalizedGhlInboundEmail,
  message: string,
  intent: ReplyCopilotIntent,
  now: Date,
): ReplyCopilotGhlReply {
  return {
    locationId: inbound.locationId,
    contactId: inbound.contactId,
    conversationId: inbound.conversationId,
    type: 'Email',
    status: 'pending',
    message,
    subject: /^re:/i.test(inbound.subject) ? inbound.subject : `Re: ${inbound.subject}`,
    replyMessageId: inbound.emailMessageId || inbound.messageId,
    threadId: inbound.threadId,
    emailFrom: emailAddress(inbound.to),
    emailTo: emailAddress(inbound.from),
    emailReplyMode: 'reply',
    idempotencyKey: `ot3:${intent.intentKey}:v${intent.version}`,
    approvedAt: now.toISOString(),
  };
}

function validReplyText(value: string) {
  const normalized = value.replace(/\r\n/g, '\n').trim();
  if (normalized.length < 1 || normalized.length > 12_000) {
    throw new Error('REPLY_COPILOT_REPLY_BOUNDS_INVALID');
  }
  return normalized;
}

function emailAddress(value: string) {
  const address = value.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+/i)?.[0];
  if (!address) throw new Error('REPLY_COPILOT_EMAIL_ADDRESS_INVALID');
  return address;
}

function ghlConversationUrl(base: string, conversationId: string) {
  const url = new URL(base);
  url.searchParams.set('conversationId', conversationId);
  return url.toString();
}

function isPrivatePayload(value: unknown): value is ReplyCopilotPrivatePayload {
  if (!value || typeof value !== 'object') return false;
  const inbound = (value as Record<string, unknown>).inbound;
  return Boolean(inbound && typeof inbound === 'object');
}

function sha256(value: string) {
  return createHash('sha256').update(value).digest('hex');
}
