# OT-84 Decisions

## Initial Security Decisions

- Use the verified generated OT-84 packet as implementation authority; do not
  use a PRO factory file as the executable prompt.
- Keep all implementation work inside the standalone
  `webcraft-media/onetimev2` repository.
- Treat Telegram as an alert/action transport only. It must not become a system
  of record or public signup dependency.
- Preserve one production One Time bot model. No second staging bot is created
  by OT-84.
- Fixed One Time scope must be constructed server-side. User text, callback
  data, and parser output cannot choose account, product, role, principal,
  service, SQL, shell, URL, or tool names.
- Missing protected Telegram secrets block only live provider mutation and real
  canary work. They do not block durable implementation, tests, synthetic
  canary, branch push, or draft PR.

## Repository Reconnaissance

Completed.

- Existing OT-51 Telegram foundation already provided webhook ingress,
  normalized-update encryption hooks, durable inbox, identity mapping,
  confirmations, leases, audit, worker retry/dead-letter behavior, memory
  fixtures, SQL repositories, and unit/integration tests.
- The live app is Express/static. Webhook ingress was mounted in `createApp`
  before the generic JSON body parser so Telegram secret verification and
  bounded body handling occur before ordinary application parsing.
- One Time account/product scope comes from `AppConfig` and identity mapping,
  not from Telegram text or callback data.
- Existing CRM/classes/content application services can support safe redacted
  reads. Tasks, support tickets, tags, class status mutation, content retry,
  and question queue mutation do not have complete OT-84-ready application
  services in this branch, so writes fail closed through the adapter instead
  of writing domain tables directly.
- Question queue actions remain feature-gated for OT-88. `support.ticket.received`
  is defined as a stable event contract only; OT-84 does not implement the
  future BNA/OT-89 consumer.
- Production long polling remains disallowed. Webhook mode is default-off and
  requires protected runtime secret configuration.

## Component Mapping

- `packages/contracts/src/telegram/types.ts`: OT-84 action catalog, write/read
  action typing, confirmation metadata, chat-bound mappings, and result replay.
- `packages/domain/src/telegram/commands.ts`: deterministic command parser,
  constrained natural-language compiler, confirmation policy, idempotency keys,
  replay behavior, feature gates, and denial paths.
- `packages/domain/src/telegram/identity.ts`: private-chat mapping binding,
  current mapping version return, owner/admin role checks, and owner-only audit.
- `packages/db/migrations/2000_ot84_telegram_action_gateway.sql`: forward-only
  schema extension for mapping version/chat binding, widened action checks,
  durable response outbox, and action-gateway event outbox.
- `packages/db/src/telegram/repositories.ts`: OT-84 mapping/confirmation fields,
  environment-scoped inbox dedupe, confirmation result replay persistence, and
  SQL response outbox transport adapter.
- `packages/contracts/src/action-gateway/*`: copied packet schemas/fixtures plus
  dependency-free event validator tests.
- `packages/domain/src/telegram/application-adapter.ts`: SQL-backed runtime
  adapter for actor resolution and safe redacted reads through existing
  application services; unavailable writes fail closed.
- `apps/web/src/server/app.ts`: default-off protected Telegram webhook route.
- `packages/domain/src/telegram/crypto.ts`: AES-GCM runtime payload codec.
- `packages/observability/src/index.ts`: Telegram secret/token redaction paths.

## Blocked Decisions

- Real Telegram webhook registration, real canary, and provider delivery were
  not executed because no protected Telegram bot token, webhook secret,
  allowlisted canary chat, or live runtime identity mapping was available in
  this Codex environment.
- `npm run db:verify` was attempted but requires `DATABASE_URL`. Local pg-mem
  migration integration passed and is recorded in `TESTS.md`.

