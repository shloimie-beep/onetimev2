# OT-84 Final Report

Status: local implementation complete; branch push and draft PR pending.
Checkpoint: `WAITING_FOR_TELEGRAM_SECRET`.

## Exact Base And Head

- Repository: `webcraft-media/onetimev2`
- Base branch: `codex/ot83-household-portals-foundation`
- Resolved base SHA: `a02d1d254ae0d17804fb657079a7871567260ea2`
- Head branch: `codex/ot84-telegram-action-gateway`
- Final head SHA: pending publication commit
- Draft PR: pending

## Worktree Proof

- Worktree: `C:\Users\User\OneTimeOneTime-ot84-telegram-action-gateway`
- Origin: `https://github.com/webcraft-media/onetimev2.git`
- BNA product code edited: no
- PRO factory file used: no
- OT-84 packet SHA-256:
  `D933CC9F3F4D662E02151808A4DD37B2D1CE216276C345760BC0C63B21136515`
- Verbatim prompt SHA-256:
  `69C24AF50256230C783EB48AFE2417EC62B41708437C5EC439446572523C754B`

## Implementation Map

- `packages/contracts/src/telegram/types.ts`: OT-84 catalog of 28 actions,
  read/write action typing, risk classes, confirmation metadata, command source,
  chat-bound mapping version, and result replay contracts.
- `packages/domain/src/telegram/commands.ts`: deterministic slash commands,
  constrained natural-language compiler, forbidden prompt rejection, feature
  gates, preview/confirm execution, opaque callbacks, scoped idempotency keys,
  confirmation drift checks, duplicate replay, and fail-closed denial paths.
- `packages/domain/src/telegram/identity.ts`: private chat binding,
  mapping-version-aware authorization, role checks, and owner-only audit action.
- `packages/domain/src/telegram/memory.ts`: OT-84 fixture adapter, memory
  confirmation result replay, and synthetic event IDs.
- `packages/domain/src/telegram/application-adapter.ts`: SQL-backed runtime
  adapter for actor resolution and safe redacted reads through existing CRM,
  class, and content services. Writes without OT-84-ready application services
  fail closed instead of writing domain tables directly.
- `packages/db/migrations/2000_ot84_telegram_action_gateway.sql`: forward-only
  migration for chat binding, mapping version, environment-scoped inbox dedupe,
  widened action checks, confirmation metadata/result replay, durable response
  outbox, and stable action-gateway event outbox.
- `packages/db/src/telegram/repositories.ts`: OT-84 SQL repository fields,
  response outbox transport adapter, environment-scoped inbox keys, and durable
  confirmation result persistence.
- `apps/web/src/server/app.ts`: default-off protected webhook route
  `/api/v1/telegram/one-time/webhook`, mounted before generic JSON parsing.
- `apps/telegram-bot/src/ingress.ts`: retry-safe 500 responses for durable or
  encryption failures and 400 for malformed JSON.
- `packages/domain/src/telegram/crypto.ts`: AES-GCM runtime payload codec.
- `packages/config/src/index.ts`: default-off Telegram webhook environment
  configuration and production secret enforcement.
- `packages/contracts/src/action-gateway/*`: packet schemas, seven stable event
  fixtures, and dependency-free validator.
- `packages/observability/src/index.ts`: Telegram token/secret redaction paths.

## Identity And Capability Summary

- Fixed One Time scope is constructed server-side from configuration and mapping
  repositories. Telegram text and callback data cannot choose account, product,
  role, principal, SQL, shell, URL, or tool names.
- Rabbi Scheller remains scoped to `one_time_owner`; Shloimie remains scoped to
  `one_time_admin`. Exact numeric IDs and chat IDs are runtime-only values.
- Private chat commands require a linked mapping bound to the hashed chat ref.
- `telegram.audit.read_recent` is owner-only.
- Generic `yes` does not confirm pending previews.
- Confirmation callbacks are opaque, expiring, mapping-version-aware,
  role/security-version-aware, and idempotent.

## Event Contracts

Seven stable fixtures and schemas are present and validated:

- `class.question.created`
- `class.question.selected`
- `support.ticket.received`
- `content.processing.status_changed`
- `lead.created`
- `task.created`
- `task.updated`

The validator rejects unknown top-level keys, unknown event names, privacy-key
violations, and mismatched payload shape.

## Migrations And Checksums

- Migration: `packages/db/migrations/2000_ot84_telegram_action_gateway.sql`
- Runtime schema creation: none
- Forward-only posture: maintained
- Checksum files: generated after final artifact writes before commit

## Deployment And Process Contract

- Webhook mode is default-off.
- Production webhook mode requires `ONE_TIME_TELEGRAM_WEBHOOK_SECRET`.
- Production long polling remains disallowed.
- The webhook route uses bounded raw JSON, Telegram secret verification,
  normalized update encryption, durable inbox dedupe, and durable response
  outbox enqueueing.
- No second One Time bot was created or configured.
- Real Telegram webhook registration was not performed from Codex.

See `DEPLOYMENT.md` for environment variables and safe rollout gates.

## Tests

Passed:

- `npm run typecheck`
- `npm run lint`
- `npm run format`
- Scoped OT-84 changed-file Prettier check
- `npm run secret:scan`
- `npx vitest run --config vitest.unit.config.ts tests/unit/telegram/telegram-foundation.test.ts tests/unit/telegram/ot84-action-gateway.test.ts`
- `npx vitest run --config vitest.integration.config.ts tests/integration/telegram-db-foundation.test.ts`
- `npm run build`
- `bash ops/codex-runs/OT-84/canary.sh`

Blocked:

- `npm run db:verify` requires `DATABASE_URL`.

## Canary

- Synthetic canary: passed through local checks and focused Telegram tests.
- Real canary: `NOT_RUN_WAITING_FOR_TELEGRAM_SECRET`.

Protected prerequisites for real canary are a Telegram bot token, webhook
secret, exact identity mapping, one allowlisted private canary chat, isolated
canary deployment boundary, and explicit operator canary approval.

## Provider Mutations

None. No `setWebhook`, `deleteWebhook`, `sendMessage`, `getUpdates`, broadcast,
payment, DNS/account, production data, BNA bot, or BNA provider mutation was
performed.

## Known Gates

- `DATABASE_URL` is required for `npm run db:verify`.
- Protected Telegram runtime secrets and explicit approval are required for the
  real canary.
- Draft PR publication remains pending until git commit/push/PR creation
  completes.

## Rollback Summary

The branch is default-off. Disabling `ONE_TIME_TELEGRAM_WEBHOOK_ENABLED` removes
runtime ingress. Migration rollback would require a deliberate forward recovery
migration because this repository uses forward-only migrations.
