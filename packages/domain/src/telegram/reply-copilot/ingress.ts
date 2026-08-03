import type { ReplyCopilotIngressKind } from '../../../../contracts/src/telegram/reply-copilot.ts';
import type { NormalizedGhlInboundEmail } from '../../../../contracts/src/telegram/reply-copilot.ts';

export const REPLY_COPILOT_GHL_LOCATION_ID = 'pBSnOK2nkdxp6gf9Rg3o' as const;
export const REPLY_COPILOT_MAX_BODY_BYTES = 64 * 1024;
export const REPLY_COPILOT_MAX_MESSAGE_CHARS = 12_000;
export const REPLY_COPILOT_MAX_ATTACHMENTS = 8;

export class ReplyCopilotIngressError extends Error {
  constructor(
    readonly code: string,
    readonly status: number,
  ) {
    super(code);
  }
}

export async function readReplyCopilotRawBody(
  stream: AsyncIterable<unknown>,
  maxBytes = REPLY_COPILOT_MAX_BODY_BYTES,
) {
  const chunks: Buffer[] = [];
  let bytes = 0;
  for await (const chunk of stream) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk));
    bytes += buffer.byteLength;
    if (bytes > maxBytes) throw new ReplyCopilotIngressError('GHL_BODY_TOO_LARGE', 413);
    chunks.push(buffer);
  }
  return Buffer.concat(chunks);
}

export function parseAndNormalizeGhlInboundEmail(input: {
  rawBody: Uint8Array;
  ingressKind: ReplyCopilotIngressKind;
  allowedLocationId?: string;
  now?: Date;
}): NormalizedGhlInboundEmail {
  let parsed: unknown;
  try {
    parsed = JSON.parse(Buffer.from(input.rawBody).toString('utf8')) as unknown;
  } catch {
    throw new ReplyCopilotIngressError('GHL_JSON_INVALID', 400);
  }
  const root = record(parsed, 'GHL_PAYLOAD_INVALID');
  const payload = isRecord(root.data) ? { ...root, ...root.data } : root;
  const locationId = requiredText(payload.locationId, 64, 'GHL_LOCATION_MISSING');
  if (locationId !== (input.allowedLocationId ?? REPLY_COPILOT_GHL_LOCATION_ID)) {
    throw new ReplyCopilotIngressError('GHL_LOCATION_DENIED', 403);
  }

  const eventType = optionalText(payload.type ?? payload.eventType, 64) ?? 'CustomerReplied';
  if (!['InboundMessage', 'CustomerReplied', 'Customer Replied'].includes(eventType)) {
    throw new ReplyCopilotIngressError('GHL_EVENT_TYPE_DENIED', 422);
  }
  const direction = optionalText(payload.direction, 32)?.toLowerCase() ?? 'inbound';
  if (direction !== 'inbound') throw new ReplyCopilotIngressError('GHL_DIRECTION_DENIED', 422);
  const messageType = optionalText(
    payload.messageType ?? payload.channel ?? payload.messageTypeString,
    64,
  )?.toLowerCase();
  if (messageType !== 'email' && messageType !== 'type_email') {
    throw new ReplyCopilotIngressError('GHL_CHANNEL_DENIED', 422);
  }

  const emailMessageId = requiredText(
    payload.emailMessageId ?? payload.messageId,
    160,
    'GHL_EMAIL_MESSAGE_ID_MISSING',
  );
  const messageId = requiredText(
    payload.messageId ?? payload.emailMessageId,
    160,
    'GHL_MESSAGE_ID_MISSING',
  );
  const conversationId = requiredText(payload.conversationId, 160, 'GHL_CONVERSATION_ID_MISSING');
  const contactId = requiredText(payload.contactId, 160, 'GHL_CONTACT_ID_MISSING');
  const threadId = requiredText(
    payload.threadId ?? payload.emailMessageId,
    200,
    'GHL_THREAD_ID_MISSING',
  );
  const from = requiredText(payload.from ?? payload.emailFrom, 500, 'GHL_FROM_MISSING');
  const to = requiredText(payload.to ?? payload.emailTo, 500, 'GHL_TO_MISSING');
  const subject = optionalText(payload.subject, 500) ?? '(no subject)';
  const body = normalizeMessageBody(payload.plainText ?? payload.body);
  const receivedAt = normalizedDate(payload.dateAdded, input.now ?? new Date());
  const webhookId = optionalText(root.webhookId ?? root.id, 200);

  return {
    eventKey: webhookId ?? `ghl:${locationId}:${emailMessageId}`,
    ingressKind: input.ingressKind,
    locationId,
    contactId,
    conversationId,
    messageId,
    emailMessageId,
    threadId,
    direction: 'inbound',
    channel: 'email',
    senderDisplayName: senderDisplayName(from),
    from,
    to,
    subject,
    body,
    attachmentMetadata: normalizeAttachments(payload.attachments),
    receivedAt,
  };
}

