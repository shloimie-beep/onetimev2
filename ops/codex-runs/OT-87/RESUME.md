# OT-87 Resume

## Current State

Initial run-state checkpoint is being created on branch `codex/ot87-stripe-test-entitlements` from source SHA `a02d1d254ae0d17804fb657079a7871567260ea2`.

## Next Safe Commands

```powershell
cd C:\Users\User\onetimev2-ot87-stripe-test-entitlements
git status --short --branch
git log --oneline --decorate -5
```

After the initial checkpoint is committed and pushed, continue with current-state inspection:

```powershell
rg -n "billing|stripe|checkout|portal|entitlement|household|learner|student access|ticker|hero" packages apps tests ops -g "*.*"
Get-ChildItem -LiteralPath packages\db\migrations -Filter *.sql | Sort-Object Name | Select-Object -Last 20 Name
```

## Forbidden Without Later Gates

- Do not create live Stripe resources.
- Do not create live charges.
- Do not deploy or merge.
- Do not run Stripe TEST resource setup without `LIVE_STRIPE_CHARGES_AUTHORIZED=NO`, `ONE_TIME_STRIPE_TEST_RESOURCE_SETUP_AUTHORIZED=YES`, and `--apply`.
- Do not run Stripe TEST canaries without `LIVE_STRIPE_CHARGES_AUTHORIZED=NO`, `ONE_TIME_STRIPE_TEST_CANARY_AUTHORIZED=YES`, green local tests, and resource validation.
- Do not run reconciliation apply without `ONE_TIME_STRIPE_TEST_RECONCILIATION_APPLY_AUTHORIZED=YES` and `--apply`.
