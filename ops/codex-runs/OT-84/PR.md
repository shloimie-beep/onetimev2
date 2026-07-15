# OT-84 Draft PR

Status: pending branch push and draft PR creation.

- Repository: `webcraft-media/onetimev2`
- Base: `codex/ot83-household-portals-foundation`
- Head: `codex/ot84-telegram-action-gateway`
- Draft PR URL: pending

## Review Notes

- OT-84 is default-off and webhook-only for production.
- Real Telegram canary is blocked until protected runtime secrets, an exact
  identity mapping, one allowlisted private canary chat, and explicit operator
  approval are available.
- Provider mutation count is zero.

## Rollback Summary

Disable `ONE_TIME_TELEGRAM_WEBHOOK_ENABLED` to remove runtime ingress. Any
database rollback must be a new forward migration.
