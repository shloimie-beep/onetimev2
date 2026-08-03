import type {
  ReplyCopilotButton,
  ReplyCopilotGhlProvider,
  ReplyCopilotGhlReply,
  ReplyCopilotProviderMessage,
  ReplyCopilotTelegramCard,
  ReplyCopilotTelegramProvider,
} from '../../../../contracts/src/telegram/reply-copilot.ts';

export class TelegramBotApiReplyCopilotProvider implements ReplyCopilotTelegramProvider {
  private readonly receipts = new Map<string, string>();
  private readonly fetchImpl: typeof fetch;

  constructor(
    private readonly options: {
      botToken: string;
      chatIdsByRef: ReadonlyMap<string, string>;
      timeoutMs?: number;
      fetchImpl?: typeof fetch;
    },
  ) {
    if (!/^\d{6,}:[A-Za-z0-9_-]{20,}$/.test(options.botToken)) {
      throw new Error('REPLY_COPILOT_DISTINCT_TELEGRAM_TOKEN_INVALID');
    }
    this.fetchImpl = options.fetchImpl ?? fetch;
  }

  async send(card: ReplyCopilotTelegramCard, idempotencyKey: string) {
    const existing = this.receipts.get(idempotencyKey);
    if (existing) return { outcome: 'sent' as const, providerMessageRef: existing };
    const chatId = this.options.chatIdsByRef.get(card.chatRef);
    if (!chatId || !/^-?\d{5,32}$/.test(chatId)) {
      return { outcome: 'retry' as const, errorCode: 'TELEGRAM_CHAT_NOT_ALLOWLISTED' };
    }
    try {
      const response = await this.fetchImpl(
        `https://api.telegram.org/bot${this.options.botToken}/sendMessage`,
        {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          signal: AbortSignal.timeout(this.options.timeoutMs ?? 8_000),
          body: JSON.stringify({
            chat_id: chatId,
            text: card.text,
            disable_web_page_preview: true,
            reply_markup: { inline_keyboard: card.buttons.map(buttonRow) },
          }),
        },
      );
      if (!response.ok) {
        return { outcome: 'retry' as const, errorCode: `TELEGRAM_HTTP_${response.status}` };
      }
      const body = (await response.json()) as unknown;
      const messageId = telegramMessageId(body);
      const providerMessageRef = `telegram:${messageId}`;
      this.receipts.set(idempotencyKey, providerMessageRef);
      return { outcome: 'sent' as const, providerMessageRef };
    } catch (error) {
      return { outcome: 'unknown' as const, errorCode: networkError('TELEGRAM', error) };
    }
  }

  async reconcile(_card: ReplyCopilotTelegramCard, idempotencyKey: string) {
    const providerMessageRef = this.receipts.get(idempotencyKey);
    if (providerMessageRef) return { outcome: 'sent' as const, providerMessageRef };
    return { outcome: 'unknown' as const };
  }
}

export class HighLevelReplyCopilotProvider implements ReplyCopilotGhlProvider {
  private readonly fetchImpl: typeof fetch;

  constructor(
    private readonly options: {
      apiBaseUrl: string;
      apiVersion: string;
      token: string;
      allowedLocationId: string;
      timeoutMs?: number;
      fetchImpl?: typeof fetch;
    },
  ) {
    if (!options.token) throw new Error('REPLY_COPILOT_GHL_TOKEN_UNCONFIGURED');
    this.fetchImpl = options.fetchImpl ?? fetch;
  }

  async send(reply: ReplyCopilotGhlReply) {
    if (reply.locationId !== this.options.allowedLocationId) {
      return { outcome: 'retry' as const, errorCode: 'GHL_LOCATION_DENIED' };
    }
    try {
      const response = await this.request('/conversations/messages', {
        method: 'POST',
        headers: { 'Idempotency-Key': reply.idempotencyKey },
        body: JSON.stringify({
          type: reply.type,
          status: reply.status,
          contactId: reply.contactId,
          conversationId: reply.conversationId,
          message: reply.message,
          subject: reply.subject,
          replyMessageId: reply.replyMessageId,
          threadId: reply.threadId,
          emailFrom: reply.emailFrom,
          emailTo: reply.emailTo,
          emailReplyMode: reply.emailReplyMode,
        }),
      });
      if (!response.ok) {
        return { outcome: 'retry' as const, errorCode: `GHL_HTTP_${response.status}` };
      }
      const body = (await response.json()) as unknown;
      const record = objectRecord(body);
      const messageId = requiredProviderText(record.messageId, 'GHL_MESSAGE_ID_MISSING');
      const conversationId = requiredProviderText(
        record.conversationId,
        'GHL_CONVERSATION_ID_MISSING',
      );
      return {
        outcome: 'sent' as const,
        message: {
          messageId,
          conversationId,
          threadId: reply.threadId,
          emailMessageId:
            optionalProviderText(record.emailMessageId) ??
            requiredProviderText(record.messageId, 'GHL_EMAIL_MESSAGE_ID_MISSING'),
          direction: 'outbound' as const,
          body: reply.message,
        },
      };
    } catch (error) {
      return { outcome: 'unknown' as const, errorCode: networkError('GHL', error) };
    }
  }

