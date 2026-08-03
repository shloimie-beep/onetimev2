import { createHash } from 'node:crypto';
import type {
  ReplyCopilotActorDirectory,
  ReplyCopilotMappedActor,
  ReplyCopilotRoute,
} from '../../../../packages/contracts/src/telegram/reply-copilot.ts';
import type { BotEnvironment } from '../../../../packages/contracts/src/telegram/types.ts';

export type ReplyCopilotRuntimeConfig = Readonly<{
  enabled: boolean;
  workflowIngressEnabled: boolean;
  oauthIngressEnabled: boolean;
  telegramDeliveryEnabled: boolean;
  ghlDeliveryEnabled: boolean;
  environment: BotEnvironment;
  workspaceKey: string;
  allowedLocationId: string;
  workflowSharedSecret?: string;
  payloadEncryptionKey?: string;
  actionSigningSecret?: string;
  telegramBotToken?: string;
  telegramWebhookSecret?: string;
  ghlToken?: string;
  ghlApiBaseUrl: string;
  ghlApiVersion: string;
  ghlConversationBaseUrl: string;
  port: number;
  actors: ReadonlyMap<ReplyCopilotRoute, ReplyCopilotMappedActor>;
  chatIdsByRef: ReadonlyMap<string, string>;
}>;

export function readReplyCopilotRuntimeConfig(
  source: NodeJS.ProcessEnv,
): ReplyCopilotRuntimeConfig {
  const environment = botEnvironment(source.ONE_TIME_TELEGRAM_ENVIRONMENT);
  const actorEntries = [
    actor('RABBI', source.ONE_TIME_RABBI_TELEGRAM_CHAT_ID, source.ONE_TIME_RABBI_TELEGRAM_USER_ID),
    actor(
      'SHLOIMIE',
      source.ONE_TIME_SHLOIMIE_TELEGRAM_CHAT_ID,
      source.ONE_TIME_SHLOIMIE_TELEGRAM_USER_ID,
    ),
  ].filter((entry): entry is NonNullable<typeof entry> => Boolean(entry));
  return {
    enabled: bool(source.ONE_TIME_REPLY_COPILOT_ENABLED),
    workflowIngressEnabled: bool(source.ONE_TIME_REPLY_COPILOT_WORKFLOW_INGRESS_ENABLED),
    oauthIngressEnabled: bool(source.ONE_TIME_REPLY_COPILOT_OAUTH_INGRESS_ENABLED),
    telegramDeliveryEnabled: bool(source.ONE_TIME_REPLY_COPILOT_TELEGRAM_DELIVERY_ENABLED),
    ghlDeliveryEnabled: bool(source.ONE_TIME_REPLY_COPILOT_GHL_DELIVERY_ENABLED),
    environment,
    workspaceKey: source.ONE_TIME_REPLY_COPILOT_WORKSPACE_KEY?.trim() || 'one_time_primary',
    allowedLocationId:
      source.ONE_TIME_REPLY_COPILOT_GHL_LOCATION_ID?.trim() || 'pBSnOK2nkdxp6gf9Rg3o',
    ...optional('workflowSharedSecret', source.ONE_TIME_REPLY_COPILOT_WORKFLOW_SHARED_SECRET),
    ...optional('payloadEncryptionKey', source.ONE_TIME_REPLY_COPILOT_PAYLOAD_KEY),
    ...optional('actionSigningSecret', source.ONE_TIME_REPLY_COPILOT_ACTION_SIGNING_SECRET),
    ...optional('telegramBotToken', source.ONE_TIME_RABBI_TELEGRAM_BOT_TOKEN),
    ...optional('telegramWebhookSecret', source.ONE_TIME_RABBI_TELEGRAM_WEBHOOK_SECRET),
    ...optional('ghlToken', source.ONE_TIME_REPLY_COPILOT_GHL_TOKEN),
    ghlApiBaseUrl:
      source.ONE_TIME_REPLY_COPILOT_GHL_API_BASE_URL?.trim() ||
      'https://services.leadconnectorhq.com',
    ghlApiVersion: source.ONE_TIME_REPLY_COPILOT_GHL_API_VERSION?.trim() || '2021-07-28',
    ghlConversationBaseUrl:
      source.ONE_TIME_REPLY_COPILOT_GHL_CONVERSATION_BASE_URL?.trim() ||
      'https://app.gohighlevel.com/v2/location/pBSnOK2nkdxp6gf9Rg3o/conversations/conversations',
    port: port(source.PORT),
    actors: new Map(actorEntries.map(({ route, mapped }) => [route, mapped])),
    chatIdsByRef: new Map(actorEntries.map(({ rawChatId, mapped }) => [mapped.chatRef, rawChatId])),
  };
}

