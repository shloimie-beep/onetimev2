# OT-LIVE-003.02 source lease

- task: `OT-LIVE-003.02`
- owner: isolated One Time GHL-to-Telegram reply-copilot lane
- branch: `codex/ot-live-003-reply-copilot-20260803`
- base: `cf30a6ca10695fb4e6b9859e7e4aba9c77831b2f`
- confirmed by: C00 / OT-LIVE-001 coordination readback at `2026-08-03T17:31:00Z`
- external effects: none
- production deployment: prohibited

## Owned paths

- `apps/telegram-bot/src/reply-copilot/**`
- `packages/contracts/src/telegram/reply-copilot.ts`
- `packages/domain/src/telegram/reply-copilot/**`
- `packages/db/src/telegram/reply-copilot/**`
- `tests/unit/telegram/reply-copilot/**`
- `tests/integration/telegram-reply-copilot.test.ts`
- `tests/e2e/ot-live-003-reply-copilot.spec.ts`
- `ops/release/ot-live-003/**`
- `ops/codex-runs/OT-LIVE-003/**`

## Conditional shared paths

The following remain unowned until the controller grants an exact lease:

- `packages/db/migrations/**`
- existing app/package barrel exports
- existing process or route registration files
- shared deployment manifests

Any required change to a conditional path will be proposed to C00 before edit.

## Exclusions

- control-registry files
- GHL workflow/provider UI
- production or staging provider state
- BNA repository, runtime, bot token, webhook, poller, database, sessions, and chat mappings
- landing, signup, portal, billing, DNS, campaigns, Vimeo, and broad customer communications
