# OT-LIVE-003.02 handoff

## Identity

- Branch: `codex/ot-live-003-reply-copilot-20260803`
- Base: `cf30a6ca10695fb4e6b9859e7e4aba9c77831b2f` (`origin/codex/v21-integration`)
- Final implementation SHA before handoff/evidence metadata: `dd32f14011bb59239a43cb90d566c5415b060209`
- Lane: C00-confirmed sole non-colliding One Time GHL-to-Telegram reply-copilot lane
- Production/provider authority: none; all actual effects are zero

## Delivered behavior

- Normalizes workflow `Customer Replied` and official OAuth `InboundMessage` events, permits only inbound Email at location `pBSnOK2nkdxp6gf9Rg3o`, bounds raw/body/attachment inputs, fences duplicates, and keeps private content encrypted.
- Verifies the temporary shared-secret path and the canonical raw-body Ed25519 signature path, then acknowledges without polling or Student/contact creation.
- Applies deterministic protected administrative routing with low-confidence Shloimie fallback. AI classification cannot override a protected class.
- Creates grounded, versioned Rabbi suggestions or `NO_SUGGESTION_REVIEW_REQUIRED`; no suggestion is auto-sent or auto-promoted into the voice profile.
- Produces bounded private Telegram cards and binds callbacks to chat, user, product, workspace, conversation, source, version, and expiry. Edited replies require a separate final preview and confirmation.
- Implements leased Telegram and GHL outbox dispatchers with durable idempotency contracts, bounded retry, unknown-result reconciliation, dead-lettering, redacted audit, and replay fencing.
- Sends the current HighLevel Email request fields needed to preserve the source conversation/thread, then reads the returned message back and dead-letters any body/conversation/thread drift.
- Records encrypted/expiring `accepted_exact`, `edited`, and non-voice `rejected` outcomes. Profile changes remain proposals requiring explicit administrator approval and rollback.
- Keeps the distinct service healthy while provider-off. No signup, landing, portal, BNA, shared bot consumer, or existing route registration was changed.

## Endpoint and event contract

These routes are defined for the distinct One Time service but are not registered or deployed by this lane:

| Method/path                              | Event                                  | Verification                       |
| ---------------------------------------- | -------------------------------------- | ---------------------------------- |
| `POST /webhooks/ghl/customer-replied`    | temporary workflow Customer Replied    | `x-onetime-webhook-secret`         |
| `POST /webhooks/ghl/inbound-message`     | official OAuth `InboundMessage`        | raw-body `x-ghl-signature` Ed25519 |
| `POST /webhooks/telegram/one-time-rabbi` | callback or private reply-to-bot draft | `x-telegram-bot-api-secret-token`  |
| `GET /health`                            | liveness, including provider-off       | none                               |
| `GET /ready`                             | redacted readiness/presence report     | internal service only              |

- Route table: `ot-live-003.02-route-v1`
- Suggestion prompt: `ot-live-003.02-suggestion-v1`
- Model contract: `deterministic-grounded-v1`
- Runtime identity: `one_time_rabbi_torah_console`

## Feature flags

All default to `false`:

- `ONE_TIME_REPLY_COPILOT_ENABLED`
- `ONE_TIME_REPLY_COPILOT_WORKFLOW_INGRESS_ENABLED`
- `ONE_TIME_REPLY_COPILOT_OAUTH_INGRESS_ENABLED`
- `ONE_TIME_REPLY_COPILOT_TELEGRAM_DELIVERY_ENABLED`
- `ONE_TIME_REPLY_COPILOT_GHL_DELIVERY_ENABLED`

## Required protected configuration at this task checkpoint

Only presence was inspected; no values were printed or committed.

| Configuration                      | State  |
| ---------------------------------- | ------ |
| distinct Rabbi Telegram token      | absent |
| distinct Telegram webhook secret   | absent |
| Rabbi private chat/user mapping    | absent |
| Shloimie private chat/user mapping | absent |
| GHL token                          | absent |
| temporary workflow shared secret   | absent |
| private payload key                | absent |
| callback signing key               | absent |

