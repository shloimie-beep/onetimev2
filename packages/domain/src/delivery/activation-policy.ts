import type { DeliveryChannel, DeliveryRequest } from '../../../contracts/src/delivery/types.ts';

export const DELIVERY_RUNTIME_ENVIRONMENTS = [
  'local',
  'test',
  'isolated_staging',
  'production',
] as const;
export type DeliveryRuntimeEnvironment = (typeof DELIVERY_RUNTIME_ENVIRONMENTS)[number];

export const DELIVERY_PROVIDER_MODES = ['sink', 'mock', 'provider'] as const;
export type DeliveryProviderMode = (typeof DELIVERY_PROVIDER_MODES)[number];

export type DeliveryProviderIdentifier =
  | 'resend'
  | 'one_time_wapi'
  | 'telegram'
  | 'zoom'
  | 'vimeo'
  | 'buffer'
  | 'stripe'
  | 'openai'
  | 'bna_support';

export type DeliveryActivationBlocker =
  | 'provider_transport_disabled'
  | 'provider_mode_not_enabled'
  | 'provider_mismatch'
  | 'environment_not_authorized'
  | 'isolated_staging_proof_missing'
  | 'production_authorization_missing'
  | 'provider_authorization_missing'
  | 'allowlisted_destination_missing'
  | 'idempotency_key_missing'
  | 'consent_missing'
  | 'suppression_active'
  | 'budget_exhausted'
  | 'timeout_exceeds_lease_margin'
  | 'audit_context_missing';

export type DeliveryConsentGate = {
  readonly required: boolean;
  readonly granted: boolean;
  readonly suppressionState: string;
};

export type DeliveryProviderAuthorization = {
  readonly artifactId: string;
  readonly provider: DeliveryProviderIdentifier;
  readonly environment: DeliveryRuntimeEnvironment;
};

export type DeliveryActivationAuditContext = {
  readonly deliveryKey: string;
  readonly eventType: string;
  readonly channel: DeliveryChannel;
};

export type DeliveryActivationPolicyInput = {
  readonly provider: DeliveryProviderIdentifier;
  readonly requestProvider: DeliveryRequest['provider'];
  readonly providerMode: DeliveryProviderMode;
  readonly runtimeEnvironment: DeliveryRuntimeEnvironment;
  readonly transportEnabled: boolean;
  readonly isolatedStagingProof: string | null;
  readonly authorization: DeliveryProviderAuthorization | null;
  readonly destinationRef: string | null;
  readonly allowlistedDestinationRef: string | null;
  readonly idempotencyKey: string | null;
  readonly consent: DeliveryConsentGate;
  readonly timeoutMs: number;
  readonly leaseMsRemaining: number;
  readonly leaseSafetyMarginMs: number;
  readonly auditContext: DeliveryActivationAuditContext | null;
};

export type DeliveryActivationSnapshot = {
  readonly provider: DeliveryProviderIdentifier;
  readonly providerMode: DeliveryProviderMode;
  readonly runtimeEnvironment: DeliveryRuntimeEnvironment;
  readonly blockerCodes: readonly DeliveryActivationBlocker[];
  readonly budget: {
    readonly perRunRemaining: number;
    readonly perProviderRemaining: number;
  };
  readonly readiness: 'blocked' | 'allowed';
};

export type DeliveryActivationDecision =
  | (DeliveryActivationSnapshot & {
      readonly readiness: 'allowed';
      readonly idempotencyKey: string;
    })
  | (DeliveryActivationSnapshot & {
      readonly readiness: 'blocked';
    });

export type DeliveryProviderBudgetConfig = {
  readonly perRunLimit: number;
  readonly perProviderLimit: number;
};

export class InMemoryDeliveryProviderBudget {
  private perRunUsed = 0;
  private readonly perProviderUsed = new Map<DeliveryProviderIdentifier, number>();

  constructor(private readonly config: DeliveryProviderBudgetConfig) {}

