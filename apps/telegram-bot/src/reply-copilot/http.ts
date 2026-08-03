import { createHash } from 'node:crypto';
import type { IncomingMessage, ServerResponse } from 'node:http';
import type { ReplyCopilotIngressKind } from '../../../../packages/contracts/src/telegram/reply-copilot.ts';
import {
  parseAndNormalizeGhlInboundEmail,
  readReplyCopilotRawBody,
  ReplyCopilotIngressError,
} from '../../../../packages/domain/src/telegram/reply-copilot/ingress.ts';
import {
  verifyGhlEd25519Signature,
  verifyWorkflowSharedSecret,
} from '../../../../packages/domain/src/telegram/reply-copilot/security.ts';
import type { ReplyCopilotService } from '../../../../packages/domain/src/telegram/reply-copilot/service.ts';

export function createGhlReplyCopilotWebhookHandler(input: {
  service: ReplyCopilotService;
  ingressKind: ReplyCopilotIngressKind;
  enabled: boolean;
  allowedLocationId: string;
  workflowSharedSecret?: string;
  ghlPublicKey?: string;
}) {
  return async (req: IncomingMessage, res: ServerResponse) => {
    try {
      if (!input.enabled) return json(res, 404, { ok: false, code: 'FEATURE_DISABLED' });
      if (req.method !== 'POST') return json(res, 405, { ok: false, code: 'METHOD_DENIED' });
      if (!isJsonContentType(header(req, 'content-type'))) {
        return json(res, 415, { ok: false, code: 'CONTENT_TYPE_DENIED' });
      }
      const rawBody = await readReplyCopilotRawBody(req);
      if (input.ingressKind === 'workflow_shared_secret') {
        if (
          !input.workflowSharedSecret ||
          !verifyWorkflowSharedSecret(
            header(req, 'x-onetime-webhook-secret'),
            input.workflowSharedSecret,
          )
        ) {
          return json(res, 401, { ok: false, code: 'SIGNATURE_DENIED' });
        }
      } else if (
        !verifyGhlEd25519Signature(rawBody, header(req, 'x-ghl-signature'), input.ghlPublicKey)
      ) {
        return json(res, 401, { ok: false, code: 'SIGNATURE_DENIED' });
      }
      const inbound = parseAndNormalizeGhlInboundEmail({
        rawBody,
        ingressKind: input.ingressKind,
        allowedLocationId: input.allowedLocationId,
      });
      const result = await input.service.ingest(inbound);
      return json(res, result.duplicate ? 200 : 202, {
        ok: true,
        duplicate: result.duplicate,
        accepted: !result.duplicate,
      });
    } catch (error) {
      if (error instanceof ReplyCopilotIngressError) {
        return json(res, error.status, { ok: false, code: error.code });
      }
      return json(res, 500, { ok: false, code: 'INGRESS_FAILED' });
    }
  };
}

export function createReplyCopilotTelegramWebhookHandler(input: {
  service: ReplyCopilotService;
  enabled: boolean;
  webhookSecret: string;
}) {
  return async (req: IncomingMessage, res: ServerResponse) => {
    try {
      if (!input.enabled) return json(res, 404, { ok: false, code: 'FEATURE_DISABLED' });
      if (req.method !== 'POST') return json(res, 405, { ok: false, code: 'METHOD_DENIED' });
      if (!isJsonContentType(header(req, 'content-type'))) {
        return json(res, 415, { ok: false, code: 'CONTENT_TYPE_DENIED' });
      }
      if (
        !verifyWorkflowSharedSecret(
          header(req, 'x-telegram-bot-api-secret-token'),
          input.webhookSecret,
        )
      ) {
        return json(res, 401, { ok: false, code: 'SIGNATURE_DENIED' });
      }
      const raw = await readReplyCopilotRawBody(req, 32 * 1024);
      const update = telegramUpdate(JSON.parse(raw.toString('utf8')) as unknown);
      if (!update) return json(res, 200, { ok: true, ignored: true });
      if (update.kind === 'callback') {
        const result = await input.service.handleAction({
          callbackData: update.callbackData,
          chatRef: update.chatRef,
          userRef: update.userRef,
        });
        return json(res, 200, { ok: true, status: result.status });
      }
      const result = await input.service.captureDraft({
        replyToTelegramMessageRef: update.replyToMessageRef,
        chatRef: update.chatRef,
        userRef: update.userRef,
        text: update.text,
      });
      return json(res, 200, { ok: true, status: result.status });
    } catch {
      return json(res, 500, { ok: false, code: 'TELEGRAM_INGRESS_FAILED' });
    }
  };
}

function telegramUpdate(value: unknown):
  | {
      kind: 'callback';
      callbackData: string;
      chatRef: string;
      userRef: string;
    }
  | {
      kind: 'draft';
      text: string;
      replyToMessageRef: string;
      chatRef: string;
      userRef: string;
    }
  | null {
  if (!isRecord(value)) return null;
  if (isRecord(value.callback_query)) {
    const callback = value.callback_query;
    const message = isRecord(callback.message) ? callback.message : null;
    const chat = message && isRecord(message.chat) ? message.chat : null;
    const from = isRecord(callback.from) ? callback.from : null;
    if (!message || !chat || !from || chat.type !== 'private') return null;
    if (typeof callback.data !== 'string' || callback.data.length > 64) return null;
    return {
      kind: 'callback',
      callbackData: callback.data,
      chatRef: opaqueRef('telegram_chat', chat.id),
      userRef: opaqueRef('telegram_user', from.id),
    };
  }
  if (isRecord(value.message)) {
    const message = value.message;
    const chat = isRecord(message.chat) ? message.chat : null;
    const from = isRecord(message.from) ? message.from : null;
    const replyTo = isRecord(message.reply_to_message) ? message.reply_to_message : null;
    if (
      !chat ||
      !from ||
      !replyTo ||
      chat.type !== 'private' ||
      from.is_bot === true ||
      message.forward_origin ||
      message.forward_from ||
      typeof message.text !== 'string' ||
      message.text.length > 12_000 ||
      replyTo.message_id === undefined
    ) {
      return null;
    }
    return {
      kind: 'draft',
      text: message.text,
      replyToMessageRef: `telegram:${String(replyTo.message_id)}`,
      chatRef: opaqueRef('telegram_chat', chat.id),
      userRef: opaqueRef('telegram_user', from.id),
    };
  }
  return null;
}

function opaqueRef(prefix: string, value: unknown) {
  if (value === undefined || value === null) throw new Error('TELEGRAM_ID_MISSING');
  return `${prefix}_${createHash('sha256').update(String(value)).digest('hex')}`;
}

function isJsonContentType(value: string | undefined) {
  return value?.split(';', 1)[0]?.trim().toLowerCase() === 'application/json';
}

function header(req: IncomingMessage, name: string) {
  const value = req.headers[name.toLowerCase()];
  if (Array.isArray(value)) return value[0];
  return value;
}

function json(res: ServerResponse, status: number, payload: Record<string, unknown>) {
  res.statusCode = status;
  res.setHeader('content-type', 'application/json; charset=utf-8');
  res.setHeader('cache-control', 'no-store');
  res.end(JSON.stringify(payload));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
