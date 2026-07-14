import type {
  BillingDisposition,
  BillingEntitlementProjection,
  BillingInvoiceSummary,
  BillingMode,
  BillingOfferPriceMapping,
  BillingPrincipalRef,
  BillingProvider,
  BillingProviderAccountRef,
  BillingReconciliationResult,
  BillingSubscriptionProjection,
  CheckoutSessionResult,
  CustomerPortalSessionResult,
  VerifiedProviderEventEnvelope,
} from '../../../contracts/src/billing/index.ts';
export {
  billingModeSchema,
  billingOfferPriceMappingSchema,
} from '../../../contracts/src/billing/index.ts';
export type {
  BillingDisposition,
  BillingEntitlementProjection,
  BillingInvoiceSummary,
  BillingMode,
  BillingOfferPriceMapping,
  BillingPrincipalRef,
  BillingProvider,
  BillingProviderAccountRef,
  BillingReconciliationResult,
  BillingSubscriptionProjection,
  CheckoutSessionResult,
  CustomerPortalSessionResult,
  VerifiedProviderEventEnvelope,
};

export type BillingFeatureConfig = {
  foundationEnabled: boolean;
  transportEnabled: boolean;
  checkoutEnabled: boolean;
  customerPortalEnabled: boolean;
  webhookIntakeEnabled: boolean;
  reconciliationEnabled: boolean;
  mode: BillingMode;
  canonicalPublicOrigin: string | null;
  expectedProviderAccountRef: string | null;
  offerMappings: BillingOfferPriceMapping[];
  configFingerprint: string;
};

export type BillingActorContext = {
  actor_key: string;
  role: 'owner' | 'admin' | 'crm_agent' | 'viewer' | 'public';
  active: boolean;
};

export type BillingAuthorizationResult =
  | {
      ok: true;
      principal: BillingPrincipalRef;
      capabilities: Array<
        | 'billing:read'
        | 'billing:checkout'
        | 'billing:portal'
        | 'billing:reconcile'
        | 'billing:webhook'
      >;
    }
  | {
      ok: false;
      reason:
        | 'anonymous'
        | 'inactive_session'
        | 'wrong_scope'
        | 'insufficient_capability'
        | 'archived_mapping'
        | 'unknown_principal';
    };

export interface BillingAuthorizationAdapter {
  resolvePrincipal(input: {
    actor: BillingActorContext;
    requested_principal_key: string;
  }): Promise<BillingAuthorizationResult>;
}

export interface BillingAuditSink {
  record(event: {
    event_type: string;
    account_key?: string;
    product_key?: string;
    principal_key?: string;
    metadata?: Record<string, unknown>;
  }): Promise<void> | void;
}

export interface BillingLogger {
  info(event: Record<string, unknown>): void;
  warn(event: Record<string, unknown>): void;
  error(event: Record<string, unknown>): void;
}