function normalizeMessageBody(value: unknown) {
  const raw = requiredText(value, REPLY_COPILOT_MAX_MESSAGE_CHARS * 2, 'GHL_BODY_MISSING');
  const withoutTags = raw
    .replace(/<\s*br\s*\/?\s*>/gi, '\n')
    .replace(/<\s*\/p\s*>/gi, '\n')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
  if (withoutTags.length === 0 || withoutTags.length > REPLY_COPILOT_MAX_MESSAGE_CHARS) {
    throw new ReplyCopilotIngressError('GHL_BODY_BOUNDS_INVALID', 422);
  }
  return withoutTags;
}

function normalizeAttachments(value: unknown) {
  if (value === undefined || value === null) return [];
  if (!Array.isArray(value) || value.length > REPLY_COPILOT_MAX_ATTACHMENTS) {
    throw new ReplyCopilotIngressError('GHL_ATTACHMENTS_BOUNDS_INVALID', 422);
  }
  return value.map((entry, index) => {
    if (typeof entry === 'string') {
      return {
        name: `attachment-${index + 1}`,
        contentType: 'application/octet-stream',
        sizeBytes: null,
        pointer: boundedPointer(entry),
      };
    }
    const item = record(entry, 'GHL_ATTACHMENT_INVALID');
    return {
      name: optionalText(item.name ?? item.fileName, 200) ?? `attachment-${index + 1}`,
      contentType:
        optionalText(item.contentType ?? item.mimeType, 120) ?? 'application/octet-stream',
      sizeBytes: normalizedSize(item.size ?? item.sizeBytes),
      pointer: optionalText(item.url ?? item.pointer, 1000) ?? null,
    };
  });
}

function boundedPointer(value: string) {
  if (value.length > 1000) throw new ReplyCopilotIngressError('GHL_ATTACHMENT_INVALID', 422);
  return value;
}

function normalizedSize(value: unknown) {
  if (value === undefined || value === null || value === '') return null;
  const numeric = Number(value);
  if (!Number.isSafeInteger(numeric) || numeric < 0 || numeric > 25 * 1024 * 1024) {
    throw new ReplyCopilotIngressError('GHL_ATTACHMENT_SIZE_INVALID', 422);
  }
  return numeric;
}

function senderDisplayName(from: string) {
  const beforeAddress = from.match(/^\s*([^<]+?)\s*</)?.[1]?.trim();
  if (beforeAddress) return beforeAddress.slice(0, 160);
  const address = from.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+/i)?.[0];
  return (address ?? 'Adult contact').slice(0, 160);
}

function normalizedDate(value: unknown, fallback: Date) {
  if (typeof value !== 'string') return fallback.toISOString();
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) throw new ReplyCopilotIngressError('GHL_DATE_INVALID', 422);
  return date.toISOString();
}

function requiredText(value: unknown, max: number, code: string) {
  const normalized = optionalText(value, max);
  if (!normalized) throw new ReplyCopilotIngressError(code, 422);
  return normalized;
}

function optionalText(value: unknown, max: number) {
  if (value === undefined || value === null) return undefined;
  if (typeof value !== 'string') throw new ReplyCopilotIngressError('GHL_FIELD_INVALID', 422);
  const normalized = value.trim();
  if (normalized.length > max) throw new ReplyCopilotIngressError('GHL_FIELD_TOO_LONG', 422);
  return normalized || undefined;
}

function record(value: unknown, code: string): Record<string, unknown> {
  if (!isRecord(value)) throw new ReplyCopilotIngressError(code, 400);
  return value;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
