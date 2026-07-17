import type { IncomingMessage, ServerResponse } from 'node:http';
import type {
  BotEnvironment,
  BotInboxRepository,
  BotKey,
  ChatContext,
  NormalizedBotUpdate,
  SensitivePayloadCodec,
} from '../../../packages/contracts/src/telegram/types.ts';
import { asChatRef, asProviderUserRef } from '../../../packages/contracts/src/telegram/types.ts';
import { constantTimeStringEqual, sha256 } from '../../../packages/domain/src/telegram/crypto.ts';

export type TelegramWebhookHandlerConfig = {
  botKey: BotKey;
  environment: BotEnvironment;
  secretToken: string;
  contentType: 'application/json';
  maxBytes: number;
  maxDepth: number;
  maxStringLength: number;
  maxArrayLength: number;
  inbox: BotInboxRepository;
  codec: SensitivePayloadCodec;
};

export function createTelegramWebhookHandler(config: TelegramWebhookHandlerConfig) {
  return async function telegramWebhookHandler(req: IncomingMessage, res: ServerResponse) {
    try {
      if (req.method !== 'POST') return json(res, 405, { ok: false });
      if (header(req, 'content-type') !== config.contentType) return json(res, 415, { ok: false });
      const suppliedSecret = header(req, 'x-telegram-bot-api-secret-token');
      if (
        !suppliedSecret ||
        !config.secretToken ||
        !constantTimeStringEqual(suppliedSecret, config.secretToken)
      ) {
        return json(res, 401, { ok: false });
      }

      const body = await readBoundedBody(req, config.maxBytes);
      const parsed = parseBoundedJson(body, {
        maxDepth: config.maxDepth,
        maxStringLength: config.maxStringLength,
        maxArrayLength: config.maxArrayLength,
      });
      const update = normalizeTelegramUpdate(parsed, config.botKey, config.environment);
      const payloadRef = await config.codec.encrypt(update, {
        botKey: config.botKey,
        environment: config.environment,
        classification: 'normalized_update',
      });
      const result = await config.inbox.enqueue(update, payloadRef);
      return json(res, 200, { ok: true, duplicate: result.duplicate });
    } catch (error) {
      if (error instanceof IngressHttpError) return json(res, error.status, { ok: false });
      return json(res, 500, { ok: false });
    }
  };
}

export function normalizeTelegramUpdate(
  payload: unknown,
  botKey: BotKey,
  environment: BotEnvironment,
): NormalizedBotUpdate {
  const object = asRecord(payload);
  const updateId = readUpdateId(object.update_id);
  const receivedAt = new Date().toISOString();
  if (isRecord(object.message)) {
    return normalizeMessage(updateId, object.message, botKey, environment, receivedAt, false);
  }
  if (isRecord(object.edited_message)) {
    return normalizeMessage(updateId, object.edited_message, botKey, environment, receivedAt, true);
  }
  if (isRecord(object.callback_query)) {
    return normalizeCallback(updateId, object.callback_query, botKey, environment, receivedAt);
  }
  return {
    updateId,
    kind: 'unsupported',
    botKey,
    environment,
    chatContext: 'private',
    isForwarded: false,
    isEdited: false,
    isAnonymousAdmin: false,
    receivedAt,
  };
}

function normalizeMessage(
  updateId: string,
  message: Record<string, unknown>,
  botKey: BotKey,
  environment: BotEnvironment,
  receivedAt: string,
  isEdited: boolean,
): NormalizedBotUpdate {
  const from = isRecord(message.from) ? message.from : {};
  const chat = isRecord(message.chat) ? message.chat : {};
  const update: NormalizedBotUpdate = {
    updateId,
    kind: 'message',
    botKey,
    environment,
    chatContext: chatContext(chat.type),
    isForwarded:
      Boolean(message.forward_origin) ||
      Boolean(message.forward_from) ||
      Boolean(message.forward_sender_name) ||
      Boolean(message.forward_date),
    isEdited,
    isAnonymousAdmin: Boolean(from.is_bot) && from.id === undefined,
    receivedAt,
  };
  const provider = providerUserRef(from.id);
  const chatReference = chatRef(chat.id);
  if (provider) update.providerUserRef = provider;
  if (chatReference) update.chatRef = chatReference;
  if (typeof message.text === 'string') update.text = message.text.slice(0, 1000);
  if (message.message_id !== undefined) update.messageId = String(message.message_id);
  return update;
}

