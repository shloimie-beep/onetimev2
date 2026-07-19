import { createHash } from 'node:crypto';
import {
  checkoutRequestSchema,
  customerPortalRequestSchema,
  reconciliationRequestSchema,
  type BillingDisposition,
  type BillingProviderAdapter,
  type BillingProviderAccountRef,
  type BillingSummaryDto,
  type CheckoutRequestDto,
  type CustomerPortalRequestDto,
  type ProviderEventObjectRefs,
  type ProviderVerifiedEvent,
  type ReconciliationRequestDto,
  type VerifiedProviderEventEnvelope,
} from '../../../contracts/src/billing/index.ts';
import type { createPostgresBillingRepositories } from '../../../db/src/billing/repository.ts';
import { buildBillingReturnPaths } from './return-paths.ts';
import { evaluateBillingEntitlement } from './policy.ts';
import type {
  BillingActorContext,
  BillingAuditSink,
  BillingAuthorizationAdapter,
  BillingFeatureConfig,
  BillingLogger,
  BillingPrincipalRef,
  BillingSubscriptionProjection,
} from './types.ts';

type BillingRepositories = ReturnType<typeof createPostgresBillingRepositories>;
type BillingCapability =
  'billing:read' | 'billing:checkout' | 'billing:portal' | 'billing:reconcile' | 'billing:webhook';

type WebhookProcessResult = {
  disposition: BillingDisposition;
  reason: string;
  status: number;
};

type BillingServicesDeps = {
  config: BillingFeatureConfig;
  repositories: BillingRepositories;
  authorization: BillingAuthorizationAdapter;
  providerAdapter: BillingProviderAdapter;
  auditSink?: BillingAuditSink;
  logger?: BillingLogger;
  clock?: () => Date;
};

type ServiceResult<T> =
  { ok: true; value: T } | { ok: false; code: string; message: string; status: number };

