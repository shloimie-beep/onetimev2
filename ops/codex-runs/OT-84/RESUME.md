# OT-84 Resume

## Current Checkout

- Repository: `webcraft-media/onetimev2`
- Worktree: `C:\Users\User\OneTimeOneTime-ot84-telegram-action-gateway`
- Branch: `codex/ot84-telegram-action-gateway`
- Base ref: `origin/codex/ot83-household-portals-foundation`
- Resolved base SHA: `a02d1d254ae0d17804fb657079a7871567260ea2`
- Checkpoint: `WAITING_FOR_TELEGRAM_SECRET`

## Completed

- Located `C:\Users\User\Downloads\OT84-telegram-gateway-codex-packet.zip` and
  did not use a PRO factory file.
- Verified the ZIP SHA-256 and every internal `SHA256SUMS` entry.
- Restored `PROMPT.md` from the verified packet; SHA-256 is
  `69C24AF50256230C783EB48AFE2417EC62B41708437C5EC439446572523C754B`.
- Implemented the OT-84 action catalog, deterministic command gateway,
  constrained natural-language compiler, opaque confirmation callbacks,
  chat-bound identity mapping, SQL-backed adapter boundaries, durable response
  outbox, stable event schemas/fixtures, webhook ingress, AES-GCM payload codec,
  logging redaction, tests, synthetic canary evidence, and deployment contract.
- No raw Telegram update, token, webhook secret, numeric Telegram ID, private
  chat ID, full contact value, or local credential path was stored.
- Provider mutation count is zero.

## Verification Already Run

- `npm run typecheck`
- `npm run lint`
- `npm run secret:scan`
- `npx vitest run --config vitest.unit.config.ts tests/unit/telegram/telegram-foundation.test.ts tests/unit/telegram/ot84-action-gateway.test.ts`
- `npx vitest run --config vitest.integration.config.ts tests/integration/telegram-db-foundation.test.ts`
- `npm run build`

`npm run db:verify` is blocked until `DATABASE_URL` is supplied. The focused
pg-mem integration test applied the migration set through
`2000_ot84_telegram_action_gateway` and verified durable repository behavior.

## Remaining Protected Step

Real Telegram canary is not safe to run from this environment. It requires all
of the following without committing values:

- protected Telegram bot token;
- protected webhook secret;
- exact runtime identity mapping for the intended One Time principal;
- one allowlisted private canary chat;
- isolated staging/canary deployment boundary using the single One Time bot
  ownership model;
- explicit operator approval for the narrow canary.

When those prerequisites exist, run only the narrow read-only identity/scope
round trip plus at most one reversible confirmed mutation against a dedicated
canary record, then record redacted evidence and cleanup.

## Next Safe Action

If resuming before publication, stage only the explicit OT-84 files listed in
`FINAL.md`, commit, push `codex/ot84-telegram-action-gateway`, and create or
update the draft PR targeting `codex/ot83-household-portals-foundation`.
