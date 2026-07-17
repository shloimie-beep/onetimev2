# Summary

Implements OT-100 WhatsApp public provider activation as a guarded staging-only canary path for the One Time provider. The real Meta Cloud API sender is wired behind protected configuration gates, canary row marking, exact recipient allowlisting, a one-message budget, and a pinned Graph API version.

The shared app and worker entrypoints are intentionally untouched. Shared integration notes are captured in `ops/codex-runs/OT-100/OPS04-INTEGRATION-DELTA.md`.

# What Changed

- Added additive WhatsApp runtime migration fields for outbox leasing, encrypted provider message references, retry-after tracking, and delivery status dedupe.
- Added a Meta Cloud API adapter with `v25.0` pinning, 24-hour customer-service-window enforcement, bounded timeout, retry/permanent error classification, and redacted logging posture.
- Added lease-safe queue processing, encrypted provider ID persistence, status webhook dedupe/projection, and dead-letter handling for permanent failures.
- Added `scripts/ot100/whatsapp-runtime-once.ts`, which exits with `WAITING_FOR_OT100_WHATSAPP_STAGING_CANARY_CONFIG` and `external_send_performed=false` unless every protected staging/canary gate is present.
- Added unit and integration coverage for readiness gates, payload shape, retry behavior, canary constraints, lease handling, provider ID storage, and status dedupe.

# Validation

- `npm run unit -- --run tests/unit/whatsapp/ot100-meta-provider.test.ts tests/unit/whatsapp/ot85-intent-contract.test.ts`
- `npm run integration -- --run tests/integration/whatsapp/ot100-provider-runtime.test.ts tests/integration/whatsapp/ot85-assistant.test.ts tests/integration/whatsapp/ot85-webhook-route.test.ts`
- `npm run typecheck`
- `npm run lint`
- `npm run build`
- `npm run secret:scan`
- In-memory migration smoke, latest migration `2100_ot100_whatsapp_provider_activation`
- `node --import tsx scripts/ot100/whatsapp-runtime-once.ts`
- `npx playwright test tests/e2e/support.spec.ts`
- Changed-file `npx prettier --check`
- `git diff --check`

Full-repo `npm run format` is still blocked by pre-existing unrelated formatting drift.

# Canary Status

- Canary sends attempted: `0`
- Canary sends completed: `0`
- External sends/provider mutations: `0`
- Current blocker: protected staging WhatsApp config is not present in this local environment.

# Rollback

Leave `ONE_TIME_WHATSAPP_REAL_STAGING_ENABLED` unset or not `true`, keep `ONE_TIME_WHATSAPP_CANARY_BUDGET=0` or unset, avoid marking rows `canary=true`, and do not run `scripts/ot100/whatsapp-runtime-once.ts`. Before merge, the additive migration can be removed from this branch; after merge, use a forward rollback migration.
