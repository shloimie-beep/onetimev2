import type {
  BotReply,
  BotTransportAdapter,
  ChatRef,
} from '../../../contracts/src/telegram/types.ts';
import { redactedRefHash } from '../providers/shared.ts';

export type TelegramSendMessageClient = {
  sendMessage(input: {
    chatRef: ChatRef;
    text: string;
    replyMarkup?: { inline_keyboard: Array<Array<{ text: string; callback_data: string }>> };
  }): Promise<{ messageRef: string }>;
};

export type TelegramProtectedChatDirectory = {
  resolveChatId(chatRef: ChatRef): Promise<string | null>;
};

export type TelegramBotApiClientOptions = {
  botToken: string;
  chatDirectory: TelegramProtectedChatDirectory;
  fetchImpl?: typeof fetch;
};

export type OneTimeTelegramTransportOptions = {
  enabled: boolean;
  canaryChatRef?: ChatRef;
  client: TelegramSendMessageClient;
};

export class OneTimeTelegramTransportAdapter implements BotTransportAdapter {
  readonly mode = 'telegram' as const;

  constructor(private readonly options: OneTimeTelegramTransportOptions) {}

  async sendReply(reply: BotReply): Promise<void> {
    if (!this.options.enabled) throw new Error('One Time Telegram transport is disabled.');
    if (!this.options.canaryChatRef || this.options.canaryChatRef !== reply.chatRef) {
      throw new Error('One Time Telegram canary chat is not authorized.');
    }
    await this.options.client.sendMessage({
      chatRef: reply.chatRef,
      text: reply.text,
      ...(reply.buttons
        ? {
            replyMarkup: {
              inline_keyboard: [
                reply.buttons.map((button) => ({
                  text: button.label,
                  callback_data: button.callbackData,
                })),
              ],
            },
          }
        : {}),
    });
  }
}

export class TelegramBotApiSendMessageClient implements TelegramSendMessageClient {
  private readonly fetchImpl: typeof fetch;

  constructor(private readonly options: TelegramBotApiClientOptions) {
    if (!/^\d{6,}:[A-Za-z0-9_-]{20,}$/.test(options.botToken)) {
      throw new Error('Protected Telegram bot token is missing or malformed.');
    }
    this.fetchImpl = options.fetchImpl ?? fetch;
  }

  async sendMessage(input: Parameters<TelegramSendMessageClient['sendMessage']>[0]) {
    const chatId = await this.options.chatDirectory.resolveChatId(input.chatRef);
    if (!chatId || !/^-?\d{5,32}$/.test(chatId)) {
      throw new Error('Telegram chat is not in the protected allowlist.');
    }
    const response = await this.fetchImpl(
      `https://api.telegram.org/bot${this.options.botToken}/sendMessage`,
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          chat_id: chatId,
          text: input.text,
          parse_mode: undefined,
          disable_web_page_preview: true,
          ...(input.replyMarkup ? { reply_markup: input.replyMarkup } : {}),
        }),
      },
    );
    if (!response.ok) {
      throw new Error(`Telegram send failed with status ${response.status}.`);
    }
    const json = (await response.json()) as { result?: { message_id?: number } };
    return {
      messageRef: `telegram_message_${redactedRefHash(String(json.result?.message_id ?? 'sent'))}`,
    };
  }
}

export function telegramTransportReadiness(input: {
  enabled: boolean;
  botKey: string;
  environment: string;
  tokenConfigured: boolean;
  ownerMappingConfigured: boolean;
  singleConsumerGate: boolean;
  canaryChatConfigured: boolean;
}) {
  const ready =
    input.enabled &&
    input.tokenConfigured &&
    input.ownerMappingConfigured &&
    input.singleConsumerGate &&
    input.canaryChatConfigured;
  return {
    provider: 'one_time_telegram' as const,
    readiness_state: ready ? ('configured' as const) : ('not_configured' as const),
    capability_names: ready
      ? ['send_message_canary', 'webhook_ingress', 'single_consumer_lease']
      : [],
    safe_fingerprint: redactedRefHash(`${input.botKey}:${input.environment}:${ready}`),
  };
}
