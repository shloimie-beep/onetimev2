# OT-87 Remaining Work

## Blocked By Protected Stripe TEST Resources

- Configure protected TEST-only values outside the repo:
  - `ONE_TIME_STRIPE_TEST_SECRET_KEY`
  - `ONE_TIME_STRIPE_TEST_WEBHOOK_SECRET`
  - `ONE_TIME_STRIPE_TEST_ACCOUNT_ID`
  - `ONE_TIME_STRIPE_TEST_PRODUCT_ID`
  - `ONE_TIME_STRIPE_TEST_PRICE_ID`
  - `ONE_TIME_STRIPE_TEST_PORTAL_CONFIGURATION_ID`
  - `ONE_TIME_STRIPE_TEST_WEBHOOK_ENDPOINT_ID`
- Re-run `npm run stripe:test:resources:validate` with `LIVE_STRIPE_CHARGES_AUTHORIZED=NO`.
- Run Stripe TEST canaries only after validation succeeds and `ONE_TIME_STRIPE_TEST_CANARY_AUTHORIZED=YES` is explicitly set.
- Run provider-backed reconciliation only with a safe TEST `DATABASE_URL`; run apply only with `ONE_TIME_STRIPE_TEST_RECONCILIATION_APPLY_AUTHORIZED=YES`.

## Publication

- Push `codex/ot87-stripe-test-entitlements`.
- Open the required draft PR targeting `codex/ot83-household-portals-foundation`.
- Update `STATE.json` with the draft PR URL after creation.