export function createBillingServices(deps: BillingServicesDeps) {
  const clock = deps.clock ?? (() => new Date());

  async function withPrincipal(
    actor: BillingActorContext,
    requestedPrincipalKey: string,
    capability: BillingCapability,
  ): Promise<ServiceResult<BillingPrincipalRef>> {
    if (!deps.config.foundationEnabled)
      return denied('BILLING_DISABLED', 'Billing is disabled.', 404);
    const auth = await deps.authorization.resolvePrincipal({
      actor,
      requested_principal_key: requestedPrincipalKey,
    });
    if (!auth.ok) return denied('FORBIDDEN', 'Billing is not available for this session.', 403);
    if (!auth.capabilities.includes(capability)) {
      return denied('FORBIDDEN', 'Billing is not available for this role.', 403);
    }
    return { ok: true, value: auth.principal };
  }

  function providerAccount(): ServiceResult<BillingProviderAccountRef> {
    if (!deps.config.expectedProviderAccountRef) {
      return denied('BILLING_NOT_CONFIGURED', 'Billing provider is not configured.', 503);
    }
    return {
      ok: true,
      value: {
        provider: 'stripe',
        mode: deps.config.mode,
        provider_account_ref: deps.config.expectedProviderAccountRef,
      },
    };
  }

  return {
    async requestCheckoutSession(input: {
      actor: BillingActorContext;
      payload: CheckoutRequestDto | unknown;
    }) {
      if (!deps.config.transportEnabled || !deps.config.checkoutEnabled) {
        return denied('BILLING_CHECKOUT_DISABLED', 'Checkout is disabled.', 404);
      }
      const parsed = checkoutRequestSchema.safeParse(input.payload);
      if (!parsed.success) return denied('VALIDATION_ERROR', 'Checkout request is invalid.', 400);
      const principal = await withPrincipal(
        input.actor,
        parsed.data.principal_key,
        'billing:checkout',
      );
      if (!principal.ok) return principal;
      const account = providerAccount();
      if (!account.ok) return account;
      const paths = buildBillingReturnPaths(deps.config.canonicalPublicOrigin);
      const offer = deps.config.offerMappings.find(
        (candidate) =>
          candidate.account_key === principal.value.account_key &&
          candidate.product_key === principal.value.product_key &&
          candidate.offer_key === parsed.data.offer_key &&
          candidate.provider_account_ref === account.value.provider_account_ref &&
          candidate.mode === deps.config.mode,
      );
      if (!offer) return denied('OFFER_NOT_CONFIGURED', 'Billing offer is not configured.', 404);
      await deps.repositories.upsertProviderAccount(account.value);
      await deps.repositories.upsertOfferPrice(offer);
      const requestFingerprint = digest(
        JSON.stringify({
          principal: principal.value,
          offer_key: parsed.data.offer_key,
          idempotency_key: parsed.data.idempotency_key,
          version: parsed.data.version,
        }),
      );
      const started = await deps.repositories.startCheckoutSession({
        principal: principal.value,
        offer,
        idempotency_key: parsed.data.idempotency_key,
        request_fingerprint: requestFingerprint,
      });
      if (started.status === 'conflict') {
        return denied(
          'IDEMPOTENCY_CONFLICT',
          'This checkout idempotency key was already used for a different request.',
          409,
        );
      }
      if (started.status === 'replayed') return { ok: true as const, value: started.checkout };
      const providerCustomerRef = await deps.repositories.findCustomerMapping({
        principal: principal.value,
        providerAccount: account.value,
      });
      let provider;
      try {
        provider = await deps.providerAdapter.createCheckoutSession({
          principal: principal.value,
          providerAccount: account.value,
          offer,
          idempotencyKey: parsed.data.idempotency_key,
          localCheckoutRequestKey: started.checkoutRequestKey,
          policyVersion: deps.config.policyVersion,
          ...(providerCustomerRef ? { provider_customer_ref: providerCustomerRef } : {}),
          successUrl: paths.checkoutSuccessUrl,
          cancelUrl: paths.checkoutCancelUrl,
        });
      } catch {
        return denied('PROVIDER_UNAVAILABLE', 'Billing provider is unavailable.', 503);
      }
      if (provider.livemode || provider.mode !== deps.config.mode) {
        return denied('PROVIDER_MODE_REJECTED', 'Billing provider mode was rejected.', 502);
      }
      const result = await deps.repositories.recordCheckoutSession({
        principal: principal.value,
        offer,
        idempotency_key: parsed.data.idempotency_key,
        provider_checkout_session_ref: provider.provider_checkout_session_ref,
        provider_customer_ref: provider.provider_customer_ref,
        provider_subscription_ref: provider.provider_subscription_ref,
        redirect_url: provider.redirect_url,
      });
      await audit('billing_checkout_created', principal.value, {
        offer_key: offer.offer_key,
        entitlement_changed: false,
      });
      return { ok: true as const, value: result };
    },
    async requestCustomerPortalSession(input: {
      actor: BillingActorContext;
      payload: CustomerPortalRequestDto | unknown;
    }) {
      if (!deps.config.transportEnabled || !deps.config.customerPortalEnabled) {
        return denied('BILLING_PORTAL_DISABLED', 'Customer portal is disabled.', 404);
      }
      const parsed = customerPortalRequestSchema.safeParse(input.payload);
      if (!parsed.success) return denied('VALIDATION_ERROR', 'Portal request is invalid.', 400);
      const principal = await withPrincipal(
        input.actor,
        parsed.data.principal_key,
        'billing:portal',
      );
      if (!principal.ok) return principal;
      const account = providerAccount();
      if (!account.ok) return account;
      const providerCustomerRef = await deps.repositories.findCustomerMapping({
        principal: principal.value,
        providerAccount: account.value,
      });
      if (!providerCustomerRef) {
        return denied('NO_BILLING_CUSTOMER', 'Billing portal is not available yet.', 404);
      }
      const paths = buildBillingReturnPaths(deps.config.canonicalPublicOrigin);
      let provider;
      try {
        provider = await deps.providerAdapter.createCustomerPortalSession({
          principal: principal.value,
          providerAccount: account.value,
          provider_customer_ref: providerCustomerRef,
          ...(deps.config.providerPortalConfigurationRef
            ? { provider_portal_configuration_ref: deps.config.providerPortalConfigurationRef }
            : {}),
          idempotencyKey: parsed.data.idempotency_key,
          returnUrl: paths.portalReturnUrl,
        });
      } catch {
        return denied('PROVIDER_UNAVAILABLE', 'Billing provider is unavailable.', 503);
      }
      if (provider.livemode || provider.mode !== deps.config.mode) {
        return denied('PROVIDER_MODE_REJECTED', 'Billing provider mode was rejected.', 502);
      }
      await audit('billing_customer_portal_created', principal.value, {
        entitlement_changed: false,
      });
      return {
        ok: true as const,
        value: {
          portal_session_ref: provider.provider_portal_session_ref,
          redirect_url: provider.redirect_url,
          status: 'created' as const,
        },
      };
    },
    async receiveWebhook(input: {
      rawBody: Buffer | unknown;
      signatureHeader?: string | undefined;
      parsedBodyWasUsed?: boolean;
    }) {
      if (!deps.config.transportEnabled || !deps.config.webhookIntakeEnabled) {
        return denied('BILLING_WEBHOOK_DISABLED', 'Billing webhook intake is disabled.', 404);
      }
      if (input.parsedBodyWasUsed || !Buffer.isBuffer(input.rawBody)) {
        return disposition('parsed_body_misuse', 'Webhook raw bytes were not provided.', 400);
      }
      if (input.rawBody.byteLength > 64 * 1024) {
        return disposition('oversized', 'Webhook body exceeded billing limit.', 413);
      }
      const account = providerAccount();
      if (!account.ok) return account;
      let verified;
      try {
        verified = await deps.providerAdapter.verifyWebhook({
          rawBody: input.rawBody,
          signatureHeader: input.signatureHeader,
        });
      } catch {
        return disposition('invalid_signature', 'Webhook signature rejected.', 400);
      }
      if (verified.livemode)
        return disposition('live_mode_rejected', 'Live billing event rejected.', 400);
      if (verified.mode !== deps.config.mode)
        return disposition('wrong_mode', 'Billing mode mismatch.', 400);
      if (verified.provider_account_ref !== account.value.provider_account_ref) {
        return disposition('wrong_provider_account', 'Billing provider account mismatch.', 400);
      }
      const envelope = toEnvelope(verified, input.rawBody);
      const receipt = await deps.repositories.recordVerifiedEvent(envelope);
      if (receipt.status === 'duplicate') {
        await deps.repositories.recordAttempt({
          event_key: receipt.eventKey,
          disposition: 'duplicate',
          reason: 'duplicate_event_same_digest',
        });
        return disposition('duplicate', 'Billing event was already recorded.', 200);
      }
      if (receipt.status === 'digest_mismatch') {
        await deps.repositories.recordAttempt({
          event_key: receipt.eventKey,
          disposition: 'digest_mismatch',
          reason: 'same_event_id_different_digest',
        });
        return disposition('digest_mismatch', 'Billing event digest mismatch.', 409);
      }
      if (!deps.config.webhookProjectionEnabled) {
        await deps.repositories.recordAttempt({
          event_key: envelope.event_key,
          disposition: 'accepted',
          reason: 'webhook_projection_disabled',
        });
        return disposition('accepted', 'Billing event ledgered without projection.', 200);
      }
      const processed = await processVerifiedEvent(envelope, verified.object_refs, account.value);
      await deps.repositories.recordAttempt({
        event_key: envelope.event_key,
        disposition: processed.disposition,
        reason: processed.reason,
      });
      return disposition(processed.disposition, processed.reason, processed.status);
    },
    async billingSummary(input: { actor: BillingActorContext; principal_key: string }) {
      const principal = await withPrincipal(input.actor, input.principal_key, 'billing:read');
      if (!principal.ok) return principal;
      const summary = (await deps.repositories.summary(principal.value)) as BillingSummaryDto;
      return { ok: true as const, value: summary };
    },
    async invoiceSummaries(input: { actor: BillingActorContext; principal_key: string }) {
      const summary = await this.billingSummary(input);
      return summary.ok ? { ok: true as const, value: summary.value.invoices } : summary;
    },
    async requestReconciliation(input: {
      actor: BillingActorContext;
      payload: ReconciliationRequestDto | unknown;
    }) {
      if (!deps.config.transportEnabled || !deps.config.reconciliationEnabled) {
        return denied(
          'BILLING_RECONCILIATION_DISABLED',
          'Billing reconciliation is disabled.',
          404,
        );
      }
      const parsed = reconciliationRequestSchema.safeParse(input.payload);
      if (!parsed.success)
        return denied('VALIDATION_ERROR', 'Reconciliation request is invalid.', 400);
      const principal = await withPrincipal(
        input.actor,
        parsed.data.principal_key,
        'billing:reconcile',
      );
      if (!principal.ok) return principal;
      const account = providerAccount();
      if (!account.ok) return account;
      let provider;
      try {
        provider = await deps.providerAdapter.reconcileBillingPrincipal(principal.value);
      } catch {
        provider = {
          status: 'failed' as const,
          reason: 'provider_unavailable',
        };
      }
      const status = provider.status === 'succeeded' ? 'succeeded' : 'failed';
      const reconciliationKey = await deps.repositories.createReconciliation({
        principal: principal.value,
        providerAccount: account.value,
        idempotency_key: parsed.data.idempotency_key,
        reason: parsed.data.reason,
        status,
        result: { reason: provider.reason },
      });
      return {
        ok: true as const,
        value: {
          reconciliation_key: reconciliationKey,
          principal: principal.value,
          status,
          disposition: provider.status === 'succeeded' ? 'accepted' : 'provider_error',
          reason: provider.reason,
        },
      };
    },
  };

  async function processVerifiedEvent(
    envelope: VerifiedProviderEventEnvelope,
    refs: ProviderEventObjectRefs,
    providerAccountRef: BillingProviderAccountRef,
  ): Promise<WebhookProcessResult> {
    if (
      ![
        'checkout.session.completed',
        'checkout.session.expired',
        'customer.subscription.created',
        'customer.subscription.updated',
        'customer.subscription.deleted',
        'customer.subscription.trial_will_end',
        'customer.subscription.paused',
        'customer.subscription.resumed',
        'invoice.paid',
        'invoice.payment_failed',
        'invoice.payment_action_required',
        'charge.refunded',
        'charge.dispute.created',
        'charge.dispute.closed',
      ].includes(envelope.event_type)
    ) {
      return { disposition: 'unknown_event', reason: 'unknown_event_type', status: 202 };
    }
    if (!refs.provider_customer_ref) {
      return {
        disposition: 'wrong_customer_correlation',
        reason: 'event_missing_known_customer_ref',
        status: 202,
      };
    }
    const principal = await deps.repositories.findPrincipalByCustomer({
      providerAccount: providerAccountRef,
      provider_customer_ref: refs.provider_customer_ref,
    });
    if (!principal) {
      return {
        disposition: 'wrong_customer_correlation',
        reason: 'no_local_customer_mapping',
        status: 202,
      };
    }
    if (
      (refs.account_key && refs.account_key !== principal.account_key) ||
      (refs.product_key && refs.product_key !== principal.product_key) ||
      (refs.principal_key && refs.principal_key !== principal.principal_key)
    ) {
      return { disposition: 'wrong_scope', reason: 'event_scope_mismatch', status: 202 };
    }
    const commercialShape = validateCommercialShape(envelope.event_type, refs, principal);
    if (commercialShape) return commercialShape;

    if (envelope.event_type === 'checkout.session.completed') {
      if (!refs.provider_checkout_session_ref || !refs.provider_subscription_ref) {
        return {
          disposition: 'wrong_customer_correlation',
          reason: 'checkout_completed_missing_required_refs',
          status: 202,
        };
      }
      const checkoutPrincipal = await deps.repositories.markCheckoutCompleted({
        provider_checkout_session_ref: refs.provider_checkout_session_ref,
        provider_customer_ref: refs.provider_customer_ref,
        provider_subscription_ref: refs.provider_subscription_ref,
      });
      if (!checkoutPrincipal || checkoutPrincipal.principal_key !== principal.principal_key) {
        return {
          disposition: 'wrong_customer_correlation',
          reason: 'checkout_completed_missing_local_request_correlation',
          status: 202,
        };
      }
      await audit('billing_checkout_completed', principal, {
        entitlement_changed: false,
        reason: 'checkout_completion_alone_never_grants_access',
      });
      return {
        disposition: 'accepted',
        reason: 'checkout_completed_no_entitlement_change',
        status: 200,
      };
    }

    if (envelope.event_type === 'checkout.session.expired') {
      if (refs.provider_checkout_session_ref) {
        await deps.repositories.markCheckoutExpired({
          provider_checkout_session_ref: refs.provider_checkout_session_ref,
        });
      }
      return {
        disposition: 'accepted',
        reason: 'checkout_expired_no_entitlement_change',
        status: 200,
      };
    }

    if (envelope.event_type.startsWith('customer.subscription.')) {
      const subscription = subscriptionProjection(principal, envelope, refs);
      const projection = await deps.repositories.upsertSubscriptionProjection(subscription);
      if (projection.status === 'stale') {
        await readBackAmbiguousSubscription(subscription.provider_subscription_ref);
        return {
          disposition: 'stale_event',
          reason: 'older_subscription_event_ignored_after_provider_readback',
          status: 202,
        };
      }
      if (projection.status === 'contradictory') {
        await readBackAmbiguousSubscription(subscription.provider_subscription_ref);
        const entitlement = evaluateBillingEntitlement({
          principal,
          subscription,
          source: envelope.event_key,
          effectiveAt: new Date(subscription.provider_updated_at),
          evaluatedAt: clock(),
          reconciliationConfidence: 'contradictory',
          policyVersion: deps.config.policyVersion,
          emergencyMode: deps.config.entitlementEmergencyMode,
        });
        await deps.repositories.upsertEntitlementProjection(entitlement);
        return {
          disposition: 'contradictory_event',
          reason: 'equal_time_subscription_contradiction',
          status: 202,
        };
      }
      const entitlement = await recomputeEntitlement(principal, envelope.event_key, subscription);
      await audit('billing_subscription_projected', principal, {
        event_type: envelope.event_type,
        entitlement_status: entitlement.status,
      });
      return { disposition: 'accepted', reason: 'subscription_projection_updated', status: 200 };
    }

    if (refs.provider_invoice_ref) {
      await deps.repositories.insertInvoiceSummary({
        ...principal,
        provider: envelope.provider,
        mode: envelope.mode,
        provider_account_ref: envelope.provider_account_ref,
        provider_invoice_ref: refs.provider_invoice_ref,
        provider_subscription_ref: refs.provider_subscription_ref ?? null,
        status: invoiceStatusForEvent(envelope.event_type),
        currency: (refs.currency ?? 'usd').toLowerCase(),
        amount_due_cents: refs.amount_due_cents ?? 0,
        amount_paid_cents: refs.amount_paid_cents ?? 0,
        refunded_amount_cents: refs.refunded_amount_cents ?? 0,
        dispute_state: refs.dispute_state ?? 'none',
        issued_at: refs.issued_at ?? envelope.provider_created_at,
        source_event_key: envelope.event_key,
      });
      const entitlement = await recomputeEntitlement(principal, envelope.event_key);
      await audit('billing_invoice_projected', principal, {
        event_type: envelope.event_type,
        entitlement_status: entitlement.status,
      });
      return { disposition: 'accepted', reason: 'invoice_summary_updated', status: 200 };
    }
    return {
      disposition: 'manual_review',
      reason: 'invoice_event_missing_invoice_ref',
      status: 202,
    };
  }

  async function audit(
    eventType: string,
    principal: BillingPrincipalRef,
    metadata: Record<string, unknown>,
  ) {
    await deps.repositories.audit({
      account_key: principal.account_key,
      product_key: principal.product_key,
      principal_key: principal.principal_key,
      event_type: eventType,
      metadata,
    });
    await deps.auditSink?.record({
      account_key: principal.account_key,
      product_key: principal.product_key,
      principal_key: principal.principal_key,
      event_type: eventType,
      metadata,
    });
    deps.logger?.info({
      event_type: eventType,
      account_key: principal.account_key,
      product_key: principal.product_key,
    });
  }

  async function recomputeEntitlement(
    principal: BillingPrincipalRef,
    source: string,
    suppliedSubscription?: BillingSubscriptionProjection,
  ) {
    const subscription =
      suppliedSubscription ?? (await deps.repositories.currentSubscription(principal));
    const invoice = subscription
      ? await deps.repositories.currentInvoiceForSubscription({
          principal,
          provider_subscription_ref: subscription.provider_subscription_ref,
          provider_invoice_ref: subscription.latest_invoice_ref,
        })
      : null;
    const effectiveAt = subscription
      ? new Date(subscription.provider_updated_at)
      : invoice?.issued_at
        ? new Date(invoice.issued_at)
        : clock();
    const entitlement = evaluateBillingEntitlement({
      principal,
      subscription,
      currentInvoice: invoice,
      source,
      effectiveAt,
      evaluatedAt: clock(),
      reconciliationConfidence: 'verified',
      policyVersion: deps.config.policyVersion,
      emergencyMode: deps.config.entitlementEmergencyMode,
    });
    await deps.repositories.upsertEntitlementProjection(entitlement);
    return entitlement;
  }

  async function readBackAmbiguousSubscription(providerSubscriptionRef: string) {
    try {
      await deps.providerAdapter.retrieveSubscription(providerSubscriptionRef);
    } catch {
      deps.logger?.warn({
        event_type: 'billing_ambiguous_subscription_readback_failed',
        provider_subscription_ref: digest(providerSubscriptionRef),
      });
    }
  }

  function validateCommercialShape(
    eventType: string,
    refs: ProviderEventObjectRefs,
    principal: BillingPrincipalRef,
  ): WebhookProcessResult | null {
    const offer = deps.config.offerMappings.find(
      (candidate) =>
        candidate.account_key === principal.account_key &&
        candidate.product_key === principal.product_key &&
        (!refs.offer_key || candidate.offer_key === refs.offer_key) &&
        (!refs.provider_price_ref || candidate.provider_price_ref === refs.provider_price_ref),
    );
    if ((refs.offer_key || refs.provider_price_ref) && !offer) {
      return {
        disposition: 'wrong_offer',
        reason: 'event_offer_or_price_not_allowlisted',
        status: 202,
      };
    }
    if (
      refs.provider_product_ref &&
      deps.config.expectedProviderProductRef &&
      refs.provider_product_ref !== deps.config.expectedProviderProductRef
    ) {
      return {
        disposition: 'wrong_offer',
        reason: 'event_product_not_allowlisted',
        status: 202,
      };
    }
    if (!offer) return null;
    if (refs.currency && refs.currency.toLowerCase() !== offer.currency) {
      return { disposition: 'wrong_offer', reason: 'event_currency_mismatch', status: 202 };
    }
    if (isInvoiceEvent(eventType)) {
      if (refs.amount_due_cents !== undefined && refs.amount_due_cents !== offer.amount_cents) {
        return { disposition: 'wrong_offer', reason: 'event_amount_due_mismatch', status: 202 };
      }
      if (eventType === 'invoice.paid' && refs.amount_paid_cents !== offer.amount_cents) {
        return { disposition: 'wrong_offer', reason: 'event_amount_paid_mismatch', status: 202 };
      }
    }
    return null;
  }
}

