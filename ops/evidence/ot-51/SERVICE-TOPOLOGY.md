# OT-51P Service Topology

## Components

- `apps/telegram-bot/src/ingress.ts`: feature-local webhook handler factory.
- `apps/telegram-bot/src/index.ts`: direct-import integration hooks.
- `packages/contracts/src/telegram/types.ts`: provider-neutral contracts.
- `packages/domain/src/telegram/identity.ts`: default-deny identity resolver.
- `packages/domain/src/telegram/commands.ts`: deterministic command catalog and
  preview/confirm engine.
- `packages/domain/src/telegram/worker.ts`: inert worker engine, lease helpers,
  topology validation, and mock polling conflict handling.
- `packages/domain/src/telegram/memory.ts`: mock-only repositories, transport,
  fixture adapter, audit sink, and limiter for tests.
- `packages/db/src/telegram/repositories.ts`: SQL-backed repositories matching
  migration `1600`.
- `packages/db/migrations/1600_ot51_telegram_bot_foundation.sql`: durable
  storage contract.

## Not Activated

- No route is mounted in `apps/web/src/server/app.ts`.
- No process is started from `apps/worker`.
- No root package script, package manifest, lockfile, workflow, central config,
  or central barrel export was edited.
- No webhook, polling loop, or Telegram transport is activated.

## Startup Rules

- Webhook and local polling are mutually exclusive by
  `validateTelegramRuntimeTopology`.
- Production polling is explicitly refused.
- Mocked Telegram 409 conflict returns a clean shutdown reason
  `telegram_409_conflict` and no retry storm.
