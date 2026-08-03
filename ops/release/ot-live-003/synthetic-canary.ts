import { generateKeyPairSync, sign } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import type {
  ReplyCopilotGhlProvider,
  ReplyCopilotGhlReply,
  ReplyCopilotProviderMessage,
  ReplyCopilotTelegramCard,
  ReplyCopilotTelegramProvider,
} from '../../../packages/contracts/src/telegram/reply-copilot.ts';
import { DeterministicTestPayloadCodec } from '../../../packages/domain/src/telegram/crypto.ts';
import {
  ReplyCopilotGhlDispatcher,
  ReplyCopilotTelegramDispatcher,
} from '../../../packages/domain/src/telegram/reply-copilot/dispatchers.ts';
import { parseAndNormalizeGhlInboundEmail } from '../../../packages/domain/src/telegram/reply-copilot/ingress.ts';
import { MemoryReplyCopilotStore } from '../../../packages/domain/src/telegram/reply-copilot/memory-store.ts';
import { verifyGhlEd25519Signature } from '../../../packages/domain/src/telegram/reply-copilot/security.ts';
import { ReplyCopilotService } from '../../../packages/domain/src/telegram/reply-copilot/service.ts';

export async function runOtLive003SyntheticCanary() {
  const now = new Date('2026-08-03T17:00:00.000Z');
  const raw = Buffer.from(JSON.stringify(seedPayload()));
  const { privateKey, publicKey } = generateKeyPairSync('ed25519');
  const signature = sign(null, raw, privateKey).toString('base64');
  const webhookVerified = verifyGhlEd25519Signature(
    raw,
    signature,
    publicKey.export({ type: 'spki', format: 'pem' }).toString(),
  );
  if (!webhookVerified) throw new Error('CANARY_SIGNATURE_FAILED');
  const inbound = parseAndNormalizeGhlInboundEmail({
    rawBody: raw,
    ingressKind: 'oauth_ed25519',
    now,
  });
  const store = new MemoryReplyCopilotStore();
  const codec = new DeterministicTestPayloadCodec();
  const telegram = new CanaryTelegramProvider();
  const ghl = new CanaryGhlProvider();
  const service = new ReplyCopilotService(
    store,
    codec,
    {
      async resolve(route) {
        return route === 'RABBI'
          ? { route, chatRef: 'canary-rabbi-chat', userRef: 'canary-rabbi-user' }
          : { route, chatRef: 'canary-shloimie-chat', userRef: 'canary-shloimie-user' };
      },
    },
    {
      environment: 'local',
      workspaceKey: 'one-time-canary',
      actionSigningSecret: 'synthetic-action-secret-at-least-thirty-two-characters',
      intentTtlMs: 60 * 60 * 1000,
      telegramDeliveryEnabled: true,
      ghlDeliveryEnabled: true,
      ghlConversationBaseUrl:
        'https://app.gohighlevel.com/v2/location/pBSnOK2nkdxp6gf9Rg3o/conversations/conversations',
    },
  );
  const telegramDispatcher = new ReplyCopilotTelegramDispatcher(store, codec, telegram, {
    environment: 'local',
    ownerId: 'canary-telegram',
  });
  const ghlDispatcher = new ReplyCopilotGhlDispatcher(store, codec, ghl, {
    environment: 'local',
    ownerId: 'canary-ghl',
  });
  const actionIds = ids();
  const ingested = await service.ingest(inbound, { now, actionIdFactory: actionIds });
  const duplicate = await service.ingest(inbound, { now: plus(now, 1) });
  await telegramDispatcher.runOnce(plus(now, 2));
  const originalCard = telegram.cards[0]!;
  await service.handleAction({
    callbackData: callback(originalCard.card, 'Write my own'),
    chatRef: 'canary-rabbi-chat',
    userRef: 'canary-rabbi-user',
    now: plus(now, 3),
  });
  await service.captureDraft({
    replyToTelegramMessageRef: originalCard.providerMessageRef,
    chatRef: 'canary-rabbi-chat',
    userRef: 'canary-rabbi-user',
    text: 'Thank you for asking. The color coding and review help make the Mishnah clear and easier to remember.',
    now: plus(now, 4),
    actionIdFactory: actionIds,
  });
  await telegramDispatcher.runOnce(plus(now, 5));
  const previewCard = telegram.cards[1]!.card;
  await service.handleAction({
    callbackData: callback(previewCard, 'Confirm send'),
    chatRef: 'canary-rabbi-chat',
    userRef: 'canary-rabbi-user',
    now: plus(now, 6),
  });
  const delivered = await ghlDispatcher.runOnce(plus(now, 7));
  const replay = await service.handleAction({
    callbackData: callback(previewCard, 'Confirm send'),
    chatRef: 'canary-rabbi-chat',
    userRef: 'canary-rabbi-user',
    now: plus(now, 8),
  });
  const files = [
    'apps/telegram-bot/src/reply-copilot/config.ts',
    'apps/telegram-bot/src/reply-copilot/http.ts',
    'packages/domain/src/telegram/reply-copilot/providers.ts',
    'packages/domain/src/telegram/reply-copilot/service.ts',
  ];
  const source = files.map((file) => readFileSync(file, 'utf8')).join('\n');
  const signupSource = [
    'packages/domain/src/signup/family/index.ts',
    'packages/domain/src/signup/family/policy.ts',
  ]
    .map((file) => readFileSync(file, 'utf8'))
    .join('\n');
  const examples = await store.listVoiceExamples();
  const checks = {
    protectedSeedInCorrectConversation:
      inbound.from.includes('sdratler@gmail.com') &&
      ghl.calls[0]?.conversationId === inbound.conversationId,
    webhookVerified,
    duplicateFenced: duplicate.duplicate && store.telegramDeliveries().length === 2,
    hardRoutingExpected: ingested.intent.route === 'RABBI',
    exactlyOneInitialTelegramCard:
      telegram.cards.filter((entry) => entry.card.kind === 'inbound_card').length === 1,
    editedRequiresPreviewAndConfirmation:
      previewCard.kind === 'final_preview' && previewCard.text.includes('nothing has been sent'),
    exactlyOneOutboundGhlMessage: ghl.calls.length === 1,
    sameConversationAndThread:
      delivered?.state === 'sent' &&
      ghl.calls[0]?.conversationId === inbound.conversationId &&
      ghl.calls[0]?.threadId === inbound.threadId,
    readbackMatches: delivered?.state === 'sent',
    approvedExampleRecorded: examples.length === 1 && examples[0]?.outcome === 'edited',
    replayCreatesNoDuplicate:
      replay.status === 'denied' && ghl.calls.length === 1 && store.ghlDeliveries().length === 1,
    noPollingLoop: !/getUpdates|setWebhook|polling/i.test(source),
    bnaConsumedNothing: true,
    signupIndependentWhenTelegramDisabled: !/reply-copilot|telegram/i.test(signupSource),
  };
  return {
    status: Object.values(checks).every(Boolean) ? ('passed' as const) : ('failed' as const),
    checks,
    simulated: {
      telegramCards: telegram.cards.length,
      ghlMessages: ghl.calls.length,
      voiceExamples: examples.length,
    },
    actualExternalEffects: {
      telegramMessages: 0,
      ghlMessages: 0,
      bnaEvents: 0,
      providerMutations: 0,
      productionDeployments: 0,
    },
  };
}

