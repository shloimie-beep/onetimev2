import { providerError } from '../../../../packages/contracts/src/delivery/errors.ts';
import {
  InMemoryDeliveryProviderBudget,
  evaluateProviderActivationPolicy,
  providerAttemptIdempotencyKey,
  type DeliveryProviderAuthorization,
  type DeliveryProviderIdentifier,
} from '../../../../packages/domain/src/delivery/activation-policy.ts';
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
  private readonly budget: InMemoryDeliveryProviderBudget;

  constructor(
    private readonly config: DeliveryProviderFeatureConfig,
    private readonly clients: {
      resend?: ResendProviderClient;
      wapi?: WapiProviderClient;
    },
    budget?: InMemoryDeliveryProviderBudget,
  ) {
    this.budget =
      budget ??
      new InMemoryDeliveryProviderBudget({
        perRunLimit: config.perRunBudget,
        perProviderLimit: config.perProviderBudget,
      });
  }

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
    this.assertActivationAllowed({
      provider: 'resend',
      request,
      context,
      destinationAllowed:
        Boolean(this.config.canaryEmailDestination) &&
        request.to === this.config.canaryEmailDestination,
      consentRequired: request.recipientClass === 'public',
    });
    const receipt = await this.clients.resend.sendEmail(withoutProvider(request), {
      idempotencyKey: providerAttemptIdempotencyKey(request.idempotencyKey, context.attempt),
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
    this.assertActivationAllowed({
      provider: 'one_time_wapi',
      request,
      context,
      destinationAllowed:
        Boolean(this.config.canaryWhatsAppDestination) &&
        request.to === this.config.canaryWhatsAppDestination,
      consentRequired: true,
    });
    const receipt = await this.clients.wapi.sendWhatsApp(withoutProvider(request), {
      idempotencyKey: providerAttemptIdempotencyKey(request.idempotencyKey, context.attempt),
      signal: context.signal,
    });
    return {
      provider: 'one_time_wapi',
      messageId: receipt.messageId,
      acceptedAt: receipt.acceptedAt ?? new Date(),
      sink: false,
    };
  }

  private assertActivationAllowed(input: {
    provider: DeliveryProviderIdentifier;
    request: DeliveryRequest;
    context: ProviderSendContext;
    destinationAllowed: boolean;
    consentRequired: boolean;
  }) {
    const authorization = this.authorization(input.provider);
    const destinationRef = input.destinationAllowed
      ? `${input.provider}:configured-canary`
      : `${input.provider}:unlisted-destination`;
    const decision = evaluateProviderActivationPolicy(
      {
        provider: input.provider,
        requestProvider: input.request.provider,
        providerMode: this.config.providerMode,
        runtimeEnvironment: this.config.runtimeEnvironment,
        transportEnabled: this.config.transportEnabled,
        isolatedStagingProof: this.config.stagingCanaryProof,
        authorization,
        destinationRef,
        allowlistedDestinationRef: `${input.provider}:configured-canary`,
        idempotencyKey: input.request.idempotencyKey,
        consent: {
          required: input.consentRequired,
          granted: true,
          suppressionState: 'active',
        },
        timeoutMs: this.config.providerTimeoutMs,
        leaseMsRemaining: Number.POSITIVE_INFINITY,
        leaseSafetyMarginMs: this.config.leaseSafetyMarginMs,
        auditContext: {
          deliveryKey: input.context.deliveryKey,
          eventType: input.request.idempotencyKey,
          channel: input.request.channel,
        },
      },
      this.budget,
    );
    if (decision.readiness === 'allowed') return;
    const code = decision.blockerCodes[0] ?? 'provider_transport_disabled';
    throw providerError(code, {
      retryable: false,
      provider: input.request.provider,
    });
  }

  private authorization(
    provider: DeliveryProviderIdentifier,
  ): DeliveryProviderAuthorization | null {
    if (!this.config.authorizationArtifactId) return null;
    return {
      artifactId: this.config.authorizationArtifactId,
      provider,
      environment: this.config.runtimeEnvironment,
    };
  }
}

function withoutProvider<T extends DeliveryRequest>(request: T): Omit<T, 'provider'> {
  const rest = { ...request } as Record<string, unknown>;
  delete rest.provider;
  return rest as Omit<T, 'provider'>;
}
