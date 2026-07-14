# OT-46 Webhook Lifecycle Matrix

## Implemented Flow

1. Feature must be enabled through disabled-by-default test config.
2. Router hook expects exact raw bytes before parsing.
3. Fixture adapter verifies an HMAC signature before parsing JSON.
4. Live mode, wrong provider account, and wrong mode fail closed.
5. Verified event receipts store safe digests and minimized object refs.
6. Duplicate same digest is recorded as duplicate.
7. Same event ID with different digest is rejected as digest mismatch.
8. Event correlation uses existing local customer mapping only.
9. Email, metadata, phone, or customer ID cannot create a billing principal.
10. Processing attempts are append-only.
11. Subscription/invoice projections update only after verified local correlation.
12. Entitlement policy runs through one provider-neutral seam and grants no access.

## Covered Dispositions

- `invalid_signature`
- `oversized`
- `parsed_body_misuse`
- `duplicate`
- `digest_mismatch`
- `stale_event`
- `unknown_event`
- `live_mode_rejected`
- `wrong_provider_account`
- `wrong_scope`
- `wrong_customer_correlation`
- `accepted`

## Later Integration Requirement

Mount `createBillingRouter` before global JSON parsing, or mount its `/webhooks/provider` route with `express.raw({ type: '*/*', limit: '64kb' })` before any parsed-body middleware. The OT-46 service has a parsed-body misuse guard that fails if the raw-byte boundary is skipped.