The runtime reads only `ONE_TIME_RABBI_TELEGRAM_BOT_TOKEN`; generic and BNA token names are deliberately ignored.

## Migration

- Current branch census maximum: `2259`
- Candidate requested: `2260_ot_live_003_reply_copilot.sql`
- Status: `REJECTED FOR NOW / NOT GRANTED`; no migration file, SQL adapter, or shared registration was created
- Exact additive schema proposal: `ops/codex-runs/OT-LIVE-003/MIGRATION-PROPOSAL.md`
- Decision evidence: production fence terminal/released at control SHA `d51d317c0a97549345ec557f6fabbbbbce309915`; the collision-free census ends at 2259, but no valid F02 semantic proposal allocates this purpose
- Authority required: exact F02 approval for `packages/db/migrations/2260_ot_live_003_reply_copilot.sql`, followed by a no-semantic-change C00 mirror under the current lease protocol

Until that authority exists, persistent storage, migration verification, the final executable composition, and any staging provider canary remain blocked. The memory store is test/canary-only and is not a production fallback.

## Changed paths

- `apps/telegram-bot/src/reply-copilot/**`
- `packages/contracts/src/telegram/reply-copilot.ts`
- `packages/domain/src/telegram/reply-copilot/**`
- `tests/unit/telegram/reply-copilot/**`
- `tests/integration/telegram-reply-copilot.test.ts`
- `tests/integration/telegram-reply-copilot-canary.test.ts`
- `ops/release/ot-live-003/**`
- `ops/codex-runs/OT-LIVE-003/**`

No controller, existing route registration, shared deployment, GHL UI, production, DNS, BNA, signup, portal, landing, billing, campaign, or Vimeo path changed.

## Verification

- `npm run build` — passed (includes client/page builds and TypeScript)
- `npm run typecheck -- --pretty false` — passed
- targeted Prettier and ESLint — passed
- focused Vitest suite — 32 passed across 6 files
- `npm run secret:scan` — passed
- `git diff --check` — passed
- migration verification — blocked by the unallocated migration
- browser UI flow — not applicable; this is a webhook/private-bot service. The focused HTTP tests use a real local Node server and fetch requests.

## Canary and effects

`npx tsx ops/release/ot-live-003/synthetic-canary.ts` passed all 14 requested controls at `2026-08-03T18:14:17Z` on implementation SHA `dd32f140...`.

- Simulated: 2 Telegram cards (initial plus final preview), 1 GHL same-thread message, 1 approved voice example
- Actual Telegram messages: 0
- Actual GHL messages: 0
- BNA events/consumption: 0
- Provider mutations: 0
- Production deployments: 0

## Controller integration

1. Submit the unchanged `MIGRATION-PROPOSAL.md` to F02. F02 performs a fresh census and either allocates the exact requested path/purpose or returns a replacement number/scope; C00 may then mirror the exact decision without semantic change.
2. OT-LIVE-003 adds only the allocated migration, isolated PostgreSQL store, migration tests, and distinct-service executable; it reruns this entire focused evidence set and pushes the result.
3. OT-LIVE-001 reviews/merges the clean branch, creates the distinct service, mounts only the listed routes, supplies protected config through the provider secret manager, and retains production deployment authority.
4. OT-LIVE-002 alone configures the temporary GHL workflow path if it is still needed. The canonical OAuth route remains preferred.
5. In isolated staging, validate redacted readiness, enable one ingress path, then Telegram delivery, then GHL delivery for the single protected seed canary. Keep broad delivery false until the readback and zero-duplicate evidence are accepted.

## Rollback and one safe operator action

Rollback before activation is to keep all five flags false and stop/remove only the distinct service; existing signup, GHL sync, Telegram/BNA, and customer surfaces are unaffected. After any allocated migration is applied, rollback must use an F02-allocated forward migration rather than destructive table drops from this lane.

Consolidated operator action: after F02/C00 allocates the migration, have OT-LIVE-001 provision the distinct One Time Rabbi service and inject the named protected variables/mappings from `ops/release/ot-live-003/environment-schema.json` through the secret manager—without sharing or exposing values—then run the one-seed staging canary and enable customer delivery only if all 14 controls pass.