export function replyCopilotReadiness(config: ReplyCopilotRuntimeConfig) {
  const blockers = [
    !config.enabled && 'loop_disabled',
    !config.payloadEncryptionKey && 'payload_key_absent',
    !config.actionSigningSecret && 'action_signing_secret_absent',
    config.workflowIngressEnabled && !config.workflowSharedSecret && 'workflow_secret_absent',
    config.telegramDeliveryEnabled && !config.telegramBotToken && 'distinct_rabbi_token_absent',
    config.telegramDeliveryEnabled &&
      !config.telegramWebhookSecret &&
      'telegram_webhook_secret_absent',
    config.telegramDeliveryEnabled && !config.actors.get('RABBI') && 'rabbi_mapping_absent',
    config.telegramDeliveryEnabled && !config.actors.get('SHLOIMIE') && 'shloimie_mapping_absent',
    config.ghlDeliveryEnabled && !config.ghlToken && 'ghl_token_absent',
  ].filter((value): value is string => Boolean(value));
  return {
    ready: blockers.length === 0,
    status: blockers.length === 0 ? ('ready' as const) : ('provider_off' as const),
    customerDeliveryAuthorized:
      blockers.length === 0 && config.telegramDeliveryEnabled && config.ghlDeliveryEnabled,
    tokenPresence: config.telegramBotToken ? ('present' as const) : ('absent' as const),
    rabbiMappingPresence: config.actors.get('RABBI') ? ('present' as const) : ('absent' as const),
    shloimieMappingPresence: config.actors.get('SHLOIMIE')
      ? ('present' as const)
      : ('absent' as const),
    blockers,
  };
}

export class ConfiguredReplyCopilotActorDirectory implements ReplyCopilotActorDirectory {
  constructor(private readonly actors: ReadonlyMap<ReplyCopilotRoute, ReplyCopilotMappedActor>) {}

  async resolve(route: ReplyCopilotRoute) {
    return this.actors.get(route) ?? null;
  }
}

function actor(route: ReplyCopilotRoute, chatId: string | undefined, userId: string | undefined) {
  const rawChatId = chatId?.trim();
  const rawUserId = userId?.trim();
  if (!rawChatId || !rawUserId) return null;
  if (!/^-?\d{5,32}$/.test(rawChatId) || !/^\d{5,32}$/.test(rawUserId)) return null;
  return {
    route,
    rawChatId,
    mapped: {
      route,
      chatRef: opaque('telegram_chat', rawChatId),
      userRef: opaque('telegram_user', rawUserId),
    },
  };
}

function opaque(prefix: string, value: string) {
  return `${prefix}_${createHash('sha256').update(value).digest('hex')}`;
}

function bool(value: string | undefined) {
  return value?.trim().toLowerCase() === 'true';
}

function optional<Key extends string>(key: Key, value: string | undefined) {
  const normalized = value?.trim();
  return normalized ? ({ [key]: normalized } as Record<Key, string>) : {};
}

function botEnvironment(value: string | undefined): BotEnvironment {
  if (value === 'production' || value === 'staging' || value === 'local') return value;
  return 'staging';
}

function port(value: string | undefined) {
  const parsed = Number(value ?? '3103');
  return Number.isInteger(parsed) && parsed >= 1 && parsed <= 65_535 ? parsed : 3103;
}
