# OT-87 Phase Ledger - Reconciliation

Status: implemented; provider-backed execution blocked.

- Added `billing:reconcile:test` and `billing:reconcile:test:apply`.
- Dry run writes a redacted resume report and fails closed when TEST resources or `DATABASE_URL` are absent.
- Apply requires `ONE_TIME_STRIPE_TEST_RECONCILIATION_APPLY_AUTHORIZED=YES` and does not mutate Stripe.
