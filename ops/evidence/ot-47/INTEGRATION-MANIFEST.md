# OT-47 Integration Manifest

Status: blocked before implementation by `STOP_REAL_POSTGRESQL_UNAVAILABLE`.

## Current Branch Contract

- Approved base SHA: `a73458d1884b8fcb4843c4852425009577f59ef7`
- Current head SHA before stop evidence: `a73458d1884b8fcb4843c4852425009577f59ef7`
- Worktree: `../onetimev2-parallel-ot47-content-library`
- Branch: `codex/parallel-ot47-content-library-foundation`
- Draft PR base: `codex/parallel-base-a73458d`
- Provider mode: `sink`
- Provider readiness: `NOT_PROVEN`

## Strict Ownership

Only `ops/evidence/ot-47/**` is changed in this blocked stop report.

If unblocked, the OT-47 implementation inventory must remain limited to:

- `packages/db/migrations/1400_ot47_content_library.sql`
- `packages/contracts/src/content-library/**`
- `packages/domain/src/content-library/**`
- `packages/db/src/content-library/**`
- `apps/web/src/server/content-library/**`
- `apps/web/src/client/app/content-library/**`
- `apps/worker/src/content-library/**`
- `tests/unit/*ot47*content-library*.test.ts`
- `tests/integration/*ot47*content-library*.test.ts`
- `tests/e2e/*ot47*content-library*.spec.ts`
- `tests/accessibility/*ot47*content-library*.spec.ts`
- `tests/performance/*ot47*content-library*.spec.ts`
- `ops/evidence/ot-47/**`

## Forbidden Hotspots

No implementation may edit these files on this branch:

- `apps/web/src/server/app.ts`
- shared AppShell, navigation, header, footer, CRM, or route-entry files
- root `package.json` or lockfiles
- `.github/workflows/**`
- `packages/config/src/index.ts`
- central `index.ts` or other barrel exports
- existing auth, lead, CRM, delivery, worker, class, portal, communications,
  Stripe, Telegram, Railway, DNS, provider, or BNA code
- another task's migration/evidence roots
- OT-43 roots

## Future Hook Signatures

When unblocked, OT-47 should provide isolated hooks using direct imports:

- `createContentLibraryRouter(dependencies)`
- `createContentOutcomeIngestRouter(dependencies)`
- `registerContentLibraryWorker(dependencies)`
- `ContentLibraryRoute`
- `ClassOccurrenceReference`

`ClassOccurrenceReference` must be opaque and scoped. It must not implement
OT-43, create OT-43 tables, create OT-43 foreign keys, or resolve joins.

## Future Integration Order

1. Apply `1400_ot47_content_library.sql` in a safe non-production database.
2. Mount `createContentOutcomeIngestRouter` only when signed ingest is enabled.
3. Mount `createContentLibraryRouter` only when library API/UI is enabled.
4. Add the authenticated app route and navigation entry only after route, role,
   bundle, and accessibility evidence passes.
5. Register `registerContentLibraryWorker` in the existing worker process only
   after real PostgreSQL claim/retry tests pass.
6. Keep provider mode `sink` until provider-readiness evidence is upgraded by a
   separate approved packet.

## Environment Names Only

The future implementation may need names equivalent to:

- `ENABLE_CONTENT_LIBRARY_UI`
- `ENABLE_CONTENT_LIBRARY_API`
- `ENABLE_CONTENT_OUTCOME_INGEST`
- `ENABLE_CONTENT_EVENT_WORKER`
- `ENABLE_CONTENT_PROTECTED_PLAYBACK`
- `ENABLE_CONTENT_PROVIDER_RECONCILIATION`
- `CONTENT_LIBRARY_PROVIDER_MODE`
- `CONTENT_OUTCOME_ALLOWED_SOURCE`
- `CONTENT_OUTCOME_SIGNING_KEYS`
- `CONTENT_OUTCOME_CURRENT_KEY_ID`
- `CONTENT_EVENT_MAX_ATTEMPTS`

No values are committed. This stop report does not edit `.env.example` because
OT-47 implementation is blocked and central config wiring is outside the strict
ownership set.

## Collision Map

- Worktree collision: none before creation.
- Feature branch collision: none local or remote before creation.
- Immutable anchor collision: absent before creation; created and pushed at the
  approved base.
- Migration collision: none for `1400`; existing migrations are `0001` and
  `0002`.
- Shared-file collision: avoided by stopping before implementation.
