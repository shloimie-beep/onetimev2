# OT-72 Remaining

## Phase 1 - Stripe Test-Mode Checkout And Parent Billing Adapter

- Server-only test/live fail-closed Stripe adapter.
- Offer policy gate with synthetic test fixtures and no live charges.
- Raw-body webhook verification, immutable event ledger, replay protection, ordered reconciliation and safe DTOs.

## Phase 2 - Resend Email And WAPI/WhatsApp Provider Truth

- Server-only deny-by-default adapters.
- Provider acknowledgement/state truth and authenticated webhook ingestion.
- Dispatch consent/suppression checks, retry/dead-letter and contact-local projections.

## Phase 3 - Zoom Protected Live-Class Adapter

- Server-only adapter for OT-71 class contract.
- Schedule/DST, host ownership, protected launch, occurrence references and provider readiness states.

## Phase 4 - Vimeo Protected Playback/Outcome Adapter

- Server-only metadata/readiness adapter.
- Short-lived playback descriptor seam and redacted async outcome support.

## Phase 5 - Separate One Time Telegram Transport

- Distinct One Time bot transport adapter, webhook ingress and default-off worker ownership.

## Phase 6 - Asynchronous BNA Oversight Contract

- One Time producer-side redacted asynchronous control-plane outcome contract and BNA follow-up manifest.

## Publication

- Run focused verification.
- Commit and push each phase checkpoint.
- Open one draft PR targeting `codex/ot60r-recovery-convergence`.
