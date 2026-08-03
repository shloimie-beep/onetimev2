import { createHash, randomBytes } from 'node:crypto';
import {
  NO_SUGGESTION_REVIEW_REQUIRED,
  REPLY_COPILOT_PRODUCT_KEY,
  type NormalizedGhlInboundEmail,
  type ReplyCopilotActionBinding,
  type ReplyCopilotActionKind,
  type ReplyCopilotIntent,
  type ReplyCopilotStore,
  type ReplyCopilotTelegramCard,
} from '../../../../contracts/src/telegram/reply-copilot.ts';
import { signReplyCopilotAction, verifyReplyCopilotActionSignature } from './security.ts';

const ACTION_CODE: Readonly<Record<ReplyCopilotActionKind, string>> = {
  send_suggested: 'ss',
  write_own: 'wo',
  confirm_send: 'cs',
  send_to_rabbi: 'sr',
  return_to_shloimie: 'rs',
  dismiss: 'di',
  cancel: 'ca',
};

const ACTION_BY_CODE = Object.fromEntries(
  Object.entries(ACTION_CODE).map(([action, code]) => [code, action]),
) as Readonly<Record<string, ReplyCopilotActionKind>>;

export async function buildInboundTelegramCard(input: {
  intent: ReplyCopilotIntent;
  inbound: NormalizedGhlInboundEmail;
  suggestionText: string;
  expectedChatRef: string;
  expectedUserRef: string;
  store: ReplyCopilotStore;
  actionSecret: string;
  actionIdFactory?: () => string;
}): Promise<ReplyCopilotTelegramCard> {
  const action = async (kind: ReplyCopilotActionKind, label: string) => ({
    label,
    callbackData: await bindAction({
      intent: input.intent,
      kind,
      expectedChatRef: input.expectedChatRef,
      expectedUserRef: input.expectedUserRef,
      store: input.store,
      actionSecret: input.actionSecret,
      ...(input.actionIdFactory ? { actionIdFactory: input.actionIdFactory } : {}),
    }),
  });
  const primary = [];
  if (input.suggestionText !== NO_SUGGESTION_REVIEW_REQUIRED) {
    primary.push(await action('send_suggested', 'Send suggested'));
  }
  primary.push(await action('write_own', 'Write my own'));
  const routeAction =
    input.intent.route === 'RABBI'
      ? await action('return_to_shloimie', 'Return to Shloimie')
      : await action('send_to_rabbi', 'Send to Rabbi');
  const text = [
    `[${input.intent.route}]`,
    `${input.inbound.senderDisplayName} · Email`,
    `Subject: ${bounded(input.inbound.subject, 300)}`,
    '',
    bounded(input.inbound.body, 1_400),
    '',
    'Suggested reply:',
    bounded(input.suggestionText, 1_300),
  ].join('\n');
  return {
    intentKey: input.intent.intentKey,
    chatRef: input.expectedChatRef,
    text: bounded(text, 3_500),
    buttons: [
      primary,
      [routeAction],
      [{ label: 'Open in GHL', url: input.intent.openInGhlUrl }],
      [await action('dismiss', 'Dismiss')],
    ],
    kind: 'inbound_card',
  };
}

export async function buildFinalPreviewCard(input: {
  intent: ReplyCopilotIntent;
  finalText: string;
  expectedChatRef: string;
  expectedUserRef: string;
  store: ReplyCopilotStore;
  actionSecret: string;
  actionIdFactory?: () => string;
}): Promise<ReplyCopilotTelegramCard> {
  const callback = async (kind: ReplyCopilotActionKind) =>
    bindAction({
      intent: input.intent,
      kind,
      expectedChatRef: input.expectedChatRef,
      expectedUserRef: input.expectedUserRef,
      store: input.store,
      actionSecret: input.actionSecret,
      ...(input.actionIdFactory ? { actionIdFactory: input.actionIdFactory } : {}),
    });
  return {
    intentKey: input.intent.intentKey,
    chatRef: input.expectedChatRef,
    text: `Final preview — nothing has been sent\n\n${bounded(input.finalText, 3_200)}`,
    buttons: [
      [
        { label: 'Confirm send', callbackData: await callback('confirm_send') },
        { label: 'Cancel', callbackData: await callback('cancel') },
      ],
      [{ label: 'Open in GHL', url: input.intent.openInGhlUrl }],
    ],
    kind: 'final_preview',
  };
}

export function parseAndVerifyActionToken(token: string, actionSecret: string) {
  const match = /^ot3\.([A-Za-z0-9_-]{8,20})\.([a-z]{2})\.(\d{1,6})\.([A-Za-z0-9_-]{12})$/.exec(
    token,
  );
  if (!match) return null;
  const [, actionId, actionCode, versionText, signature] = match;
  if (!actionId || !actionCode || !versionText || !signature) return null;
  const action = ACTION_BY_CODE[actionCode];
  const version = Number(versionText);
  if (!action || !Number.isSafeInteger(version) || version < 1) return null;
  if (
    !verifyReplyCopilotActionSignature({
      actionId,
      actionCode,
      version,
      signature,
      secret: actionSecret,
    })
  ) {
    return null;
  }
  return { action, version, tokenDigest: sha256(token) };
}

async function bindAction(input: {
  intent: ReplyCopilotIntent;
  kind: ReplyCopilotActionKind;
  expectedChatRef: string;
  expectedUserRef: string;
  store: ReplyCopilotStore;
  actionSecret: string;
  actionIdFactory?: () => string;
}) {
  const actionId = (input.actionIdFactory ?? (() => randomBytes(9).toString('base64url')))();
  const actionCode = ACTION_CODE[input.kind];
  const signature = signReplyCopilotAction(
    actionId,
    actionCode,
    input.intent.version,
    input.actionSecret,
  );
  const token = `ot3.${actionId}.${actionCode}.${input.intent.version}.${signature}`;
  if (Buffer.byteLength(token, 'utf8') > 64) throw new Error('REPLY_COPILOT_CALLBACK_TOO_LONG');
  const binding: ReplyCopilotActionBinding = {
    tokenDigest: sha256(token),
    intentKey: input.intent.intentKey,
    action: input.kind,
    expectedChatRefHash: sha256(input.expectedChatRef),
    expectedUserRefHash: sha256(input.expectedUserRef),
    productKey: REPLY_COPILOT_PRODUCT_KEY,
    workspaceKey: input.intent.workspaceKey,
    conversationDigest: input.intent.conversationDigest,
    sourceMessageDigest: input.intent.sourceMessageDigest,
    intentVersion: input.intent.version,
    expiresAt: input.intent.expiresAt,
    consumedAt: null,
  };
  await input.store.saveAction(binding);
  return token;
}

function bounded(value: string, max: number) {
  if (value.length <= max) return value;
  return `${value.slice(0, Math.max(0, max - 18)).trimEnd()}\n… Open in GHL`;
}

function sha256(value: string) {
  return createHash('sha256').update(value).digest('hex');
}