  async reconcile(reply: ReplyCopilotGhlReply) {
    try {
      const response = await this.request(
        `/conversations/${encodeURIComponent(reply.conversationId)}/messages`,
        { method: 'GET' },
      );
      if (!response.ok) throw new Error(`GHL_RECONCILE_HTTP_${response.status}`);
      const body = objectRecord((await response.json()) as unknown);
      const candidates = messageArray(body);
      for (const candidate of candidates) {
        const normalized = normalizeProviderMessage(candidate);
        if (
          normalized &&
          normalized.direction === 'outbound' &&
          normalized.conversationId === reply.conversationId &&
          normalized.threadId === reply.threadId &&
          normalized.body.trim() === reply.message.trim()
        ) {
          return normalized;
        }
      }
      return null;
    } catch {
      return null;
    }
  }

  async readMessage(messageId: string) {
    try {
      const response = await this.request(
        `/conversations/messages/${encodeURIComponent(messageId)}`,
        {
          method: 'GET',
        },
      );
      if (!response.ok) return null;
      const body = objectRecord((await response.json()) as unknown);
      const normalized = normalizeProviderMessage(isRecord(body.message) ? body.message : body);
      if (!normalized) return null;
      if (normalized.threadId) return normalized;
      const emailResponse = await this.request(
        `/conversations/messages/email/${encodeURIComponent(normalized.emailMessageId)}`,
        { method: 'GET' },
      );
      if (!emailResponse.ok) return null;
      const emailBody = objectRecord((await emailResponse.json()) as unknown);
      return normalizeProviderMessage(isRecord(emailBody.message) ? emailBody.message : emailBody);
    } catch {
      return null;
    }
  }

  private request(path: string, init: RequestInit) {
    return this.fetchImpl(new URL(path, this.options.apiBaseUrl), {
      ...init,
      signal: AbortSignal.timeout(this.options.timeoutMs ?? 8_000),
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${this.options.token}`,
        'Content-Type': 'application/json',
        Version: this.options.apiVersion,
        ...init.headers,
      },
    });
  }
}

function buttonRow(row: readonly ReplyCopilotButton[]) {
  return row.map((button) =>
    'url' in button
      ? { text: button.label, url: button.url }
      : { text: button.label, callback_data: button.callbackData },
  );
}

function telegramMessageId(value: unknown) {
  const root = objectRecord(value);
  const result = objectRecord(root.result);
  const messageId = result.message_id;
  if (typeof messageId !== 'number' || !Number.isSafeInteger(messageId)) {
    throw new Error('TELEGRAM_MESSAGE_ID_MISSING');
  }
  return String(messageId);
}

function messageArray(root: Record<string, unknown>) {
  const direct = root.messages;
  if (Array.isArray(direct)) return direct;
  if (isRecord(root.data) && Array.isArray(root.data.messages)) return root.data.messages;
  return [];
}

function normalizeProviderMessage(value: unknown): ReplyCopilotProviderMessage | null {
  if (!isRecord(value)) return null;
  const messageId = optionalProviderText(value.id ?? value.messageId);
  const conversationId = optionalProviderText(value.conversationId);
  const emailMessageId = optionalProviderText(value.emailMessageId ?? value.id);
  const threadId = optionalProviderText(value.threadId);
  const body = optionalProviderText(value.body ?? value.message ?? value.plainText);
  const directionValue = optionalProviderText(value.direction)?.toLowerCase();
  if (!messageId || !conversationId || !emailMessageId || !threadId || !body) return null;
  if (directionValue && directionValue !== 'outbound') return null;
  return {
    messageId,
    conversationId,
    threadId,
    emailMessageId,
    direction: 'outbound',
    body,
  };
}

function objectRecord(value: unknown) {
  if (!isRecord(value)) throw new Error('PROVIDER_RESPONSE_INVALID');
  return value;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function requiredProviderText(value: unknown, code: string) {
  const normalized = optionalProviderText(value);
  if (!normalized) throw new Error(code);
  return normalized;
}

function optionalProviderText(value: unknown) {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

function networkError(prefix: string, error: unknown) {
  const name = error instanceof Error ? error.name : 'UNKNOWN';
  return `UNKNOWN_${prefix}_${name.replace(/[^A-Z0-9_]/gi, '_').toUpperCase()}`;
}
