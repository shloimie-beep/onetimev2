# Stripe TEST Operator Runbook

Scope: OT-105 TEST/SANDBOX billing canary only.

## Webhook Destination

Use this HTTPS endpoint for the Stripe TEST webhook:

```text
https://ot99-web-staging.up.railway.app/api/v1/billing/webhooks/provider
```

Do not use the homepage, a success redirect, or any public landing URL as a
webhook destination. Redirect pages are browser return targets, not webhook
receivers.

## Bounded Event Set

Enable exactly these TEST webhook events:

```text
checkout.session.completed
checkout.session.expired
customer.subscription.created
customer.subscription.updated
customer.subscription.deleted
customer.subscription.trial_will_end
customer.subscription.paused
customer.subscription.resumed
invoice.paid
invoice.payment_failed
invoice.payment_action_required
charge.refunded
charge.dispute.created
charge.dispute.closed
```

## Protected Configuration

Store values only in protected runtime configuration. Never paste them in chat,
commit them, screenshot them, or write them into repo files.

Required names:

```text
LIVE_STRIPE_CHARGES_AUTHORIZED=NO
OT105_STRIPE_TEST_CANARY_AUTHORIZED=true
ENABLE_PAYMENT_TRANSPORT=true
ENABLE_STRIPE_TEST_CHECKOUT=true
ENABLE_STRIPE_TEST_PORTAL=true
ENABLE_STRIPE_TEST_WEBHOOKS=true
ENABLE_STRIPE_TEST_WEBHOOK_PROJECTION=true
ONE_TIME_STRIPE_TEST_SECRET_KEY
ONE_TIME_STRIPE_TEST_WEBHOOK_SECRET
ONE_TIME_STRIPE_TEST_ACCOUNT_ID
ONE_TIME_STRIPE_TEST_PRODUCT_ID
ONE_TIME_STRIPE_TEST_PRICE_ID
ONE_TIME_STRIPE_TEST_PORTAL_CONFIGURATION_ID
ONE_TIME_STRIPE_TEST_WEBHOOK_ENDPOINT_ID
```

## Read-Only Readiness

Run:

```bash
npm run stripe:test:canary -- --output ops/codex-runs/OT-105/canary/readiness.json
```

Expected result when configured: `validated_read_only`.

Expected result without protected TEST config or authorization:
`waiting_for_authorization` or `waiting_for_stripe_test_resources`. That blocks
only the external provider canary, not the PR.

## Authorized Sandbox Canary

Only the authorized Stripe account owner should run apply mode:

```bash
npm run stripe:test:canary -- --apply --output ops/codex-runs/OT-105/canary/apply.json
```

Apply mode may create TEST-only Stripe customer, Checkout Session, and Customer
Portal Session objects. It must not use live mode, real cards, real charges,
production data, Railway/DNS mutations, credential writes, or access grants.

After creating the sandbox Checkout Session, complete it with Stripe TEST
payment details in the Stripe-hosted page, confirm the TEST webhook endpoint
returns 2xx, and inspect staging readback for:

- signed `checkout.session.completed` receipt;
- `customer.subscription.*` projection;
- `invoice.paid` projection for USD 6700;
- family entitlement status `active` with no more than three active learners;
- duplicate webhook replay no-op;
- cancellation/failure revocation or suspension behavior.

## Remove The Incorrect Endpoint

In the Stripe TEST Dashboard, disable or delete any webhook endpoint that points
to the homepage, Checkout success page, public landing page, or another redirect
URL. Keep only the bounded staging webhook destination above for this canary.

## Rollback

Disable `ENABLE_STRIPE_TEST_CHECKOUT`, `ENABLE_STRIPE_TEST_PORTAL`, and
`ENABLE_STRIPE_TEST_WEBHOOKS`, then disable the TEST webhook endpoint in Stripe.
No live Stripe objects, charges, DNS records, Railway service settings, or
production access grants should need rollback from OT-105.
