# OT-46 Integration Manifest

## Status

Merge-ready fixture-only foundation with real PostgreSQL proof pending. No deployment or Stripe mutation is authorized or performed.

## Direct Exports And Import Paths

- Contracts/types: `packages/contracts/src/billing/index.ts`
- Config parser: `packages/domain/src/billing/config.ts`
- Fixture provider adapter: `packages/domain/src/billing/fixture-adapter.ts`
- Network guard: `packages/domain/src/billing/network-guard.ts`
- Return-path builder: `packages/domain/src/billing/return-paths.ts`
- Entitlement policy: `packages/domain/src/billing/policy.ts`
- Service factory: `packages/domain/src/billing/service.ts`
- Repository factory: `packages/db/src/billing/repository.ts`
- Router factory: `apps/web/src/server/features/billing/router.ts`
- Optional reference UI: `apps/web/src/client/features/billing/BillingPanel.tsx`

No package barrel exports were edited. Consumers must import direct feature subpaths until the later integrator wires central exports.

## Router Registration Order

Do not edit `apps/web/src/server/app.ts` in this branch. Later integration should mount billing explicitly.

Required webhook order:

1. Mount `/api/billing/webhooks/provider` with raw body before global JSON parsing, or mount the OT-46 router before parsed-body middleware.
2. Keep `express.raw({ type: '*/*', limit: '64kb' })` for the provider webhook route.
3. Mount JSON handlers for checkout, portal, summary, invoices, and reconciliation after auth/CSRF dependencies are available.

## Injected Dependencies

- `BillingFeatureConfig`
- `BillingAuthorizationAdapter`
- `BillingProviderAdapter`
- `createPostgresBillingRepositories(pool)`
- authenticated actor resolver
- CSRF verifier
- clock/id generator where deterministic tests need them
- logger/audit sink

## Migration

- File: `packages/db/migrations/1300_ot46_billing_foundation.sql`
- SHA-256: `DBF2F4F6152985496906455561FBD7D6F9032DC91044B4A746A3CF5396427738`
- Reserved namespace: 1300-1399

## Config

All defaults disabled. Proposed names:

- `ONE_TIME_BILLING_FOUNDATION_ENABLED`
- `ONE_TIME_BILLING_TRANSPORT_ENABLED`
- `ONE_TIME_BILLING_CHECKOUT_ENABLED`
- `ONE_TIME_BILLING_CUSTOMER_PORTAL_ENABLED`
- `ONE_TIME_BILLING_WEBHOOK_INTAKE_ENABLED`
- `ONE_TIME_BILLING_RECONCILIATION_ENABLED`
- `ONE_TIME_BILLING_MODE`
- `ONE_TIME_BILLING_CANONICAL_PUBLIC_ORIGIN`
- `ONE_TIME_BILLING_EXPECTED_PROVIDER_ACCOUNT_REF`
- `ONE_TIME_BILLING_OFFERS_JSON`

No legacy aliases, fallback names, live keys, live event flags, or real Stripe SDK integration are accepted in this branch.

## Central Files Intentionally Untouched

- `apps/web/src/server/app.ts`
- root `package.json`
- root `package-lock.json`
- package barrel exports
- Vite configs
- workflows
- existing migrations

## Expected Integration Collisions

- Auth/portal integration must provide canonical billing-principal authorization.
- App composition must decide route prefix and raw-body ordering.
- Future Stripe SDK adapter must remain behind `BillingProviderAdapter`.
- Real commercial policy for trials, tax, cancellation, refunds, delinquency, and migration remains unresolved and must not be inferred.

## Tests Later Integrator Must Rerun

- `npm run secret:scan`
- `npm run lint`
- `npm run typecheck`
- `npm run unit`
- `npm run integration`
- `npm run build`
- focused OT-46 unit/integration tests
- real PostgreSQL 16 migration/concurrency proof
- bundle scan proving public landing/signup do not import billing/Stripe

## Guarantees

- Fixture-only adapter.
- Zero Stripe network calls.
- Zero external provider mutations.
- Feature flags default off.
- Public signup remains independent of billing.
- Checkout/session creation never grants entitlement or access.
