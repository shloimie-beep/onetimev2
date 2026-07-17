# OT-51P Audit Inventory

## Repository Baseline

- Standalone repository instructions: `AGENTS.md`.
- Stack confirmed: Node 24, TypeScript, Express 5, PostgreSQL through `pg`,
  pg-mem for tests, checksummed forward-only migrations, transactional outbox.
- Existing apps: `apps/web`, `apps/worker`.
- Existing packages: `packages/config`, `packages/contracts`,
  `packages/db`, `packages/domain`, `packages/observability`.
- Existing migrations: `0001_onetime_lead_slice.sql`,
  `0002_crm_auth_core.sql`.

## Collision Checks

- `apps/telegram-bot`: absent before OT-51P.
- `packages/contracts/src/telegram`: absent before OT-51P.
- `packages/domain/src/telegram`: absent before OT-51P.
- `packages/db/src/telegram`: absent before OT-51P.
- Migration namespace `1600-1699`: unused before OT-51P.
- Remote branch `codex/ot51p-isolated-telegram-bot`: absent before OT-51P.
- Immutable anchor `origin/codex/parallel-base-a73458d`: present at
  `a73458d1884b8fcb4843c4852425009577f59ef7`.

## Current-State Patterns Inspected

| Area | Files | Finding |
| --- | --- | --- |
| Config | `packages/config/src/index.ts` | Real transports are refused outside test. No Telegram config is activated. |
| Auth/session | `packages/domain/src/auth/service.ts`, `apps/web/src/server/app.ts` | Account/product scope is server-derived. Owner/admin are privileged roles; viewer cannot write. |
| CRM/task-like writes | `packages/domain/src/crm/service.ts` | Versioned optimistic update and audit patterns exist for contacts; OT-51P uses injected app ports for task writes instead of DB shortcuts. |
| Idempotency | `packages/domain/src/lead/service.ts` | Existing public idempotency pattern is scoped by account/product. OT-51P adds command idempotency keys for confirmed writes. |
| Worker/lease | `packages/domain/src/outbox/sink.ts`, `apps/worker/src/main/index.ts` | Existing worker uses `FOR UPDATE SKIP LOCKED` with fallback. OT-51P follows this pattern feature-locally. |
| Migrations | `scripts/migrate.ts`, `packages/db/src/index.ts` | Migrations are checksummed and forward-only. OT-51P reserves only migration `1600`. |

## Legacy Telegram Evidence Search

Searched current standalone repo and local OneTime worktrees for:
`telegram`, `bot`, `webhook`, `polling`, `getUpdates`, `setWebhook`,
`update_id`, `identity mapping`, `bot token`, `409`, and `conflict`, excluding
`.git`, `.env*`, `.secrets`, `node_modules`, `dist`, and image assets.

Findings:

- No canonical standalone `apps/telegram-bot` implementation existed.
- Results were historical audit references and BNA-origin evidence pointers,
  plus public signup WhatsApp copy and conflict tests.
- No BNA Telegram bridge code, real config, token, webhook secret, chat ID, or
  provider value was copied or used.

## Capability-To-Adapter Audit

At construction base `a73458d`, stable One Time application APIs for bot-facing
product status, class lists, content pipeline, contact search, task lookup,
task create, and task update are not accepted as central application APIs.
OT-51P therefore implements typed injected ports in
`OneTimeBotApplicationAdapter`. Unsupported operations are absent and receive
truthful disabled/denied behavior.
