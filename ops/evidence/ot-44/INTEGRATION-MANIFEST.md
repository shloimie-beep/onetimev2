# OT-44 Integration Manifest

Base SHA: `571b18f36cdc645f757cc3be6b0519f1af3225f6`.

Branch: `codex/parallel-ot44-communications-v1a`.

PR base ref: `codex/parallel-base-ot40-571b18f`.

Owned paths:

- `packages/contracts/src/communications/**`
- `packages/domain/src/communications/**`
- `apps/web/src/server/communications/**`
- `apps/web/src/client/app/communications/**`
- `tests/unit/communications/**`
- `tests/integration/communications/**`
- `tests/e2e/ot-44/**`
- `tests/accessibility/ot-44/**`
- `tests/performance/ot-44/**`
- `ops/evidence/ot-44/**`

Migration:

- None.
- No `1200..1299` migration was reserved or created because real PostgreSQL plan proof is unavailable.

Exported hooks:

- `registerCommunicationsRoutes`
- `ReadOnlySessionScopePort`
- `PostgresCommunicationsReadRepository`
- `communicationsRouteDescriptor`
- `contactCommunicationsTabDescriptor`

Adapter contracts:

- `ReadOnlySessionScopePort`: later auth/session binding must be non-mutating.
- `CommunicationsReadRepository`: current Postgres adapter reads local outbox intents and bounded contact context only.

Later wiring:

1. Import and call `registerCommunicationsRoutes` from the accepted server composition point.
2. Bind `ReadOnlySessionScopePort` to a non-mutating session resolver that supplies server-only account/product scope.
3. Import `communicationsRouteDescriptor` into the accepted authenticated route/navigation registry.
4. Import `contactCommunicationsTabDescriptor` into the accepted contact-detail tab registry.
5. Keep CRM Overview default silent: no Communications import, prefetch, hidden mount, or API request.
6. Rebuild and inspect emitted Communications lazy chunk.
7. Run real PostgreSQL plan fixture and integrated 30-run performance proof.

Collision risks:

- Shared app/shell/CRM files are intentionally untouched, so final integration must reconcile route/tab placement.
- No migration collision exists because no migration was added.
- Integrated lazy chunk and shell-route collision risk remains deferred to the later shared-shell wiring branch.

Rollback:

- Remove the owned paths listed above.
- No migration rollback is required.
