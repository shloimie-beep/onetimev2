# OT-42 CRM Module V1 Integration Manifest

Task: OT-42-PARALLEL
Integrated branch: codex/ot60r-recovery-convergence
Original branch: codex/parallel-ot42-crm-module-v1
Convergence base: 8ec00b4 (OT-39 recovery checkpoint)
Original base commit: c1584577780d7b5125bce4fb81d2a454c9e84096
Attachment SHA-256: 88C465BA00A717F0B2ADD6676B653C5FAABDAAA6AB1AD6BD2C0161553FA70AFA

## Scope

This branch adds a CRM module surface behind explicit integration hooks. It does not wire the module into the live app shell, mutate production data, or replace the existing canonical PR #2/#5/#7 CRM routes.

The current OT-39 app already owns canonical `/app/crm` and `/api/v1/crm` routes. OT-42 adds a CRM-owned router/register module that a later implementation lane can mount after real session/CSRF guard and repository implementations exist.

Communications UI was not added. The OT-42 packet allowed it only when a qualifying OT-44 read model was present on the verified base; none was present in this worktree.

## New Module Surfaces

- `apps/web/src/server/crm/register.ts`
  - Exports `registerOt42CrmModule(app, deps)`.
  - Exports `createOt42CrmRouter(deps)` for integration tests and future mounting.
  - Requires injected `guards` and `repository` dependencies; it does not create sessions, CSRF policy, or database repositories internally.
  - Applies `Cache-Control: private, no-store, max-age=0`, `Pragma: no-cache`, and `Vary: Cookie, Authorization`.
  - Checks auth/capability before repository access, checks CSRF before mutation repository access, and requires `Idempotency-Key` plus `If-Match` for mutations.

- `packages/contracts/src/crm/capabilities.ts`
  - Defines the OT-42 capability vocabulary for contacts, tags, notes, relationships, tasks, and identity resolution.

- `packages/contracts/src/crm/schemas.ts`
  - Defines request/response schemas, opaque IDs, ETags, filters, mutation headers, tags, notes, relationships, tasks, and identity decisions.

- `packages/domain/src/crm/ot42-capabilities.ts`
  - Maps `owner` and `admin` to the full capability set.
  - Maps `crm_agent` to read/create/edit contact capability only.
  - Maps `viewer` to contact read capability only.

- `packages/domain/src/crm/ot42-protocol.ts`
  - Adds strong opaque ETag generation and canonical request hashing.

- `apps/web/src/client/app/crm/ot42-cache.ts`
  - Adds memory-only protected cache helpers.
  - Namespaces cache data by hashed subject, session family, and capabilities.
  - Provides bounded entries/bytes, TTL, offline stale reads, in-flight dedupe, invalidation, and purge.

- `apps/web/src/client/app/crm/ot42-lazy-tabs.ts`
  - Adds a lazy contact-tab loader for notes, relationships, tasks, and identity data.
  - Uses `fetch(..., cache: "no-store")`.
  - Purges protected cache on 401/403.

## Migration

Migration file: `packages/db/migrations/1000_ot42_crm_module_v1.sql`
Migration SHA-256: D358DF83AF04099B3E3D79E1764D9C6B2F2B433CF1DFFB2FE366FA7D4882B5D0

The migration uses the reserved OT-42 namespace `1000`. It adds:

- contact archive/reactivation metadata columns
- scoped contact/user composite uniqueness needed by downstream foreign keys
- CRM tags and contact-tag assignments
- system facts
- append-only contact notes with deterministic scalar-note backfill
- contact relationships
- contact tasks
- identity resolution decisions
- idempotency records

## Future Integration Contract

The integration lane should mount the module by calling:

```ts
registerOt42CrmModule(app, {
  config,
  pool,
  guards,
  repository,
});
```

Repository implementations must:

- scope every query by `accountKey` and `productKey`
- authorize with the already-resolved actor and capability result
- return opaque resource IDs and strong ETags only
- persist mutation idempotency using `crm_idempotency_records`
- enforce optimistic concurrency with `If-Match`
- avoid GET free-text PII search
- keep public pages and unauthenticated paths free of protected CRM data
- avoid Communications tab wiring until a qualifying communications read model lands

## Touched Ownership

Allowed OT-42 paths only:

- `apps/web/src/client/app/crm/*`
- `apps/web/src/server/crm/*`
- `packages/contracts/src/crm/*`
- `packages/domain/src/crm/ot42-*`
- `packages/db/migrations/1000_ot42_crm_module_v1.sql`
- `tests/unit/ot42-*`
- `tests/integration/ot42-*`
- `ops/evidence/ot-42/*`

No edits were made to:

- `apps/web/src/server/app.ts`
- app shell/global navigation
- root package or lock files
- workflows
- central package barrels
