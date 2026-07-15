# OT-87 Resume

## Current State

Local OT-87 implementation and verification are complete on branch `codex/ot87-stripe-test-entitlements` from source SHA `a02d1d254ae0d17804fb657079a7871567260ea2`.

State is `WAITING_FOR_STRIPE_TEST_RESOURCES` because protected Stripe TEST resources are absent in this environment. No live charges, live resources, TEST charges, TEST resources, Checkout Sessions, subscriptions, refunds, disputes, or webhook deliveries were created.

## Next Safe Commands

```powershell
cd C:\Users\User\onetimev2-ot87-stripe-test-entitlements
git status --short --branch
git log --oneline --decorate -5
```

When protected Stripe TEST resources are configured outside the repo, validate without exposing values:

```powershell
$env:LIVE_STRIPE_CHARGES_AUTHORIZED='NO'
npm run stripe:test:resources:validate -- --output=ops/codex-runs/OT-87/stripe-test-resources-validate.json
```

Default reconciliation dry run after a safe test database is available:

```powershell
$env:LIVE_STRIPE_CHARGES_AUTHORIZED='NO'
npm run billing:reconcile:test -- --scope=family --dry-run --output=ops/codex-runs/OT-87/reconciliation/dry-run.json
```

Canaries remain blocked until validation succeeds and the explicit canary gate is set.

## Forbidden Without Later Gates

- Do not create live Stripe resources.
- Do not create live charges.
- Do not deploy or merge.
- Do not run Stripe TEST resource setup without `LIVE_STRIPE_CHARGES_AUTHORIZED=NO`, `ONE_TIME_STRIPE_TEST_RESOURCE_SETUP_AUTHORIZED=YES`, and `--apply`.
- Do not run Stripe TEST canaries without `LIVE_STRIPE_CHARGES_AUTHORIZED=NO`, `ONE_TIME_STRIPE_TEST_CANARY_AUTHORIZED=YES`, green local tests, and resource validation.
- Do not run reconciliation apply without `ONE_TIME_STRIPE_TEST_RECONCILIATION_APPLY_AUTHORIZED=YES` and `--apply`.
