import { createHash } from 'node:crypto';
import type {
  RabbiConversationProvider,
  RabbiProviderReply,
} from '../../../contracts/src/telegram/rabbi-communications.ts';
import { HighLevelHttpClient } from '../highlevel/http-client.ts';

export class DisabledRabbiConversationProvider implements RabbiConversationProvider {
  readonly mode = 'disabled' as const;

  async sendReply(_input: RabbiProviderReply): Promise<never> {
    throw new Error('RABBI_GHL_PROVIDER_OFF');
  }
}

export class SyntheticRabbiConversationProvider implements RabbiConversationProvider {
  readonly mode = 'synthetic' as const;
  readonly calls: RabbiProviderReply[] = [];
  private readonly receipts = new Map<
    string,
    { providerMessageRef: string; conversationRef: string }
  >();

  async sendReply(input: RabbiProviderReply) {
    const existing = this.receipts.get(input.idempotencyKey);
    if (existing) return existing;
    const receipt = {
      providerMessageRef: `synthetic_message_${digest(input.idempotencyKey).slice(0, 20)}`,
      conversationRef: input.conversationRef,
    };
    this.calls.push({ ...input });
    this.receipts.set(input.idempotencyKey, receipt);
    return receipt;
  }

  readback(conversationRef: string) {
    return this.calls.filter((call) => call.conversationRef === conversationRef);
  }
}

export class HighLevelRabbiConversationProvider implements RabbiConversationProvider {
  readonly mode = 'provider' as const;

  constructor(
    private readonly client: HighLevelHttpClient,
    private readonly locationId: string,
    private readonly transportAuthorized: boolean,
  ) {}

  async sendReply(input: RabbiProviderReply) {
    if (!this.transportAuthorized) throw new Error('RABBI_GHL_TRANSPORT_UNAUTHORIZED');
    const response = await this.client.request('/conversations/messages', input.idempotencyKey, {
      method: 'POST',
      body: JSON.stringify({
        type: providerMessageType(input.channel),
        conversationId: input.conversationRef,
        locationId: this.locationId,
        message: input.body,
      }),
    });
    const record = objectRecord(response);
    const message = objectRecord(record.message ?? response);
    const providerMessageRef = requiredString(message.id, 'RABBI_GHL_MESSAGE_ID_MISSING');
    const conversationRef = requiredString(
      message.conversationId ?? record.conversationId,
      'RABBI_GHL_CONVERSATION_ID_MISSING',
    );
    if (conversationRef !== input.conversationRef) {
      throw new Error('RABBI_GHL_CONVERSATION_MISMATCH');
    }
    return { providerMessageRef, conversationRef };
  }
}

function providerMessageType(channel: RabbiProviderReply['channel']) {
  if (channel === 'email') return 'Email';
  if (channel === 'sms') return 'SMS';
  return 'WhatsApp';
}

function objectRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object') throw new Error('RABBI_GHL_RESPONSE_INVALID');
  return value as Record<string, unknown>;
}

function requiredString(value: unknown, code: string) {
  if (typeof value !== 'string' || value.length === 0) throw new Error(code);
  return value;
}

function digest(value: string) {
  return createHash('sha256').update(value).digest('hex');
}
