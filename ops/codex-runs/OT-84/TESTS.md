# OT-84 Test Evidence

All commands were run from
`C:\Users\User\OneTimeOneTime-ot84-telegram-action-gateway`.

## Passed

- `npm run typecheck`
  - TypeScript compile check passed.
- `npm run lint`
  - ESLint passed.
- `npm run format`
  - Full repository Prettier check passed.
- `npx prettier --check apps/telegram-bot/src/ingress.ts apps/web/src/server/app.ts packages/config/src/index.ts packages/contracts/src/index.ts packages/contracts/src/telegram/types.ts packages/contracts/src/action-gateway/events.ts packages/domain/src/index.ts packages/domain/src/telegram/commands.ts packages/domain/src/telegram/crypto.ts packages/domain/src/telegram/identity.ts packages/domain/src/telegram/memory.ts packages/domain/src/telegram/application-adapter.ts packages/db/src/telegram/repositories.ts packages/observability/src/index.ts tests/integration/telegram-db-foundation.test.ts tests/unit/telegram/telegram-foundation.test.ts tests/unit/telegram/ot84-action-gateway.test.ts ops/codex-runs/OT-84/STATE.json ops/codex-runs/OT-84/BASE-HEAD.json ops/codex-runs/OT-84/CANARY.json ops/codex-runs/OT-84/PROVIDER-MUTATIONS.json packages/contracts/src/action-gateway/action-gateway-event-v1.schema.json packages/contracts/src/action-gateway/intent-compiler-output-v1.schema.json`
  - Scoped OT-84 code and JSON formatting passed.
- `npm run secret:scan`
  - Passed across 609 repo text files after checksum artifacts were generated.
- `npx vitest run --config vitest.unit.config.ts tests/unit/telegram/telegram-foundation.test.ts tests/unit/telegram/ot84-action-gateway.test.ts`
  - 2 files passed, 14 tests passed.
- `npx vitest run --config vitest.integration.config.ts tests/integration/telegram-db-foundation.test.ts`
  - 1 file passed, 2 tests passed.
- `npm run build`
  - Web client/page build and typecheck passed.
  - Vite reported an existing unresolved runtime font asset reference; build
    still completed successfully.
- `bash ops/codex-runs/OT-84/canary.sh`
  - Synthetic canary passed: typecheck, lint, scoped Prettier, secret scan,
    focused unit tests, focused integration test, and build passed.
  - Script exited with `NOT_RUN_WAITING_FOR_TELEGRAM_SECRET` for the protected
    real canary gate.

## Blocked

- `npm run db:verify`
  - Blocked: `DATABASE_URL is required for PostgreSQL-backed runtime.`
  - Compensating evidence: pg-mem integration applied the full migration set
    through `2000_ot84_telegram_action_gateway` and verified durable repository
    behavior.

## Not Run

- Real Telegram canary/provider delivery.
  - Blocked by missing protected Telegram bot token, webhook secret, runtime
    identity mapping, and allowlisted private canary chat.