function isInvoiceEvent(eventType: string) {
  return (
    eventType === 'invoice.paid' ||
    eventType === 'invoice.payment_failed' ||
    eventType === 'invoice.payment_action_required'
  );
}

function subscriptionProjection(
  principal: BillingPrincipalRef,
  envelope: VerifiedProviderEventEnvelope,
  refs: ProviderEventObjectRefs,
): BillingSubscriptionProjection {
  return {
    ...principal,
    provider: envelope.provider,
    mode: envelope.mode,
    provider_account_ref: envelope.provider_account_ref,
    provider_customer_ref: refs.provider_customer_ref ?? '',
    provider_subscription_ref:
      refs.provider_subscription_ref ?? `unknown_${envelope.provider_event_id}`,
    status: normalizeSubscriptionStatus(refs.status),
    current_period_start: refs.current_period_start ?? null,
    current_period_end: refs.current_period_end ?? null,
    cancel_at: refs.cancel_at ?? null,
    canceled_at: refs.canceled_at ?? null,
    cancel_at_period_end: refs.cancel_at_period_end ?? false,
    latest_invoice_ref: refs.latest_invoice_ref ?? null,
    collection_state: collectionStateForSubscription(refs.status),
    provider_updated_at: envelope.provider_created_at,
    source_event_key: envelope.event_key,
    projection_version: 1,
  };
}

