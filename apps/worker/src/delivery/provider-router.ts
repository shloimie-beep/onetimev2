import { providerError } from '../../../../packages/contracts/src/delivery/errors.ts';
import type {
  DeliveryProviderRouter,
  DeliveryRequest,
  EmailDeliveryRequest,
  ProviderReceipt,
  ProviderSendContext,
  WhatsAppDeliveryRequest,
} from '../../../../packages/contracts/src/delivery/types.ts';
import { safeFingerprint } from '../../../../packages/domain/src/providers/shared.ts';
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

type ProviderName = 'resend' | 'one_time_wapi';

export class OneTimeProviderDeliveryRouter implements DeliveryProviderRouter {
  private readonly acceptedReceipts = new Map<string, ProviderReceipt>();
  private remainingBudget: number;

  constructor(
    private readonly config: DeliveryProviderFeatureConfig,
    private readonly clients: {
      resend?: ResendProviderClient;
      wapi?: WapiProviderClient;
    },
  ) {
    this.remainingBudget = config.canaryBudget;
  }

  readiness() {
    return {
      ...this.config.snapshot,
      canaryBudget: this.remainingBudget,
    };
  }

  async send(request: DeliveryRequest, context: ProviderSendContext): Promise<ProviderReceipt> {
    const provider = providerForRequest(request);
    if (!provider) {
      throw providerError('unsupported_provider_channel', {
        retryable: false,
        provider: 'worker',
      });
    }
    this.assertCommonGates(request, context, provider);
    const cacheKey = `${provider}:${request.idempotencyKey}`;
    const cached = this.acceptedReceipts.get(cacheKey);
    if (cached) return cached;
    if (provider === 'resend') return this.sendEmail(request as EmailDeliveryRequest, context);
    return this.sendWhatsApp(request as WhatsAppDeliveryRequest, context);
  }

  private assertCommonGates(
    request: DeliveryRequest,
    context: ProviderSendContext,
    provider: ProviderName,
  ): void {
    if (this.config.transportMode !== 'provider' || context.transportMode !== 'provider') {
      throw providerError('provider_mode_not_enabled', {
        retryable: false,
        provider,
      });
    }
    if (this.config.environment === 'production') {
      throw providerError('provider_production_disabled', {
        retryable: false,
        provider,
      });
    }
    if (!this.config.transportEnabled) {
      throw providerError('provider_transport_disabled', {
        retryable: false,
        provider,
      });
    }
    if (!this.config.environmentGate || this.config.environmentGate !== this.config.environment) {
      throw providerError('provider_environment_gate_mismatch', {
        retryable: false,
        provider,
      });
    }
    if (!this.config.stagingIsolationProof) {
      throw providerError('provider_staging_isolation_missing', {
        retryable: false,
        provider,
      });
    }
    if (!request.idempotencyKey) {
      throw providerError('provider_idempotency_key_missing', {
        retryable: false,
        provider,
      });
    }
    if (request.idempotencyKey !== context.deliveryKey) {
      throw providerError('provider_idempotency_key_mismatch', {
        retryable: false,
        provider,
      });
    }
    if (context.signal.aborted) {
      throw providerError('provider_request_aborted', {
        retryable: true,
        provider,
      });
    }
  }

  private consumeBudget(provider: ProviderName): void {
    if (this.remainingBudget <= 0) {
      throw providerError('provider_canary_budget_exhausted', {
        retryable: false,
        provider,
      });
    }
    this.remainingBudget -= 1;
  }

  private async sendEmail(
    request: EmailDeliveryRequest,
    context: ProviderSendContext,
  ): Promise<ProviderReceipt> {
    if (!this.config.resendEnabled || !this.config.resendAuthorized || !this.clients.resend) {
      throw providerError(
        this.config.resendEnabled ? 'provider_authorization_missing' : 'resend_disabled',
        {
          retryable: false,
          provider: 'resend',
        },
      );
    }
    if (!this.config.allowlistedEmailDestinations.has(request.to.trim().toLowerCase())) {
      throw providerError('provider_destination_not_authorized', {
        retryable: false,
        provider: 'resend',
      });
    }
    this.consumeBudget('resend');
    const receipt = await this.clients.resend.sendEmail(withoutProvider(request), {
      idempotencyKey: request.idempotencyKey,
      signal: context.signal,
    });
    return this.cacheReceipt('resend', request.idempotencyKey, {
      provider: 'resend',
      messageId: redactedProviderMessageRef('resend', receipt.messageId),
      acceptedAt: receipt.acceptedAt ?? new Date(),
      sink: false,
    });
  }

  private async sendWhatsApp(
    request: WhatsAppDeliveryRequest,
    context: ProviderSendContext,
  ): Promise<ProviderReceipt> {
    if (!this.config.wapiEnabled || !this.config.wapiAuthorized || !this.clients.wapi) {
      throw providerError(
        this.config.wapiEnabled ? 'provider_authorization_missing' : 'wapi_disabled',
        {
          retryable: false,
          provider: 'one_time_wapi',
        },
      );
    }
    if (!this.config.allowlistedWhatsAppDestinations.has(request.to.trim())) {
      throw providerError('provider_destination_not_authorized', {
        retryable: false,
        provider: 'one_time_wapi',
      });
    }
    this.consumeBudget('one_time_wapi');
    const receipt = await this.clients.wapi.sendWhatsApp(withoutProvider(request), {
      idempotencyKey: request.idempotencyKey,
      signal: context.signal,
    });
    return this.cacheReceipt('one_time_wapi', request.idempotencyKey, {
      provider: 'one_time_wapi',
      messageId: redactedProviderMessageRef('one_time_wapi', receipt.messageId),
      acceptedAt: receipt.acceptedAt ?? new Date(),
      sink: false,
    });
  }

  private cacheReceipt(
    provider: ProviderName,
    idempotencyKey: string,
    receipt: ProviderReceipt,
  ): ProviderReceipt {
    this.acceptedReceipts.set(`${provider}:${idempotencyKey}`, receipt);
    return receipt;
  }
}

function providerForRequest(request: DeliveryRequest): ProviderName | null {
  const provider = (request as { provider?: unknown }).provider;
  if (
    provider === 'resend' &&
    (request.channel === 'email' || request.channel === 'internal_email')
  ) {
    return 'resend';
  }
  if (provider === 'one_time_wapi' && request.channel === 'whatsapp') return 'one_time_wapi';
  return null;
}

function withoutProvider<T extends DeliveryRequest>(request: T): Omit<T, 'provider'> {
  const rest = { ...request } as Record<string, unknown>;
  delete rest.provider;
  return rest as Omit<T, 'provider'>;
}

function redactedProviderMessageRef(provider: ProviderName, messageId: string): string {
  return `${provider}_${safeFingerprint(messageId)}`;
}
