import { describe, expect, it } from 'vitest';
import type {
  NormalizedGhlInboundEmail,
  ReplyCopilotGhlProvider,
  ReplyCopilotGhlReply,
  ReplyCopilotProviderMessage,
  ReplyCopilotTelegramCard,
  ReplyCopilotTelegramProvider,
} from '../../packages/contracts/src/telegram/reply-copilot.ts';
import { DeterministicTestPayloadCodec } from '../../packages/domain/src/telegram/crypto.ts';
import {
  ReplyCopilotGhlDispatcher,
  ReplyCopilotTelegramDispatcher,
} from '../../packages/domain/src/telegram/reply-copilot/dispatchers.ts';
import { MemoryReplyCopilotStore } from '../../packages/domain/src/telegram/reply-copilot/memory-store.ts';
import { ReplyCopilotService } from '../../packages/domain/src/telegram/reply-copilot/service.ts';

describe('OT-LIVE-003 human-approved reply-copilot synthetic flow', () => {
  it('fences duplicate ingress, denies a forwarded actor, and sends one suggested same-thread reply', async () => {
    const harness = createHarness();
    const first = await harness.service.ingest(inbound(), {
      now: at(0),
      actionIdFactory: ids(),
    });
    const duplicate = await harness.service.ingest(inbound(), { now: at(1) });
    expect(first).toMatchObject({ duplicate: false, cardEnqueued: true });
    expect(duplicate).toMatchObject({ duplicate: true, cardEnqueued: false });
    expect(harness.store.telegramDeliveries()).toHaveLength(1);

    await harness.telegramDispatcher.runOnce(at(2));
    expect(harness.telegram.calls).toHaveLength(1);
    const callback = button(harness.telegram.calls[0]!.card, 'Send suggested');
    const forwarded = await harness.service.handleAction({
      callbackData: callback,
      chatRef: 'chat-rabbi',
      userRef: 'user-shloimie',
      now: at(3),
    });
    expect(forwarded).toMatchObject({ status: 'denied' });

    const approved = await harness.service.handleAction({
      callbackData: callback,
      chatRef: 'chat-rabbi',
      userRef: 'user-rabbi',
      now: at(4),
    });
    expect(approved).toMatchObject({ status: 'send_queued', enqueued: true });
    expect(harness.store.ghlDeliveries()).toHaveLength(1);

    const sent = await harness.ghlDispatcher.runOnce(at(5));
    expect(sent).toMatchObject({ state: 'sent', attempts: 1 });
    expect(harness.ghl.calls).toHaveLength(1);
    expect(harness.ghl.calls[0]).toMatchObject({
      locationId: 'pBSnOK2nkdxp6gf9Rg3o',
      contactId: 'contact_seed',
      conversationId: 'conversation_seed',
      type: 'Email',
      status: 'pending',
      replyMessageId: 'email_seed',
      threadId: 'thread_seed',
      emailFrom: 'info@onetimeonetime.com',
      emailTo: 'sdratler@gmail.com',
      emailReplyMode: 'reply',
    });
    expect((await harness.store.getIntent(first.intent.intentKey))?.state).toBe('sent');
    expect(await harness.store.listVoiceExamples()).toMatchObject([
      { outcome: 'accepted_exact', approvedForVoice: true },
    ]);

    const replay = await harness.service.handleAction({
      callbackData: callback,
      chatRef: 'chat-rabbi',
      userRef: 'user-rabbi',
      now: at(6),
    });
    expect(replay).toMatchObject({ status: 'denied' });
    expect(harness.store.ghlDeliveries()).toHaveLength(1);
    expect(harness.ghl.calls).toHaveLength(1);
  });

  it('requires write-own draft preview and a separate final confirmation', async () => {
    const harness = createHarness();
    const ingested = await harness.service.ingest(
      inbound({ emailMessageId: 'email_edit', messageId: 'message_edit', eventKey: 'event_edit' }),
      { now: at(0), actionIdFactory: ids() },
    );
    await harness.telegramDispatcher.runOnce(at(1));
    const originalCard = harness.telegram.calls[0]!;
    const writeOwn = button(originalCard.card, 'Write my own');
    const selected = await harness.service.handleAction({
      callbackData: writeOwn,
      chatRef: 'chat-rabbi',
      userRef: 'user-rabbi',
      now: at(2),
    });
    expect(selected).toMatchObject({ status: 'awaiting_draft' });
    expect(harness.store.ghlDeliveries()).toHaveLength(0);

    const preview = await harness.service.captureDraft({
      replyToTelegramMessageRef: originalCard.providerMessageRef,
      chatRef: 'chat-rabbi',
      userRef: 'user-rabbi',
      text: 'Thank you. I will answer this learning question carefully.',
      now: at(3),
      actionIdFactory: ids(),
    });
    expect(preview).toMatchObject({ status: 'preview_queued', cardEnqueued: true });
    expect(harness.store.ghlDeliveries()).toHaveLength(0);

    await harness.telegramDispatcher.runOnce(at(4));
    const previewCard = harness.telegram.calls[1]!.card;
    expect(previewCard.text).toContain('nothing has been sent');
    const confirm = button(previewCard, 'Confirm send');
    const confirmed = await harness.service.handleAction({
      callbackData: confirm,
      chatRef: 'chat-rabbi',
      userRef: 'user-rabbi',
      now: at(5),
    });
    expect(confirmed).toMatchObject({ status: 'send_queued' });
    expect(harness.store.ghlDeliveries()).toHaveLength(1);

    await harness.ghlDispatcher.runOnce(at(6));
    expect(harness.ghl.calls).toHaveLength(1);
    expect(harness.ghl.calls[0]!.message).toBe(
      'Thank you. I will answer this learning question carefully.',
    );
    expect((await harness.store.getIntent(ingested.intent.intentKey))?.state).toBe('sent');
    expect(await harness.store.listVoiceExamples()).toMatchObject([
      { outcome: 'edited', approvedForVoice: true },
    ]);
  });

  it('reconciles an unknown GHL result before any retry and creates no duplicate send', async () => {
    const harness = createHarness();
    harness.ghl.unknownFirst = true;
    await harness.service.ingest(inbound(), { now: at(0), actionIdFactory: ids() });
    await harness.telegramDispatcher.runOnce(at(1));
    const send = button(harness.telegram.calls[0]!.card, 'Send suggested');
    await harness.service.handleAction({
      callbackData: send,
      chatRef: 'chat-rabbi',
      userRef: 'user-rabbi',
      now: at(2),
    });

    const unknown = await harness.ghlDispatcher.runOnce(at(3));
    expect(unknown?.state).toBe('unknown');
    expect(harness.ghl.calls).toHaveLength(1);
    const reconciled = await harness.ghlDispatcher.runOnce(at(40));
    expect(reconciled?.state).toBe('sent');
    expect(harness.ghl.calls).toHaveLength(1);
    expect(harness.ghl.reconcileCalls).toBe(1);
  });

  it('dead-letters a provider readback that drifted into a new thread', async () => {
    const harness = createHarness();
    harness.ghl.readbackThread = 'wrong_thread';
    await harness.service.ingest(inbound(), { now: at(0), actionIdFactory: ids() });
    await harness.telegramDispatcher.runOnce(at(1));
    await harness.service.handleAction({
      callbackData: button(harness.telegram.calls[0]!.card, 'Send suggested'),
      chatRef: 'chat-rabbi',
      userRef: 'user-rabbi',
      now: at(2),
    });
    const failed = await harness.ghlDispatcher.runOnce(at(3));
    expect(failed).toMatchObject({
      state: 'dead_letter',
      lastErrorCode: 'GHL_READBACK_THREAD_MISMATCH',
    });
    expect(harness.ghl.calls).toHaveLength(1);
  });

  it('moves a low-confidence info message to Rabbi only after the mapped Shloimie actor reclassifies it', async () => {
    const harness = createHarness();
    await harness.service.ingest(
      inbound({
        eventKey: 'event_route',
        messageId: 'message_route',
        emailMessageId: 'email_route',
        subject: 'A note',
        body: 'Could somebody take a look at this?',
      }),
      { now: at(0), actionIdFactory: ids() },
    );
    await harness.telegramDispatcher.runOnce(at(1));
    expect(harness.telegram.calls[0]!.card.chatRef).toBe('chat-shloimie');
    const rerouted = await harness.service.handleAction({
      callbackData: button(harness.telegram.calls[0]!.card, 'Send to Rabbi'),
      chatRef: 'chat-shloimie',
      userRef: 'user-shloimie',
      now: at(2),
      actionIdFactory: ids(),
    });
    expect(rerouted).toMatchObject({ status: 'rerouted', cardEnqueued: true });
    await harness.telegramDispatcher.runOnce(at(3));
    expect(harness.telegram.calls).toHaveLength(2);
    expect(harness.telegram.calls[1]!.card.chatRef).toBe('chat-rabbi');
  });

  it('expires a bound action without enqueueing a GHL send', async () => {
    const harness = createHarness();
    await harness.service.ingest(inbound(), { now: at(0), actionIdFactory: ids() });
    await harness.telegramDispatcher.runOnce(at(1));
    const expired = await harness.service.handleAction({
      callbackData: button(harness.telegram.calls[0]!.card, 'Send suggested'),
      chatRef: 'chat-rabbi',
      userRef: 'user-rabbi',
      now: at(3_601),
    });
    expect(expired).toMatchObject({ status: 'denied', reasonCode: 'ACTION_EXPIRED' });
    expect(harness.store.ghlDeliveries()).toHaveLength(0);
  });
});

