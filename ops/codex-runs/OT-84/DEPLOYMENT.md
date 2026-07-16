# OT-84 Deployment Contract

## Runtime Mode

OT-84 ships default-off. The web process mounts
`/api/v1/telegram/one-time/webhook`, but the handler does not accept live
Telegram traffic unless the Telegram webhook feature is enabled with protected
runtime configuration.

## Required Protected Configuration

Do not commit values for any of these:

- `ONE_TIME_TELEGRAM_WEBHOOK_ENABLED=true`
- `ONE_TIME_TELEGRAM_WEBHOOK_SECRET`
- `ONE_TIME_TELEGRAM_BOT_KEY`
- `ONE_TIME_TELEGRAM_ENVIRONMENT`
- `DATABASE_URL`

Production mode requires a webhook secret. Production long polling is
disallowed.

## Safe Rollout Gates

- Apply forward-only migrations through
  `2000_ot84_telegram_action_gateway.sql`.
- Verify a single active One Time Telegram bot ownership model.
- Register the Telegram webhook only from the protected deployment boundary.
- Confirm the identity mapping for exactly one canary principal and one
  allowlisted private canary chat before live canary.
- Run synthetic canary first.
- Run real canary only after explicit operator approval.

## Consumer Contract

- Incoming updates are normalized, encrypted, and deduped before processing.
- Handler responses are queued to `telegram_response_outbox`; provider delivery
  is outside this Codex run and must use protected credentials.
- Confirmation callbacks are opaque and idempotent.
- Telegram remains a transport; One Time domain tables remain the source of
  truth.

## Current Deployment State

No webhook registration, provider send, long-polling consumer, or production
deployment mutation was performed from this run.
