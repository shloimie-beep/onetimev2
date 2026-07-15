# OT-72 Implemented

## Initialized Packet

- Raw prompt preserved.
- State, inputs, checkpoint, blockers, decisions, remaining work, test results, integration manifest, resume file and phase ledgers initialized.

## Phase 1 - Stripe

- Added `packages/domain/src/billing/stripe-test-adapter.ts`.
- Extended `BillingProviderAdapter` to allow `stripe_test_provider`.
- Adapter is server-only, injected-client only, test-mode only, and rejects live-mode objects/references.
- Checkout and portal methods return local redirect handles, with raw provider URLs kept behind an injected server vault.
- Raw webhook verification stays behind the injected SDK-shaped client and requires raw bytes plus signature header.

## Phase 2 - Resend Email And WAPI/WhatsApp

- Added default-off delivery provider config/parser.
- Added canary-gated Resend/WAPI delivery router.
- Added signed webhook normalization for provider truth events.
- Added provider event contracts and repository support for redacted provider event ledger/readiness rows.

## Phase 3 - Zoom

- Added Zoom readiness and protected launch descriptor seam.
- Preserves the daily 19:00 `Asia/Jerusalem` schedule contract and excludes raw join URLs.

## Phase 4 - Vimeo

- Added Vimeo readiness and playback descriptor seam.
- Excludes raw Vimeo URLs/tokens and only emits opaque descriptor references.

## Phase 5 - Telegram

- Added separate One Time Telegram transport config/parser.
- Added canary-gated real Telegram transport wrapper while preserving mock transport tests.

## Phase 6 - BNA Oversight

- Added redacted async oversight outcome schema/builder and repository outbox persistence.
- Added a typed BNA follow-up manifest schema in `packages/contracts/src/providers/oversight.ts`.
- Added `ops/execution/ot-72/BNA-FOLLOWUP-MANIFEST.json` as the separate future-consumer manifest requested by the prompt.
- Extended OT-72 unit coverage to validate that the manifest remains async-only, forbids OT-72 BNA runtime edits, and excludes forbidden private payload terms from allowed summary keys.
- No BNA runtime code was edited.

## Migration And Verification

- Added `packages/db/migrations/1700_ot72_provider_truth.sql`.
- Added focused OT-72 unit/integration tests and updated the OT-51 migration assertion for the new 1700 migration.
