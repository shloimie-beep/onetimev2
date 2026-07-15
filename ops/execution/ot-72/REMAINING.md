# OT-72 Remaining

## Phase 1 - Stripe Test-Mode Checkout And Parent Billing Adapter

- Canary/sandbox verification remains pending because no protected Stripe test credential/product/price/portal canary gate was checked or used.
- Commercial offer policy remains gated; no exact real commercial policy record was selected.

## Phase 2 - Resend Email And WAPI/WhatsApp Provider Truth

- Canary verification remains pending because no protected canary email/WhatsApp destination gate was checked or used.
- Public WhatsApp auto-reply remains unmounted and unavailable until explicit protected policy/canary gates exist.

## Phase 3 - Zoom Protected Live-Class Adapter

- Read-only provider verification remains pending behind an approved readiness gate.
- Meeting creation/edit/webhook registration/live mutation remains forbidden without a separate exact canary flag.

## Phase 4 - Vimeo Protected Playback/Outcome Adapter

- Read-only provider verification remains pending behind an approved readiness gate.
- Upload/edit/delete/privacy/folder/webhook/publication mutation remains forbidden without a separate exact canary flag.

## Phase 5 - Separate One Time Telegram Transport

- Real token ownership/mapping/single-consumer/canary verification remains pending behind protected config.
- Webhook registration, long-lived consumer startup and Telegram sends remain unperformed.

## Phase 6 - Asynchronous BNA Oversight Contract

- Future BNA consumer/runtime integration remains a separate follow-up. This branch only produces the One Time-side schema/builder/outbox seam.

## Publication

- Draft PR #18 is open targeting `codex/ot60r-recovery-convergence`.
- Remote CI passed for checked head `4ec55d7bd6ade9ec2dd21e4557a88ac43b4ceb44`.
- Keep the PR draft until OT-71/OT-72/OT-80 convergence review accepts the adapter seams.