function normalizeCallback(
  updateId: string,
  callback: Record<string, unknown>,
  botKey: BotKey,
  environment: BotEnvironment,
  receivedAt: string,
): NormalizedBotUpdate {
  const from = isRecord(callback.from) ? callback.from : {};
  const message = isRecord(callback.message) ? callback.message : {};
  const chat = isRecord(message.chat) ? message.chat : {};
  const update: NormalizedBotUpdate = {
    updateId,
    kind: 'callback_query',
    botKey,
    environment,
    chatContext: chatContext(chat.type),
    isForwarded: false,
    isEdited: false,
    isAnonymousAdmin: false,
    receivedAt,
  };
  const provider = providerUserRef(from.id);
  const chatReference = chatRef(chat.id);
  if (provider) update.providerUserRef = provider;
  if (chatReference) update.chatRef = chatReference;
  if (typeof callback.data === 'string') update.callbackData = callback.data.slice(0, 256);
  if (message.message_id !== undefined) update.messageId = String(message.message_id);
  return update;
}

function providerUserRef(value: unknown) {
  if (value === undefined || value === null) return undefined;
  return asProviderUserRef(`telegram_user_${sha256(String(value))}`);
}

function chatRef(value: unknown) {
  if (value === undefined || value === null) return undefined;
  return asChatRef(`telegram_chat_${sha256(String(value))}`);
}

function chatContext(value: unknown): ChatContext {
  if (value === 'group' || value === 'supergroup' || value === 'channel') return value;
  return 'private';
}

function readUpdateId(value: unknown) {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 0) {
    throw new IngressHttpError(400);
  }
  return String(value);
}

function parseBoundedJson(
  body: string,
  limits: { maxDepth: number; maxStringLength: number; maxArrayLength: number },
) {
  let parsed: unknown;
  try {
    parsed = JSON.parse(body) as unknown;
  } catch {
    throw new IngressHttpError(400);
  }
  validateBounds(parsed, limits, 0);
  return parsed;
}

function validateBounds(
  value: unknown,
  limits: { maxDepth: number; maxStringLength: number; maxArrayLength: number },
  depth: number,
) {
  if (depth > limits.maxDepth) throw new IngressHttpError(400);
  if (typeof value === 'string' && value.length > limits.maxStringLength) {
    throw new IngressHttpError(400);
  }
  if (Array.isArray(value)) {
    if (value.length > limits.maxArrayLength) throw new IngressHttpError(400);
    for (const item of value) validateBounds(item, limits, depth + 1);
  } else if (isRecord(value)) {
    for (const entry of Object.values(value)) validateBounds(entry, limits, depth + 1);
  }
}

async function readBoundedBody(req: IncomingMessage, maxBytes: number) {
  let size = 0;
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk));
    size += buffer.length;
    if (size > maxBytes) throw new IngressHttpError(413);
    chunks.push(buffer);
  }
  return Buffer.concat(chunks).toString('utf8');
}

function json(res: ServerResponse, status: number, payload: Record<string, unknown>) {
  res.statusCode = status;
  res.setHeader('content-type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(payload));
}

function header(req: IncomingMessage, name: string) {
  const value = req.headers[name.toLowerCase()];
  if (Array.isArray(value)) return value[0] ?? '';
  return value ?? '';
}

function asRecord(value: unknown): Record<string, unknown> {
  if (!isRecord(value)) throw new IngressHttpError(400);
  return value;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

class IngressHttpError extends Error {
  constructor(readonly status: number) {
    super('telegram_ingress_rejected');
  }
}
