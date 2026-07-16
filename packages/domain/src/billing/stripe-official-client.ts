import Stripe from 'stripe';
import type { BillingSubscriptionStatus } from '../../../contracts/src/billing/index.ts';
import type { StripeTestClient, StripeTestEvent } from './stripe-test-adapter.ts';

export function createOfficialStripeTestClient(secretKey: string): StripeTestClient {
  const stripe = new Stripe(secretKey);
  return {
    checkout: {
      sessions: {
        create: async (params, options) =>
          stripe.checkout.sessions.create(params as Stripe.Checkout.SessionCreateParams, options),
      },
    },
    billingPortal: {
      sessions: {
        create: async (params, options) =>
          stripe.billingPortal.sessions.create(
            params as Stripe.BillingPortal.SessionCreateParams,
            options,
          ),
      },
    },
    webhooks: {
      constructEvent: (rawBody, signatureHeader, secret) =>
        stripe.webhooks.constructEvent(
          rawBody,
          signatureHeader,
          secret,
        ) as unknown as StripeTestEvent,
    },
    customers: {
      create: async (params, options) =>
        stripe.customers.create(params as Stripe.CustomerCreateParams, options),
      retrieve: async (providerCustomerRef) => {
        const customer = await stripe.customers.retrieve(providerCustomerRef);
        if (customer.deleted) return { id: customer.id, deleted: true };
        return { id: customer.id };
      },
    },
    subscriptions: {
      retrieve: async (providerSubscriptionRef) => {
        const subscription = await stripe.subscriptions.retrieve(providerSubscriptionRef);
        return {
          id: subscription.id,
          status: normalizeStatus(subscription.status),
        };
      },
    },
    invoices: {
      retrieve: async (providerInvoiceRef) => {
        const invoice = await stripe.invoices.retrieve(providerInvoiceRef);
        return { id: invoice.id ?? providerInvoiceRef, status: invoice.status ?? 'unknown' };
      },
    },
  };
}

function normalizeStatus(status: Stripe.Subscription.Status): BillingSubscriptionStatus {
  if (
    status === 'trialing' ||
    status === 'active' ||
    status === 'canceled' ||
    status === 'past_due' ||
    status === 'unpaid' ||
    status === 'incomplete' ||
    status === 'incomplete_expired' ||
    status === 'paused'
  ) {
    return status;
  }
  return 'unknown';
}