function createHarness() {
  const store = new MemoryReplyCopilotStore();
  const codec = new DeterministicTestPayloadCodec();
  const telegram = new SyntheticTelegramProvider();
  const ghl = new SyntheticGhlProvider();
  const service = new ReplyCopilotService(
    store,
    codec,
    {
      async resolve(route) {
        return route === 'RABBI'
          ? { route, chatRef: 'chat-rabbi', userRef: 'user-rabbi' }
          : { route, chatRef: 'chat-shloimie', userRef: 'user-shloimie' };
      },
    },
    {
      environment: 'local',
      workspaceKey: 'one-time-test',
      actionSigningSecret: 'action-secret-that-is-at-least-thirty-two-characters',
      intentTtlMs: 60 * 60 * 1000,
      telegramDeliveryEnabled: true,
      ghlDeliveryEnabled: true,
      ghlConversationBaseUrl:
        'https://app.gohighlevel.com/v2/location/pBSnOK2nkdxp6gf9Rg3o/conversations/conversations',
    },
  );
  return {
    store,
    telegram,
    ghl,
    service,
    telegramDispatcher: new ReplyCopilotTelegramDispatcher(store, codec, telegram, {
      environment: 'local',
      ownerId: 'telegram-test',
    }),
    ghlDispatcher: new ReplyCopilotGhlDispatcher(store, codec, ghl, {
      environment: 'local',
      ownerId: 'ghl-test',
    }),
  };
}