function normalizeSubscriptionStatus(
  status: string | undefined,
): BillingSubscriptionProjection['status'] {
  const allowed = new Set([
    'trialing',
    'active',
    'canceled',
    'past_due',
    'unpaid',
    'incomplete',
    'incomplete_expired',
    'paused',
    'disputed',
    'refunded',
  ]);
  return allowed.has(status ?? '')
    ? (status as BillingSubscriptionProjection['status'])
    : 'unknown';
}

function collectionStateForSubscription(status: string | undefined) {
  if (status === 'past_due' || status === 'unpaid') return 'payment_failed' as const;
  return 'unknown' as const;
}

function invoiceStatusForEvent(eventType: string) {
  if (eventType === 'invoice.paid') return 'paid' as const;
  if (eventType === 'invoice.payment_failed') return 'payment_failed' as const;
  if (eventType === 'invoice.payment_action_required') return 'payment_action_required' as const;
  if (eventType === 'charge.refunded') return 'refunded' as const;
  if (eventType.startsWith('charge.dispute.')) return 'disputed' as const;
  return 'unknown' as const;
}

function toEnvelope(
  verified: ProviderVerifiedEvent,
  rawBody: Buffer,
): VerifiedProviderEventEnvelope {
  const rawBodyDigest = digest(rawBody);
  const payloadDigest = digest(
    JSON.stringify({
      minimized_payload: verified.minimized_payload,
      object_refs: verified.object_refs,
    }),
  );
  return {
    provider: verified.provider,
    mode: verified.mode,
    provider_account_ref: verified.provider_account_ref,
    provider_event_id: verified.provider_event_id,
    event_type: verified.event_type,
    provider_created_at: verified.provider_created_at,
    livemode: false,
    object_refs: verified.object_refs,
    minimized_payload: verified.minimized_payload,
    event_key: `billing_event_${verified.provider}_${verified.mode}_${digest(`${verified.provider_account_ref}:${verified.provider_event_id}`).slice(0, 24)}`,
    raw_body_digest: rawBodyDigest,
    payload_digest: payloadDigest,
  };
}

function digest(value: string | Buffer) {
  return createHash('sha256').update(value).digest('hex');
}

function denied(code: string, message: string, status: number): ServiceResult<never> {
  return { ok: false, code, message, status };
}

function disposition(
  code: string,
  message: string,
  status: number,
): ServiceResult<{ disposition: string; reason: string }> {
  if (status >= 400) return denied(code.toUpperCase(), message, status);
  return { ok: true as const, value: { disposition: code, reason: message } };
}
