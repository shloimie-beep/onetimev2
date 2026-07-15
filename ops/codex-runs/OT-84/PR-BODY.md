# OT-84 Telegram Action Gateway

## Summary

- Implements the OT-84 Telegram action gateway on top of the OT-51 foundation.
- Adds 28 server-scoped action contracts, chat-bound authorization, opaque
  confirmation callbacks, durable response outbox storage, event schemas, and a
  default-off protected webhook route.
- Keeps Telegram as a transport and fails closed for write actions whose
  OT-84-ready application services are not present in this branch.

## Validation

- `npm run typecheck`
- `npm run lint`
- `npm run format`
- Scoped OT-84 changed-file Prettier check
- `npm run secret:scan`
- `npx vitest run --config vitest.unit.config.ts tests/unit/telegram/telegram-foundation.test.ts tests/unit/telegram/ot84-action-gateway.test.ts`
- `npx vitest run --config vitest.integration.config.ts tests/integration/telegram-db-foundation.test.ts`
- `npm run build`

## Known Gates

- `npm run db:verify` requires `DATABASE_URL`; focused pg-mem integration
  applies the migration set through `2000_ot84_telegram_action_gateway`.
- Real Telegram canary is `NOT_RUN_WAITING_FOR_TELEGRAM_SECRET` because this
  Codex environment does not have protected Telegram bot token, webhook secret,
  exact identity mapping, or allowlisted private canary chat values.

## Provider Mutations

None. No Telegram webhook registration, provider send, production data, BNA bot,
payment, DNS, or account mutation was performed.
