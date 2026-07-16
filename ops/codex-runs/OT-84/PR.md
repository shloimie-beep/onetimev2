# OT-84 Draft PR

Status: draft PR created.

- Repository: `webcraft-media/onetimev2`
- Base: `codex/ot83-household-portals-foundation`
- Base SHA: `a02d1d254ae0d17804fb657079a7871567260ea2`
- Head: `codex/ot84-telegram-action-gateway`
- PR creation head SHA: `a9864a103c36140f261f7f38e2078bc1542d8092`
- Draft PR URL: `https://github.com/webcraft-media/onetimev2/pull/29`
- PR number: `29`
- Draft: yes

## Review Notes

- OT-84 is default-off and webhook-only for production.
- Real Telegram canary is blocked until protected runtime secrets, an exact
  identity mapping, one allowlisted private canary chat, and explicit operator
  approval are available.
- Provider mutation count is zero.

## Rollback Summary

Disable `ONE_TIME_TELEGRAM_WEBHOOK_ENABLED` to remove runtime ingress. Any
database rollback must be a new forward migration.
