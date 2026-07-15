#!/usr/bin/env bash
set -euo pipefail

npm run typecheck
npm run lint
npx prettier --check \
  apps/telegram-bot/src/ingress.ts \
  apps/web/src/server/app.ts \
  packages/config/src/index.ts \
  packages/contracts/src/index.ts \
  packages/contracts/src/telegram/types.ts \
  packages/contracts/src/action-gateway/events.ts \
  packages/domain/src/index.ts \
  packages/domain/src/telegram/commands.ts \
  packages/domain/src/telegram/crypto.ts \
  packages/domain/src/telegram/identity.ts \
  packages/domain/src/telegram/memory.ts \
  packages/domain/src/telegram/application-adapter.ts \
  packages/db/src/telegram/repositories.ts \
  packages/observability/src/index.ts \
  tests/integration/telegram-db-foundation.test.ts \
  tests/unit/telegram/telegram-foundation.test.ts \
  tests/unit/telegram/ot84-action-gateway.test.ts \
  ops/codex-runs/OT-84/STATE.json \
  ops/codex-runs/OT-84/BASE-HEAD.json \
  ops/codex-runs/OT-84/CANARY.json \
  ops/codex-runs/OT-84/PROVIDER-MUTATIONS.json \
  packages/contracts/src/action-gateway/action-gateway-event-v1.schema.json \
  packages/contracts/src/action-gateway/intent-compiler-output-v1.schema.json
npm run secret:scan
npx vitest run --config vitest.unit.config.ts tests/unit/telegram/telegram-foundation.test.ts tests/unit/telegram/ot84-action-gateway.test.ts
npx vitest run --config vitest.integration.config.ts tests/integration/telegram-db-foundation.test.ts
npm run build

set +x
if [[ -z "${ONE_TIME_TELEGRAM_BOT_TOKEN_AVAILABLE:-}" ||
  -z "${ONE_TIME_TELEGRAM_WEBHOOK_SECRET_AVAILABLE:-}" ||
  -z "${ONE_TIME_TELEGRAM_CANARY_MAPPING_AVAILABLE:-}" ||
  -z "${ONE_TIME_TELEGRAM_CANARY_APPROVED:-}" ]]; then
  echo "NOT_RUN_WAITING_FOR_TELEGRAM_SECRET"
  exit 0
fi

echo "Real canary requires the protected deployment boundary and is not executed by this local script."
