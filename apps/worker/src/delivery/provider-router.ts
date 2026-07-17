import { providerError } from '../../../../packages/contracts/src/delivery/errors.ts';
import type {
  DeliveryProviderRouter,
  DeliveryRequest,
  EmailDeliveryRequest,
  ProviderReceipt,
  ProviderSendContext,
  WhatsAppDeliveryRequest,
} from '../../../../packages/contracts/src/delivery/types.ts';
import {
  InMemoryDeliveryProviderBudget,
  evaluateProviderActivationPolicy,
  providerAttemptIdempotencyKey,
  type DeliveryProviderAuthorization,
  type DeliveryProviderIdentifier,
} from '../../../../packages/domain/src/delivery/activation-policy.ts';
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

  readiness() {
    return {
      ...this.config.snapshot,
      budget: {
        resend: this.budget.snapshot('resend'),
        one_time_wapi: this.budget.snapshot('one_time_wapi'),
      },
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
    if (!this.config.transportEnabled) {
      throw providerError('provider_transport_disabled', {
        retryable: false,
        provider,
      });
    }
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

  private async sendEmail(
    request: EmailDeliveryRequest,
    context: ProviderSendContext,
  ): Promise<ProviderReceipt> {
    if (!this.config.resendEnabled || !this.clients.resend) {
      throw providerError('resend_disabled', {
        retryable: false,
        provider: 'resend',
      });
    }
    if (!this.config.resendAuthorized && !this.config.authorizationArtifactId) {
      throw providerError('provider_authorization_missing', {
        retryable: false,
        provider: 'resend',
      });
    }
    this.assertActivationAllowed({
      provider: 'resend',
      request,
      context,
      destinationAllowed: this.config.allowlistedEmailDestinations.has(
        request.to.trim().toLowerCase(),
      ),
      consentRequired: request.recipientClass === 'public',
    });
    const receipt = await this.clients.resend.sendEmail(withoutProvider(request), {
      idempotencyKey: providerAttemptIdempotencyKey(request.idempotencyKey, context.attempt),
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
    if (!this.config.wapiEnabled || !this.clients.wapi) {
      throw providerError('wapi_disabled', {
        retryable: false,
        provider: 'one_time_wapi',
      });
    }
    if (!this.config.wapiAuthorized && !this.config.authorizationArtifactId) {
      throw providerError('provider_authorization_missing', {
        retryable: false,
        provider: 'one_time_wapi',
      });
    }
    this.assertActivationAllowed({
      provider: 'one_time_wapi',
      request,
      context,
      destinationAllowed: this.config.allowlistedWhatsAppDestinations.has(request.to.trim()),
      consentRequired: true,
    });
    const receipt = await this.clients.wapi.sendWhatsApp(withoutProvider(request), {
      idempotencyKey: providerAttemptIdempotencyKey(request.idempotencyKey, context.attempt),
      signal: context.signal,
    });
    return this.cacheReceipt('one_time_wapi', request.idempotencyKey, {
      provider: 'one_time_wapi',
      messageId: redactedProviderMessageRef('one_time_wapi', receipt.messageId),
      acceptedAt: receipt.acceptedAt ?? new Date(),
      sink: false,
    });
  }

  private assertActivationAllowed(input: {
    provider: DeliveryProviderIdentifier & ProviderName;
    request: DeliveryRequest;
    context: ProviderSendContext;
    destinationAllowed: boolean;
    consentRequired: boolean;
  }) {
    const authorization = this.authorization(input.provider);
    const destinationRef = input.destinationAllowed
      ? `${input.provider}:allowlisted-destination`
      : `${input.provider}:unlisted-destination`;
    const allowlistedDestinationRef = `${input.provider}:allowlisted-destination`;
    const decision = evaluateProviderActivationPolicy(
      {
        provider: input.provider,
        requestProvider: input.request.provider,
        providerMode: this.config.providerMode,
        runtimeEnvironment: this.config.runtimeEnvironment,
        transportEnabled: this.config.transportEnabled,
        isolatedStagingProof:
          this.config.stagingCanaryProof ??
          (this.config.stagingIsolationProof ? 'legacy-staging-isolation-proof' : null),
        authorization,
        destinationRef,
        allowlistedDestinationRef,
        idempotencyKey: input.request.idempotencyKey,
        consent: {
          required: input.consentRequired,
          granted: true,
          suppressionState: 'active',
        },
        timeoutMs: this.config.providerTimeoutMs,
        leaseMsRemaining: Number.MAX_SAFE_INTEGER,
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
      provider: input.provider,
    });
  }

  private authorization(provider: ProviderName): DeliveryProviderAuthorization | null {
    if (this.config.authorizationArtifactId) {
      return {
        artifactId: this.config.authorizationArtifactId,
        provider,
        environment: this.config.runtimeEnvironment,
      };
    }
    if (provider === 'resend' && this.config.resendAuthorized) {
      return {
        artifactId: 'legacy-resend-canary-authorization',
        provider,
        environment: this.config.runtimeEnvironment,
      };
    }
    if (provider === 'one_time_wapi' && this.config.wapiAuthorized) {
      return {
        artifactId: 'legacy-wapi-canary-authorization',
        provider,
        environment: this.config.runtimeEnvironment,
      };
    }
    return null;
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
