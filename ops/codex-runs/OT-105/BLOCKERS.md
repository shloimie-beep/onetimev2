# OT-105 Blockers

## External Canary Blocked

Status: blocked on protected TEST-only configuration and explicit operator authorization.

The local implementation and deterministic tests are complete. The staging Stripe canary cannot create or validate real TEST checkout, portal, or webhook correlation until these are supplied in the staging/operator environment:

- `LIVE_STRIPE_CHARGES_AUTHORIZED=NO`
- `OT105_STRIPE_TEST_CANARY_AUTHORIZED=true`
- `ENABLE_STRIPE_TEST_CHECKOUT=true`
- `ENABLE_STRIPE_TEST_PORTAL=true`
- `ENABLE_STRIPE_TEST_WEBHOOKS=true`
- `ONE_TIME_STRIPE_TEST_SECRET_KEY`
- `ONE_TIME_STRIPE_TEST_WEBHOOK_SECRET`
- `ONE_TIME_STRIPE_TEST_ACCOUNT_ID`
- `ONE_TIME_STRIPE_TEST_PRODUCT_ID`
- `ONE_TIME_STRIPE_TEST_PRICE_ID`
- `ONE_TIME_STRIPE_TEST_PORTAL_CONFIGURATION_ID`
- `ONE_TIME_STRIPE_TEST_WEBHOOK_ENDPOINT_ID`

The current readiness run intentionally stopped before API access or mutations and recorded zero live calls, zero live charges, zero credential writes, and zero production writes in `ops/codex-runs/OT-105/canary/readiness.json`.
