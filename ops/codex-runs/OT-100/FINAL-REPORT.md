# OT-100 Final Report

Status: implementation verified locally; real canary blocked by missing protected staging configuration.

## Base And Branch

- Repository: `webcraft-media/onetimev2`
- Base SHA: `fb3c397ce8ece100cf7873fdddcd940a1552ea9b`
- Branch: `codex/ot100-whatsapp-public-provider-activation`
- Draft PR base: `codex/ops03-staging-readiness-repair`

## Implementation

- Added `2100_ot100_whatsapp_provider_activation.sql` for WhatsApp outbox lease fields, encrypted provider message reference fields, retry-after metadata, and delivery status dedupe.
- Completed the Meta Cloud API sender with protected-token config, phone-number ID, WABA ID, pinned Graph `v25.0`, text message payloads, bounded timeout, 429/5xx retry classification, 401/403 permanent failure handling, and no raw destination/body/provider payload logging.
- Kept real provider mode off unless all protected staging/canary gates pass, including exact environment fingerprint, explicit enable flag, allowlisted canary destination, `canary=true` DB row, and canary budget.
- Preserved raw-body webhook signature verification and GET challenge behavior.
- Added lease-safe outbox claims, encrypted provider ID persistence, status projection, duplicate status-event suppression, and feature-local one-shot runner.
- Wrote `OPS04-INTEGRATION-DELTA.md` instead of editing shared `app.ts`, shared worker main, global config, `.env.example`, root manifests, Railway descriptors, auth, landing, CRM, portal, or provider modules.

## Validation

- `npm run unit -- --run tests/unit/whatsapp/ot100-meta-provider.test.ts tests/unit/whatsapp/ot85-intent-contract.test.ts`: passed, 10 tests.
- `npm run integration -- --run tests/integration/whatsapp/ot100-provider-runtime.test.ts tests/integration/whatsapp/ot85-assistant.test.ts tests/integration/whatsapp/ot85-webhook-route.test.ts`: passed, 12 tests.
- `npm run typecheck`: passed.
- `npm run lint`: passed.
- `npm run build`: passed.
- `npm run secret:scan`: passed across 904 repo text files.
- `node --import tsx -e "..."` in-memory migration smoke: passed, latest migration `2100_ot100_whatsapp_provider_activation`.
- `node --import tsx scripts/ot100/whatsapp-runtime-once.ts`: returned `WAITING_FOR_OT100_WHATSAPP_STAGING_CANARY_CONFIG`, `external_send_performed=false`.
- `npx playwright test tests/e2e/support.spec.ts`: passed, 5 tests.
- `npx prettier --check` on changed TS/JSON/MD files: passed. Full-repo `npm run format` remains blocked by pre-existing unrelated formatting drift.
- `git diff --check`: passed with line-ending warnings only.

## Canary

- Canary sends attempted: `0`
- Canary sends completed: `0`
- External sends/provider mutations: `0`
- Blocker: protected staging WhatsApp config is absent in this local environment.

Required protected config names, without values:

- `ONE_TIME_WHATSAPP_GRAPH_VERSION=v25.0`
- `ONE_TIME_WHATSAPP_CLOUD_ACCESS_TOKEN` or `ONE_TIME_WHATSAPP_ACCESS_TOKEN`
- `ONE_TIME_WHATSAPP_PHONE_NUMBER_ID`
- `ONE_TIME_WHATSAPP_WABA_ID`
- `ONE_TIME_WHATSAPP_REAL_STAGING_ENABLED`
- `ONE_TIME_WHATSAPP_PROVIDER_ENV`
- `ONE_TIME_WHATSAPP_STAGING_ISOLATED`
- `ONE_TIME_WHATSAPP_STAGING_ENV_FINGERPRINT`
- `ONETIME_WHATSAPP_CANARY_AUTHORIZED`
- `ONETIME_CANARY_WHATSAPP_RECIPIENT_E164`
- `ONE_TIME_WHATSAPP_CANARY_BUDGET`

## Rollback Or Disable

- Do not set `ONE_TIME_WHATSAPP_REAL_STAGING_ENABLED=true`.
- Keep `ONE_TIME_WHATSAPP_CANARY_BUDGET=0` or unset.
- Do not mark WhatsApp outbox rows `canary=true`.
- Stop using `scripts/ot100/whatsapp-runtime-once.ts`.
- If schema rollback is required before merge, drop the additive OT-100 migration from this branch. After merge, use a forward rollback migration.