class SyntheticTelegramProvider implements ReplyCopilotTelegramProvider {
  readonly calls: Array<{
    card: ReplyCopilotTelegramCard;
    idempotencyKey: string;
    providerMessageRef: string;
  }> = [];
  private readonly receipts = new Map<string, string>();

  async send(card: ReplyCopilotTelegramCard, idempotencyKey: string) {
    const existing = this.receipts.get(idempotencyKey);
    if (existing) return { outcome: 'sent' as const, providerMessageRef: existing };
    const providerMessageRef = `telegram:${this.calls.length + 1}`;
    this.receipts.set(idempotencyKey, providerMessageRef);
    this.calls.push({ card, idempotencyKey, providerMessageRef });
    return { outcome: 'sent' as const, providerMessageRef };
  }

  async reconcile(_card: ReplyCopilotTelegramCard, idempotencyKey: string) {
    const providerMessageRef = this.receipts.get(idempotencyKey);
    return providerMessageRef
      ? { outcome: 'sent' as const, providerMessageRef }
      : { outcome: 'absent' as const };
  }
}

class SyntheticGhlProvider implements ReplyCopilotGhlProvider {
  readonly calls: ReplyCopilotGhlReply[] = [];
  readonly messages = new Map<string, ReplyCopilotProviderMessage>();
  unknownFirst = false;
  readbackThread: string | null = null;
  reconcileCalls = 0;

  async send(reply: ReplyCopilotGhlReply) {
    this.calls.push(reply);
    const message = this.message(reply);
    this.messages.set(reply.idempotencyKey, message);
    if (this.unknownFirst && this.calls.length === 1) {
      return { outcome: 'unknown' as const, errorCode: 'UNKNOWN_GHL_TIMEOUT' };
    }
    return { outcome: 'sent' as const, message };
  }

  async reconcile(reply: ReplyCopilotGhlReply) {
    this.reconcileCalls += 1;
    return this.messages.get(reply.idempotencyKey) ?? null;
  }

  async readMessage(messageId: string) {
    return [...this.messages.values()].find((entry) => entry.messageId === messageId) ?? null;
  }

  private message(reply: ReplyCopilotGhlReply): ReplyCopilotProviderMessage {
    return {
      messageId: `ghl_message_${this.calls.length}`,
      conversationId: reply.conversationId,
      threadId: this.readbackThread ?? reply.threadId,
      emailMessageId: `ghl_email_${this.calls.length}`,
      direction: 'outbound',
      body: reply.message,
    };
  }
}

function inbound(change: Partial<NormalizedGhlInboundEmail> = {}): NormalizedGhlInboundEmail {
  return {
    eventKey: 'event_seed',
    ingressKind: 'oauth_ed25519',
    locationId: 'pBSnOK2nkdxp6gf9Rg3o',
    contactId: 'contact_seed',
    conversationId: 'conversation_seed',
    messageId: 'message_seed',
    emailMessageId: 'email_seed',
    threadId: 'thread_seed',
    direction: 'inbound',
    channel: 'email',
    senderDisplayName: 'Shloimie Dratler',
    from: 'Shloimie Dratler <sdratler@gmail.com>',
    to: 'info@onetimeonetime.com',
    subject: 'How does color coding help with Mishnah?',
    body: 'Can you explain how the color coding and review quiz help the boys remember Mishnah?',
    attachmentMetadata: [],
    receivedAt: '2026-08-03T17:00:00.000Z',
    ...change,
  };
}

function button(card: ReplyCopilotTelegramCard, label: string) {
  const found = card.buttons.flat().find((entry) => entry.label === label);
  if (!found || !('callbackData' in found)) throw new Error(`button not found: ${label}`);
  return found.callbackData;
}

function at(seconds: number) {
  return new Date(Date.parse('2026-08-03T17:00:00.000Z') + seconds * 1000);
}

function ids() {
  let value = 0;
  return () => `action${String(++value).padStart(6, '0')}`;
}
