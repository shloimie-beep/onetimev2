# OT-88 Implementation Map

Status: `LOCAL_IMPLEMENTATION_COMPLETE_PENDING_PR_CI`.

## Product Slice

- Daily 19:00 Asia/Jerusalem occurrence projection is implemented in the classroom domain service with deterministic contract tests for summer and winter offsets.
- Household entitlement, consent, active learner count, occurrence window, provider state, session, CSRF, and student actor checks gate learner launch.
- Each learner receives a separate protected launch grant. Parent portal views classroom state but cannot launch a student session.
- Launch HTML and bootstrap JSON use opaque references only. Synthetic SDK payloads do not expose provider join links.
- Sink-mode provider state is available when enabled. Real provider mode fails closed unless runtime configuration is deliberately present, and provider mutations remain disabled.
- Student classroom UI includes join, launch retry, provider-unavailable state, and question submission. Parent portal includes read-only classroom status.
- Student questions persist encrypted payloads plus redacted excerpts; Telegram/action-gateway moderation paths use redacted question records and do not call the provider.

## Main Files

- `packages/contracts/src/classroom/index.ts`
- `packages/config/src/index.ts`
- `packages/db/migrations/2100_ot88_zoom_learner_classroom.sql`
- `packages/db/src/classroom/repository.ts`
- `packages/domain/src/classroom/service.ts`
- `apps/web/src/server/app.ts`
- `apps/web/src/client/app/portal-api.ts`
- `apps/web/src/client/app/portal-entry.tsx`
- `apps/web/src/client/features/portals/PortalFeatures.tsx`
- `packages/domain/src/telegram/application-adapter.ts`
- `packages/domain/src/telegram/commands.ts`

## Test Coverage

- `tests/unit/classroom/classroom-contracts.test.ts`
- `tests/integration/classroom/zoom-learner-classroom.test.ts`
- Existing portal, Telegram, migration, e2e, accessibility, and performance suites were updated or stabilized where the classroom slice changed shared behavior.
