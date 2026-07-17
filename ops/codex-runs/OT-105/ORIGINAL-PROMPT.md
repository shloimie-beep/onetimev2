# OT-105 — Stripe Test Billing Canary and Webhook Correction

## Mission

Harden and certify the existing Stripe Checkout/Billing/customer-portal/webhook/entitlement implementation in TEST/SANDBOX mode only. Correct the old test webhook mistake: the homepage redirect is not a valid webhook destination. The staging route is:

`https://ot99-web-staging.up.railway.app/api/v1/billing/webhooks/provider`

Use current official Stripe webhook and subscription-testing documentation.

## Source

- Repository: `webcraft-media/onetimev2`
- Exact base SHA: `fb3c397ce8ece100cf7873fdddcd940a1552ea9b`
- Branch: `codex/ot105-stripe-test-billing-canary`
- Draft PR base: `codex/ops03-staging-readiness-repair`
- Optional migration reservation: `2150_ot105_stripe_test_canary.sql` only if unavoidable.
- Clean isolated worktree only.

Persist `ops/codex-runs/OT-105/{ORIGINAL-PROMPT.md,STATE.json,PROGRESS.md,DECISIONS.md,BLOCKERS.md,RESUME.md,FINAL-REPORT.md}`. Missing protected TEST configuration blocks only external canary.

## Collision boundary

Own billing contracts/domain/provider/router factory/operator scripts/tests/evidence. Do not edit shared app/config/worker/main/env/root manifests, landing/auth/shell, other providers, Railway or BNA. Export integration factories and `OPS04-INTEGRATION-DELTA.md`.

## Implementation and proof

- Verify raw-body preservation, official SDK signature verification, immediate durable receipt/dedupe and fast 2xx followed by async projection.
- Fail closed on `livemode=true`, live keys/objects, wrong account/context, unallowlisted product/price, wrong currency/amount, unsigned/stale payload and cross-account metadata.
- Idempotency/out-of-order handling by Stripe event ID and canonical TEST object readback when freshness is ambiguous.
- Minimal handled events: checkout completion, subscription create/update/delete/trial warning, invoice paid/payment failed/payment action required. Unknown valid events safely 2xx/no-op after audit; invalid signatures 400.
- Commercial contract: $67/month family subscription, at most three active learners, entitlement determined by verified subscription/invoice state—not redirect success.
- Parent-scoped customer portal; no cross-household exposure.
- Add deterministic Stripe fixtures and an operator canary tool for TEST resource readback, one synthetic Checkout/subscription, portal readback and webhook→subscription→entitlement correlation.
- Create `STRIPE-TEST-OPERATOR-RUNBOOK.md` explaining how the authorized account owner enables the exact HTTPS webhook, stores its TEST signing secret securely, selects the bounded event set, confirms 2xx, and disables/deletes the incorrect redirecting TEST endpoint. Never print keys.

## Tests and canary

Test tampering/raw-body mismatch, stale signature, duplicate/out-of-order events, wrong account/mode/product/price/currency/amount, pending/past-due/unpaid/canceled transitions, replay, portal cross-household, fourth learner and provider 429/5xx/timeouts.

Prove with synthetic fixtures: TEST Checkout → webhook → durable dedupe → subscription/invoice projection → family entitlement → up to three learners → cancellation/failure revocation. Prove no Stripe code/requests on landing, CRM or unrelated routes.

External Stripe account administration and canary must be performed only by/under the authorized account owner, with protected TEST credentials and explicit `OT105_STRIPE_TEST_CANARY_AUTHORIZED=true`. Never use live mode, real payment methods or real charges. If absent, finish the complete PR and mark only the provider canary pending.

Run scoped checks, push and open a draft PR. Final report includes exact branch/SHA/PR, webhook route and event set, test totals, TEST canary truth, entitlement proof, config names, rollback, blockers and confirmation that live Stripe/production/DNS were untouched.
