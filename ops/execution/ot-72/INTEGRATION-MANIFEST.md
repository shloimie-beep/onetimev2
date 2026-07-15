# OT-72 Integration Manifest

## Purpose

OT-72 will expose server-only, default-off provider adapters and typed registration hooks for OT-80. This branch must not mount shared UI, central route wiring, public landing/signup UI, CRM UI, or portal UI.

## Planned Provider Surfaces

| Phase | Provider      | Planned Surface                                                            | Default |
| ----- | ------------- | -------------------------------------------------------------------------- | ------- |
| 1     | Stripe        | Test-mode billing adapter, webhook/event truth, safe billing DTOs          | Off     |
| 2     | Resend/WAPI   | Deny-by-default dispatch adapters, provider truth ingestion, sink fixtures | Off     |
| 3     | Zoom          | Protected live-class readiness/launch adapter seam                         | Off     |
| 4     | Vimeo         | Protected playback/readiness/outcome adapter seam                          | Off     |
| 5     | Telegram      | Separate One Time bot transport and webhook ingress                        | Off     |
| 6     | BNA oversight | Redacted asynchronous producer-side outcome contract                       | Off     |

## Implemented Direct Paths

- Stripe test adapter: `packages/domain/src/billing/stripe-test-adapter.ts`
- Delivery provider config/router/webhooks: `apps/worker/src/delivery/provider-config.ts`, `apps/worker/src/delivery/provider-router.ts`, `apps/worker/src/delivery/provider-webhooks.ts`
- Provider event contracts/helpers/repository: `packages/contracts/src/providers/events.ts`, `packages/domain/src/providers/provider-events.ts`, `packages/db/src/providers/repository.ts`
- Zoom seam: `packages/domain/src/providers/zoom.ts`
- Vimeo seam: `packages/domain/src/providers/vimeo.ts`
- Telegram config/transport: `packages/domain/src/telegram/config.ts`, `packages/domain/src/telegram/transport.ts`
- Oversight contract/builder: `packages/contracts/src/providers/oversight.ts`, `packages/domain/src/providers/oversight.ts`
- BNA follow-up manifest fixture: `ops/execution/ot-72/BNA-FOLLOWUP-MANIFEST.json`
- Migration: `packages/db/migrations/1700_ot72_provider_truth.sql`

## Collision Boundaries

- No shared AppShell/navigation edits.
- No central route registration/application composition edits.
- No parent/student portal UI edits.
- No CRM UI edits.
- No shared auth/session logic edits.
- No public landing/signup UI edits.

Any test-only composition change must be documented here before commit.

No central route registration, AppShell, portal UI, CRM UI, shared auth/session logic, public landing/signup UI, webhook registration, long-lived consumer or deployment wiring was changed.

The BNA oversight follow-up manifest is a producer-side contract fixture only.
It allows a future asynchronous BNA consumer packet but forbids synchronous BNA
calls and confirms no BNA runtime files are edited by OT-72.

Test-only harness repair: `scripts/postgres-assurance/run.ts` now marks
ephemeral database teardown before closing fixture pools and suppresses only the
expected PostgreSQL `57P01` pool error emitted during that teardown. It does not
change migrations, provider runtime, route wiring, or production database code.

## Draft PR

- URL: https://github.com/webcraft-media/onetimev2/pull/18
- Base: `codex/ot60r-recovery-convergence`
- Head: `codex/ot72-provider-sandbox-train`
- Draft: yes
