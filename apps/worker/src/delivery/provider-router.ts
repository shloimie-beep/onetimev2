import { providerError } from '../../../../packages/contracts/src/delivery/errors.ts';
import type {
  DeliveryProviderRouter,
  DeliveryRequest,
  EmailDeliveryRequest,
  ProviderReceipt,
  ProviderSendContext,
  WhatsAppDeliveryRequest,
} from '../../../../packages/contracts/src/delivery/types.ts';
import type { DeliveryProviderFeatureConfig } from './provider-config.ts';

export type ResendProviderClient = {
  sendEmail(
    request: Omit<EmailDeliveryRequest, 'provider'>,
    options: { idempotencyKey: string; signal: AbortSignal },
  ): Promise<{ messageId: string; acceptedAt?: Date }>;
};

export type WapiProviderClient = {
  sendWhatsApp(
    request: Omit<WhatsAppDeliveryRequest, 'provider'>,
    options: { idempotencyKey: string; signal: AbortSignal },
  ): Promise<{ messageId: string; acceptedAt?: Date }>;
};

export class OneTimeProviderDeliveryRouter implements DeliveryProviderRouter {
  constructor(
    private readonly config: DeliveryProviderFeatureConfig,
    private readonly clients: {
      resend?: ResendProviderClient;
      wapi?: WapiProviderClient;
    },
  ) {}

  async send(request: DeliveryRequest, context: ProviderSendContext): Promise<ProviderReceipt> {
    if (!this.config.transportEnabled) {
      throw providerError('provider_transport_disabled', {
        retryable: false,
        provider: request.provider,
      });
    }
    if (request.provider === 'resend') return this.sendEmail(request, context);
    return this.sendWhatsApp(request, context);
  }

  private async sendEmail(
    request: EmailDeliveryRequest,
    context: ProviderSendContext,
  ): Promise<ProviderReceipt> {
    if (!this.config.resendEnabled || !this.clients.resend) {
      throw providerError('resend_disabled', { retryable: false, provider: 'resend' });
    }
    if (!this.config.canaryEmailDestination || request.to !== this.config.canaryEmailDestination) {
      throw providerError('resend_canary_destination_not_authorized', {
        retryable: false,
        provider: 'resend',
      });
    }
    const receipt = await this.clients.resend.sendEmail(withoutProvider(request), {
      idempotencyKey: request.idempotencyKey,
      signal: context.signal,
    });
    return {
      provider: 'resend',
      messageId: receipt.messageId,
      acceptedAt: receipt.acceptedAt ?? new Date(),
      sink: false,
    };
  }

  private async sendWhatsApp(
    request: WhatsAppDeliveryRequest,
    context: ProviderSendContext,
  ): Promise<ProviderReceipt> {
    if (!this.config.wapiEnabled || !this.clients.wapi) {
      throw providerError('wapi_disabled', { retryable: false, provider: 'one_time_wapi' });
    }
    if (
      !this.config.canaryWhatsAppDestination ||
      request.to !== this.config.canaryWhatsAppDestination
    ) {
      throw providerError('wapi_canary_destination_not_authorized', {
        retryable: false,
        provider: 'one_time_wapi',
      });
    }
    const receipt = await this.clients.wapi.sendWhatsApp(withoutProvider(request), {
      idempotencyKey: request.idempotencyKey,
      signal: context.signal,
    });
    return {
      provider: 'one_time_wapi',
      messageId: receipt.messageId,
      acceptedAt: receipt.acceptedAt ?? new Date(),
      sink: false,
    };
  }
}

function withoutProvider<T extends DeliveryRequest>(request: T): Omit<T, 'provider'> {
  const rest = { ...request } as Record<string, unknown>;
  delete rest.provider;
  return rest as Omit<T, 'provider'>;
}
