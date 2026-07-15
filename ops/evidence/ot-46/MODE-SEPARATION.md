# OT-46 Mode Separation

## Config

Feature-local parser: `packages/domain/src/billing/config.ts`

- All flags default off.
- Only `test` mode is accepted.
- Unknown keys are rejected.
- Legacy aliases such as `STRIPE_*`, `RABBI_STRIPE_*`, `BNA_STRIPE_*`, and `ENABLE_PAYMENT_TRANSPORT` are rejected.
- Secret-shaped values such as `sk_*` and `whsec_*` are rejected without echoing values.
- Subfeatures cannot be enabled while umbrella transport is disabled.
- Domain code does not read `process.env`; the future integrator must pass an allowlisted key-value source.

## Proposed Standalone Config Names

- `ONE_TIME_BILLING_FOUNDATION_ENABLED=false`
- `ONE_TIME_BILLING_TRANSPORT_ENABLED=false`
- `ONE_TIME_BILLING_CHECKOUT_ENABLED=false`
- `ONE_TIME_BILLING_CUSTOMER_PORTAL_ENABLED=false`
- `ONE_TIME_BILLING_WEBHOOK_INTAKE_ENABLED=false`
- `ONE_TIME_BILLING_RECONCILIATION_ENABLED=false`
- `ONE_TIME_BILLING_MODE=test`
- `ONE_TIME_BILLING_CANONICAL_PUBLIC_ORIGIN=`
- `ONE_TIME_BILLING_EXPECTED_PROVIDER_ACCOUNT_REF=`
- `ONE_TIME_BILLING_OFFERS_JSON=[]`

No legacy fallback names are accepted.

## Provider Boundary

No Stripe SDK or network adapter is added. `BillingProviderAdapter` is a provider-neutral boundary with a deterministic `FixtureBillingProviderAdapter` only.
