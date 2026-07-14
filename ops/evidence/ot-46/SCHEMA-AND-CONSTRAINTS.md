# OT-46 Schema And Constraints

Migration: `packages/db/migrations/1300_ot46_billing_foundation.sql`

SHA-256: `DBF2F4F6152985496906455561FBD7D6F9032DC91044B4A746A3CF5396427738`

## Tables

- `billing_provider_accounts`
- `billing_offer_prices`
- `billing_principal_customers`
- `billing_checkout_sessions`
- `billing_subscription_projections`
- `billing_invoice_summaries`
- `billing_verified_events`
- `billing_event_processing_attempts`
- `billing_reconciliation_jobs`
- `billing_entitlement_projections`
- `billing_audit_events`

## Constraint Coverage

- Every provider-linked operational table carries `account_key`, `product_key`, `provider`, and `mode` except the provider-account registry, which is scoped by provider account ref.
- `mode` is constrained to `test`; live rows are rejected.
- Provider refs reject live-like values with no-live CHECKs.
- Offer price use is constrained by account/product/offer/provider/mode/provider-account/price FK scope.
- Active customer mappings have partial unique indexes for one active local principal mapping and one active provider customer mapping.
- Checkout sessions are unique by account/product/principal/offer/idempotency and by provider checkout session ref.
- Verified events are immutable append-only receipts by application contract with no update path and unique `(provider, mode, provider_account_ref, provider_event_id)`.
- Event state changes live in append-only processing attempts and controlled projections.
- Entitlement projections require a local principal and always store `grants_access=false`.
- Invoice summaries store opaque invoice refs and minimized amounts/status only; unrestricted URLs are rejected.

## Forbidden Data

The migration does not create columns for card data, payment-method fingerprints, full addresses, tax IDs, signature headers, raw webhook bytes, unrestricted provider payloads, or invoice URLs.