  snapshot(provider: DeliveryProviderIdentifier) {
    return {
      perRunRemaining: Math.max(0, this.config.perRunLimit - this.perRunUsed),
      perProviderRemaining: Math.max(
        0,
        this.config.perProviderLimit - (this.perProviderUsed.get(provider) ?? 0),
      ),
    };
  }

  canReserve(provider: DeliveryProviderIdentifier) {
    const snapshot = this.snapshot(provider);
    return snapshot.perRunRemaining > 0 && snapshot.perProviderRemaining > 0;
  }

  reserve(provider: DeliveryProviderIdentifier) {
    if (!this.canReserve(provider)) return false;
    this.perRunUsed += 1;
    this.perProviderUsed.set(provider, (this.perProviderUsed.get(provider) ?? 0) + 1);
    return true;
  }
}

export function classifyDeliveryRuntimeEnvironment(
  value: string | undefined,
  nodeEnv: string | undefined,
): DeliveryRuntimeEnvironment {
  if (value && isRuntimeEnvironment(value)) return value;
  if (nodeEnv === 'test') return 'test';
  return 'local';
}

export function evaluateProviderActivationPolicy(
  input: DeliveryActivationPolicyInput,
  budget: InMemoryDeliveryProviderBudget,
): DeliveryActivationDecision {
  const blockerCodes = blockers(input, budget);
  if (blockerCodes.length === 0 && !budget.reserve(input.provider)) {
    blockerCodes.push('budget_exhausted');
  }
  const snapshot = {
    provider: input.provider,
    providerMode: input.providerMode,
    runtimeEnvironment: input.runtimeEnvironment,
    blockerCodes,
    budget: budget.snapshot(input.provider),
  };
  if (blockerCodes.length > 0 || !input.idempotencyKey) {
    return { ...snapshot, readiness: 'blocked' };
  }
  return {
    ...snapshot,
    readiness: 'allowed',
    idempotencyKey: input.idempotencyKey,
  };
}

export function providerOperationIdempotencyKey(idempotencyKey: string) {
  return idempotencyKey;
}

function blockers(
  input: DeliveryActivationPolicyInput,
  budget: InMemoryDeliveryProviderBudget,
): DeliveryActivationBlocker[] {
  const output: DeliveryActivationBlocker[] = [];
  if (!input.transportEnabled) output.push('provider_transport_disabled');
  if (input.providerMode !== 'provider') output.push('provider_mode_not_enabled');
  if (input.provider !== input.requestProvider) output.push('provider_mismatch');
  if (input.runtimeEnvironment !== 'isolated_staging' && input.runtimeEnvironment !== 'test') {
    output.push('environment_not_authorized');
  }
  if (input.runtimeEnvironment === 'isolated_staging' && !input.isolatedStagingProof) {
    output.push('isolated_staging_proof_missing');
  }
  if (input.runtimeEnvironment === 'production') output.push('production_authorization_missing');
  if (
    !input.authorization ||
    input.authorization.provider !== input.provider ||
    input.authorization.environment !== input.runtimeEnvironment
  ) {
    output.push('provider_authorization_missing');
  }
  if (
    !input.destinationRef ||
    !input.allowlistedDestinationRef ||
    input.destinationRef !== input.allowlistedDestinationRef
  ) {
    output.push('allowlisted_destination_missing');
  }
  if (!input.idempotencyKey) output.push('idempotency_key_missing');
  if (input.consent.suppressionState !== 'active') output.push('suppression_active');
  if (input.consent.required && !input.consent.granted) output.push('consent_missing');
  if (!budget.canReserve(input.provider)) output.push('budget_exhausted');
  if (input.timeoutMs + input.leaseSafetyMarginMs >= input.leaseMsRemaining) {
    output.push('timeout_exceeds_lease_margin');
  }
  if (
    !input.auditContext?.deliveryKey ||
    !input.auditContext.eventType ||
    !input.auditContext.channel
  ) {
    output.push('audit_context_missing');
  }
  return [...new Set(output)];
}

function isRuntimeEnvironment(value: string): value is DeliveryRuntimeEnvironment {
  return (DELIVERY_RUNTIME_ENVIRONMENTS as readonly string[]).includes(value);
}
