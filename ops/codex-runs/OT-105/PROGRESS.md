# OT-105 Progress

## 2026-07-16

- Registered OT-105 in a dedicated worktree on `codex/ot105-stripe-test-billing-canary` from requested base SHA `fb3c397ce8ece100cf7873fdddcd940a1552ea9b`.
- Confirmed the corrected webhook route is `https://ot99-web-staging.up.railway.app/api/v1/billing/webhooks/provider`; the old homepage redirect is not treated as a valid webhook target.
- Added TEST-only Stripe environment contract, operator canary script, runbook, and integration delta.
- Hardened signed webhook handling for stale signatures, wrong product/price/currency/amount, wrong principal/scope, and unknown valid events.
- Added subscription trial warning to the bounded commercial event set.
- Added product reference extraction to fixture and Stripe adapters.
- Added canonical subscription readback for ambiguous stale subscription events.
- Added exports for billing integration factories and related contracts.
- Added focused OT-105 integration tests and preserved OT-87/OT-46 focused billing coverage.

## Verification

- `npm run typecheck`: passed.
- `npx vitest run --config vitest.integration.config.ts tests/integration/ot105-stripe-test-billing-canary.test.ts tests/integration/ot87-billing-entitlements.test.ts tests/integration/ot46-billing-services.test.ts`: passed, 3 files and 16 tests.
- `npx vitest run --config vitest.unit.config.ts tests/unit/ot46-billing-config-policy.test.ts`: passed, 1 file and 17 tests.
- `npm run lint`: passed.
- `npm run secret:scan`: passed.
- `npm run build`: passed.
- `npm run stripe:test:canary -- --output ops/codex-runs/OT-105/canary/readiness.json`: expected block, no mutations, no live calls, no credential writes.

## Remaining External Step

The real Stripe TEST canary remains blocked until the protected staging config and explicit `OT105_STRIPE_TEST_CANARY_AUTHORIZED=true` approval are provided.
