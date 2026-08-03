import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import type {
  ReplyCopilotGhlReply,
  ReplyCopilotTelegramCard,
} from '../../../../packages/contracts/src/telegram/reply-copilot.ts';
import {
  HighLevelReplyCopilotProvider,
  TelegramBotApiReplyCopilotProvider,
} from '../../../../packages/domain/src/telegram/reply-copilot/providers.ts';
import {
  readReplyCopilotRuntimeConfig,
  replyCopilotReadiness,
} from '../../../../apps/telegram-bot/src/reply-copilot/config.ts';

describe('OT-LIVE-003 provider and runtime boundaries', () => {
  it('defaults every loop/delivery flag off and ignores generic or BNA Telegram tokens', () => {
    const config = readReplyCopilotRuntimeConfig({
      TELEGRAM_BOT_TOKEN: '999999:generic_token_that_must_never_be_used',
      BNA_TELEGRAM_BOT_TOKEN: '999999:bna_token_that_must_never_be_used',
    });
    expect(config).toMatchObject({
      enabled: false,
      workflowIngressEnabled: false,
      oauthIngressEnabled: false,
      telegramDeliveryEnabled: false,
      ghlDeliveryEnabled: false,
    });
    expect(config.telegramBotToken).toBeUndefined();
    expect(replyCopilotReadiness(config)).toMatchObject({
      ready: false,
      status: 'provider_off',
      customerDeliveryAuthorized: false,
      tokenPresence: 'absent',
    });
  });

  it('reports only presence for the distinct token and mapped private chats', () => {
    const config = readReplyCopilotRuntimeConfig({
      ONE_TIME_REPLY_COPILOT_ENABLED: 'true',
      ONE_TIME_REPLY_COPILOT_TELEGRAM_DELIVERY_ENABLED: 'true',
      ONE_TIME_REPLY_COPILOT_GHL_DELIVERY_ENABLED: 'true',
      ONE_TIME_REPLY_COPILOT_PAYLOAD_KEY: 'p'.repeat(32),
      ONE_TIME_REPLY_COPILOT_ACTION_SIGNING_SECRET: 'a'.repeat(32),
      ONE_TIME_RABBI_TELEGRAM_BOT_TOKEN: '999999:distinct_token_value_long_enough',
      ONE_TIME_RABBI_TELEGRAM_WEBHOOK_SECRET: 'w'.repeat(32),
      ONE_TIME_RABBI_TELEGRAM_CHAT_ID: '123456789',
      ONE_TIME_RABBI_TELEGRAM_USER_ID: '123456789',
      ONE_TIME_SHLOIMIE_TELEGRAM_CHAT_ID: '223456789',
      ONE_TIME_SHLOIMIE_TELEGRAM_USER_ID: '223456789',
      ONE_TIME_REPLY_COPILOT_GHL_TOKEN: 'configured-protected-token',
    });
    expect(replyCopilotReadiness(config)).toMatchObject({
      ready: true,
      customerDeliveryAuthorized: true,
      tokenPresence: 'present',
      rabbiMappingPresence: 'present',
      shloimieMappingPresence: 'present',
      blockers: [],
    });
  });

  it('sends the current HighLevel same-thread email request contract', async () => {
    const calls: Array<{ url: string; init: RequestInit }> = [];
    const fetchImpl = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
      calls.push({ url: String(url), init: init ?? {} });
      if (String(url).endsWith('/conversations/messages') && init?.method === 'POST') {
        return Response.json({
          conversationId: 'conversation_1',
          emailMessageId: 'outbound_email_1',
          messageId: 'outbound_message_1',
        });
      }
      return Response.json({
        id: 'outbound_message_1',
        conversationId: 'conversation_1',
        emailMessageId: 'outbound_email_1',
        threadId: 'thread_1',
        direction: 'outbound',
        body: 'Approved reply',
      });
    });
    const provider = new HighLevelReplyCopilotProvider({
      apiBaseUrl: 'https://services.leadconnectorhq.com',
      apiVersion: '2021-07-28',
      token: 'protected-token',
      allowedLocationId: 'pBSnOK2nkdxp6gf9Rg3o',
      fetchImpl: fetchImpl as typeof fetch,
    });
    const sent = await provider.send(reply());
    expect(sent.outcome).toBe('sent');
    expect(JSON.parse(String(calls[0]!.init.body))).toEqual({
      type: 'Email',
      status: 'pending',
      contactId: 'contact_1',
      conversationId: 'conversation_1',
      message: 'Approved reply',
      subject: 'Re: Question',
      replyMessageId: 'source_email_1',
      threadId: 'thread_1',
      emailFrom: 'info@onetimeonetime.com',
      emailTo: 'parent@example.test',
      emailReplyMode: 'reply',
    });
    const requestHeaders = new Headers(calls[0]!.init.headers);
    expect(requestHeaders.get('Version')).toBe('2021-07-28');
    expect(requestHeaders.get('Idempotency-Key')).toBe('ot3:intent:v1');
    expect(await provider.readMessage('outbound_message_1')).toMatchObject({
      messageId: 'outbound_message_1',
      conversationId: 'conversation_1',
      threadId: 'thread_1',
      direction: 'outbound',
      body: 'Approved reply',
    });
  });

  it('uses the email-message readback endpoint when the generic message omits thread identity', async () => {
    const calls: string[] = [];
    const fetchImpl = vi.fn(async (url: string | URL | Request) => {
      calls.push(String(url));
      if (String(url).endsWith('/conversations/messages/outbound_message_1')) {
        return Response.json({
          id: 'outbound_message_1',
          conversationId: 'conversation_1',
          emailMessageId: 'outbound_email_1',
          direction: 'outbound',
          body: 'Approved reply',
        });
      }
      return Response.json({
        id: 'outbound_message_1',
        conversationId: 'conversation_1',
        emailMessageId: 'outbound_email_1',
        threadId: 'thread_1',
        direction: 'outbound',
        body: 'Approved reply',
      });
    });
    const provider = new HighLevelReplyCopilotProvider({
      apiBaseUrl: 'https://services.leadconnectorhq.com',
      apiVersion: '2021-07-28',
      token: 'protected-token',
      allowedLocationId: 'pBSnOK2nkdxp6gf9Rg3o',
      fetchImpl: fetchImpl as typeof fetch,
    });

    expect(await provider.readMessage('outbound_message_1')).toMatchObject({
      conversationId: 'conversation_1',
      threadId: 'thread_1',
    });
    expect(calls).toHaveLength(2);
    expect(calls[1]).toMatch(/\/conversations\/messages\/email\/outbound_email_1$/);
  });

  it('uses only allowlisted chat refs and keeps unknown Telegram results non-duplicating', async () => {
    const fetchImpl = vi
      .fn()
      .mockRejectedValueOnce(new DOMException('timeout', 'TimeoutError'))
      .mockResolvedValueOnce(Response.json({ ok: true, result: { message_id: 42 } }));
    const provider = new TelegramBotApiReplyCopilotProvider({
      botToken: '999999:distinct_token_value_long_enough',
      chatIdsByRef: new Map([['chat-rabbi', '123456789']]),
      fetchImpl: fetchImpl as typeof fetch,
    });
    expect(await provider.send(card(), 'one')).toMatchObject({ outcome: 'unknown' });
    expect(await provider.reconcile(card(), 'one')).toEqual({ outcome: 'unknown' });
    expect(await provider.send(card(), 'one')).toEqual({
      outcome: 'sent',
      providerMessageRef: 'telegram:42',
    });
    expect(await provider.send(card(), 'one')).toEqual({
      outcome: 'sent',
      providerMessageRef: 'telegram:42',
    });
    expect(fetchImpl).toHaveBeenCalledTimes(2);
    expect(await provider.send({ ...card(), chatRef: 'chat-other' }, 'two')).toMatchObject({
      outcome: 'retry',
      errorCode: 'TELEGRAM_CHAT_NOT_ALLOWLISTED',
    });
  });

  it('contains no Telegram polling loop and does not couple signup to the copilot', () => {
    const files = [
      'apps/telegram-bot/src/reply-copilot/config.ts',
      'apps/telegram-bot/src/reply-copilot/http.ts',
      'packages/domain/src/telegram/reply-copilot/providers.ts',
      'packages/domain/src/telegram/reply-copilot/service.ts',
    ];
    const source = files.map((file) => readFileSync(file, 'utf8')).join('\n');
    expect(source).not.toMatch(/getUpdates|setWebhook|polling/i);
    const signupSource = [
      'packages/domain/src/signup/family/index.ts',
      'packages/domain/src/signup/family/policy.ts',
    ]
      .map((file) => readFileSync(file, 'utf8'))
      .join('\n');
    expect(signupSource).not.toMatch(/reply-copilot|telegram/i);
  });
});

function reply(): ReplyCopilotGhlReply {
  return {
    locationId: 'pBSnOK2nkdxp6gf9Rg3o',
    contactId: 'contact_1',
    conversationId: 'conversation_1',
    type: 'Email',
    status: 'pending',
    message: 'Approved reply',
    subject: 'Re: Question',
    replyMessageId: 'source_email_1',
    threadId: 'thread_1',
    emailFrom: 'info@onetimeonetime.com',
    emailTo: 'parent@example.test',
    emailReplyMode: 'reply',
    idempotencyKey: 'ot3:intent:v1',
    approvedAt: '2026-08-03T17:00:00.000Z',
  };
}

function card(): ReplyCopilotTelegramCard {
  return {
    intentKey: 'intent_1',
    chatRef: 'chat-rabbi',
    text: '[RABBI]\nSuggested reply',
    buttons: [[{ label: 'Dismiss', callbackData: 'ot3.action000001.di.1.abcdefghijkl' }]],
    kind: 'inbound_card',
  };
}
