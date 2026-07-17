# OPS-11 Login Delivery

Status: `sent`

One protected production admin activation email was sent after production web,
database, worker, and route checks passed. No destination, password, raw token,
or activation link is stored in evidence.

## Destination Resolution

- Source: protected `ONE_TIME_OWNER_TEST_EMAIL`
- Destination hash:
  `fab156df2719852de2dafb24f3e29548d4a2c5e8ef2374f7d3db47a0cef645e8`
- Destination matched protected `ONE_TIME_DELIVERY_TEST_CANARY_EMAIL`.
- No existing production account row was present for that destination, so OPS-11
  created one owner/admin activation as authorized.
- Target role: `admin`

## Sink Proof Before Provider Send

- Idempotency key: `ops11-sink-proof-20260717T083900Z`
- Token key: `account_lifecycle_token_a3d760191c589af1b9a88c27`
- Delivery key: `account_lifecycle_delivery_outbox_a3d760191c589af1b9a88c27`
- Result: `sink_delivered`
- Attempts: `1`
- External send performed: false
- Encrypted payload cleared: true
- This proof token was revoked by the later provider activation.

## Provider Activation

- Idempotency key: `ops11-provider-canary-20260717T083700Z`
- Token key: `account_lifecycle_token_a29e4638254e07b9bd30a95a`
- Token ref:
  `account_lifecycle_token_ref_1f1ae4ff8ddb15725544b239`
- Delivery key: `account_lifecycle_delivery_outbox_a29e4638254e07b9bd30a95a`
- Result: `provider_delivered`
- Attempts: `1`
- Provider message reference hash present: true
- Encrypted payload cleared: true
- Expires: `2026-07-18T08:36:35.170Z`
- External send performed: true

## Duplicate Check

Final sanitized queue state for the operator destination:

- One `sink_delivered` proof activation.
- One `provider_delivered` active admin activation.
- One revoked proof token.
- One unconsumed, unrevoked active admin activation token.
- No queued lifecycle delivery remained for the operator destination.

## Operator Action

Open the activation email, set the password, and then log in at:

`https://join.onetimeonetime.com/login`
