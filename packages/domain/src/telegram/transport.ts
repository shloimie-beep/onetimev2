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
