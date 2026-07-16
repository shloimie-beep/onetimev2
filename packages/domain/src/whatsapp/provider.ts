import { randomUUID } from 'node:crypto';
import type {
  WhatsAppProviderAdapter,
  WhatsAppProviderDeliveryStatus,
  WhatsAppProviderWebhookEvent,
  WhatsAppProviderWebhookParseResult,
  WhatsAppProviderSendReceipt,
  WhatsAppProviderSendRequest,
} from '../../../contracts/src/index.ts';
import { normalizeWhatsAppE164, verifyHmacSha256 } from './crypto.ts';

export class MetaWhatsAppCloudAdapter implements WhatsAppProviderAdapter {
  verifyWebhook(input: {
    rawBody: Buffer;
    signatureHeader?: string | undefined;
    secret?: string | undefined;
  }) {
    return verifyHmacSha256(input);
  }

  parseWebhook(input: {
    rawBody: Buffer;
    providerAccountKey: string;
  }): WhatsAppProviderWebhookParseResult {
    const payload = JSON.parse(input.rawBody.toString('utf8')) as MetaWebhookPayload;
    const events: WhatsAppProviderWebhookEvent[] = [];

    for (const entry of payload.entry ?? []) {
      for (const change of entry.changes ?? []) {
        const value = change.value;
        for (const message of value?.messages ?? []) {
          if (message.type !== 'text' || !message.text?.body) continue;
          events.push({
            kind: 'message',
            providerMessageId: String(message.id),
            senderE164: normalizeWhatsAppE164(String(message.from)),
            text: String(message.text.body).slice(0, 4096),
            ...(message.timestamp ? { timestamp: new Date(Number(message.timestamp) * 1000) } : {}),
          });
        }
        for (const status of value?.statuses ?? []) {
          const normalized = normalizeStatus(String(status.status));
          if (!normalized) continue;
          events.push({
            kind: 'status',
            providerMessageId: String(status.id),
            status: normalized,
            ...(status.recipient_id
              ? { recipientE164: normalizeWhatsAppE164(String(status.recipient_id)) }
              : {}),
            ...(status.timestamp ? { timestamp: new Date(Number(status.timestamp) * 1000) } : {}),
            ...(status.errors?.[0]?.code ? { failureCode: `meta_${status.errors[0].code}` } : {}),
          });
        }
      }
    }

    return { providerAccountKey: input.providerAccountKey, events };
  }

  async sendMessage(_input: WhatsAppProviderSendRequest): Promise<WhatsAppProviderSendReceipt> {
    throw new Error('meta_whatsapp_send_not_configured_for_ot85');
  }
}

export class SinkWhatsAppProviderAdapter implements WhatsAppProviderAdapter {
  verifyWebhook() {
    return true;
  }

  parseWebhook(input: {
    rawBody: Buffer;
    providerAccountKey: string;
  }): WhatsAppProviderWebhookParseResult {
    const payload = JSON.parse(input.rawBody.toString('utf8')) as {
      messages?: Array<{ id: string; from: string; text: string; timestamp?: string }>;
      statuses?: Array<{
        id: string;
        recipient?: string;
        status: WhatsAppProviderDeliveryStatus;
        timestamp?: string;
      }>;
    };
    return {
      providerAccountKey: input.providerAccountKey,
      events: [
        ...(payload.messages ?? []).map((message) => ({
          kind: 'message' as const,
          providerMessageId: message.id,
          senderE164: normalizeWhatsAppE164(message.from),
          text: message.text,
          ...(message.timestamp ? { timestamp: new Date(message.timestamp) } : {}),
        })),
        ...(payload.statuses ?? []).map((status) => ({
          kind: 'status' as const,
          providerMessageId: status.id,
          status: status.status,
          ...(status.recipient ? { recipientE164: normalizeWhatsAppE164(status.recipient) } : {}),
          ...(status.timestamp ? { timestamp: new Date(status.timestamp) } : {}),
        })),
      ],
    };
  }

  async sendMessage(_input: WhatsAppProviderSendRequest): Promise<WhatsAppProviderSendReceipt> {
    return {
      provider: 'sink',
      providerMessageId: `sink_${randomUUID()}`,
      acceptedAt: new Date(),
      sink: true,
    };
  }
}

type MetaWebhookPayload = {
  entry?: Array<{
    changes?: Array<{
      value?: {
        metadata?: {
          display_phone_number?: string;
          phone_number_id?: string;
        };
        messages?: Array<{
          id: string;
          from: string;
          timestamp?: string;
          type?: string;
          text?: { body?: string };
        }>;
        statuses?: Array<{
          id: string;
          recipient_id?: string;
          status?: string;
          timestamp?: string;
          errors?: Array<{ code?: string | number }>;
        }>;
      };
    }>;
  }>;
};

function normalizeStatus(value: string): WhatsAppProviderDeliveryStatus | null {
  if (value === 'sent') return 'sent';
  if (value === 'delivered') return 'delivered';
  if (value === 'read') return 'read';
  if (value === 'failed') return 'failed';
  return null;
}