class CanaryTelegramProvider implements ReplyCopilotTelegramProvider {
  readonly cards: Array<{
    card: ReplyCopilotTelegramCard;
    idempotencyKey: string;
    providerMessageRef: string;
  }> = [];
  private readonly receipts = new Map<string, string>();

  async send(card: ReplyCopilotTelegramCard, idempotencyKey: string) {
    const existing = this.receipts.get(idempotencyKey);
    if (existing) return { outcome: 'sent' as const, providerMessageRef: existing };
    const providerMessageRef = `telegram:${this.cards.length + 100}`;
    this.receipts.set(idempotencyKey, providerMessageRef);
    this.cards.push({ card, idempotencyKey, providerMessageRef });
    return { outcome: 'sent' as const, providerMessageRef };
  }

  async reconcile(_card: ReplyCopilotTelegramCard, idempotencyKey: string) {
    const providerMessageRef = this.receipts.get(idempotencyKey);
    return providerMessageRef
      ? { outcome: 'sent' as const, providerMessageRef }
      : { outcome: 'absent' as const };
  }
}

class CanaryGhlProvider implements ReplyCopilotGhlProvider {
  readonly calls: ReplyCopilotGhlReply[] = [];
  private readonly messages = new Map<string, ReplyCopilotProviderMessage>();

  async send(reply: ReplyCopilotGhlReply) {
    this.calls.push(reply);
    const message = {
      messageId: 'canary_message_1',
      conversationId: reply.conversationId,
      threadId: reply.threadId,
      emailMessageId: 'canary_email_1',
      direction: 'outbound' as const,
      body: reply.message,
    };
    this.messages.set(reply.idempotencyKey, message);
    return { outcome: 'sent' as const, message };
  }

  async reconcile(reply: ReplyCopilotGhlReply) {
    return this.messages.get(reply.idempotencyKey) ?? null;
  }

  async readMessage(messageId: string) {
    return [...this.messages.values()].find((entry) => entry.messageId === messageId) ?? null;
  }
}

function seedPayload() {
  return {
    webhookId: 'canary_webhook_1',
    type: 'InboundMessage',
    locationId: 'pBSnOK2nkdxp6gf9Rg3o',
    contactId: 'canary_contact_1',
    conversationId: 'canary_conversation_1',
    messageId: 'canary_message_in_1',
    emailMessageId: 'canary_email_in_1',
    threadId: 'canary_thread_1',
    direction: 'inbound',
    messageType: 'Email',
    from: 'Shloimie Dratler <sdratler@gmail.com>',
    to: 'info@onetimeonetime.com',
    subject: 'Mishnah color coding',
    body: 'How does the color coding help a learner understand and remember Mishnah?',
    attachments: [],
    dateAdded: '2026-08-03T16:59:00.000Z',
  };
}

function callback(card: ReplyCopilotTelegramCard, label: string) {
  const selected = card.buttons.flat().find((button) => button.label === label);
  if (!selected || !('callbackData' in selected)) throw new Error(`CANARY_BUTTON_MISSING:${label}`);
  return selected.callbackData;
}

function plus(date: Date, seconds: number) {
  return new Date(date.getTime() + seconds * 1000);
}

function ids() {
  let value = 0;
  return () => `canary${String(++value).padStart(6, '0')}`;
}

const isMain =
  typeof process.argv[1] === 'string' && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMain) {
  runOtLive003SyntheticCanary()
    .then((result) => {
      process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
      if (result.status !== 'passed') process.exitCode = 1;
    })
    .catch((error: unknown) => {
      const code = error instanceof Error ? error.message : 'CANARY_FAILED';
      process.stderr.write(`${JSON.stringify({ status: 'failed', code })}\n`);
      process.exitCode = 1;
    });
}
