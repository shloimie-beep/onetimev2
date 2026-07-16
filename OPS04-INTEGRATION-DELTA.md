# OPS04 Integration Delta

OT-105 exports the billing integration factories from `packages/domain/src/index.ts`
and the billing DTO/contracts from `packages/contracts/src/index.ts` so OPS04 can
wire billing through public package surfaces.

## Use These Factories

- `parseOt87StripeTestBillingConfig`
- `readOt87StripeRuntimeSecrets`
- `billingConfigSnapshot`
- `createOfficialStripeTestClient`
- `createStripeTestBillingProviderAdapter`
- `createBillingServices`
- `createFixtureBillingProviderAdapter`
- `loadOt87CommercialPolicy`
- `evaluateBillingEntitlement`
- `householdHasLearningAccess`

## Mount Order

Mount `/api/v1/billing/webhooks/provider` with raw body handling before any
global JSON parser. The current app already mounts `createBillingRouter` before
`express.json`, and the router applies `express.raw({ type: '*/*', limit: '64kb' })`
to the provider webhook route.

## Staging Webhook

The corrected TEST webhook endpoint is:

```text
https://ot99-web-staging.up.railway.app/api/v1/billing/webhooks/provider
```

Do not wire Stripe to the homepage, Checkout success URL, or public landing
redirect.

## Guardrails

- Stripe mode remains TEST only.
- `LIVE_STRIPE_CHARGES_AUTHORIZED` must equal `NO` before test transport is
  enabled.
- Missing protected TEST configuration blocks only the external provider canary.
- No live Stripe action, real charge, credential write, production DB mutation,
  deployment, DNS/Railway mutation, or access grant is authorized by this delta.
