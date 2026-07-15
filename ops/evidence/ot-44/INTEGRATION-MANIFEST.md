# OT-44 Integration Manifest

Base SHA: `571b18f36cdc645f757cc3be6b0519f1af3225f6`.

Branch: `codex/parallel-ot44-communications-v1a`.

PR base ref: `codex/parallel-base-ot40-571b18f`.

OT-60R convergence branch: `codex/ot60r-recovery-convergence`.

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

- `ReadOnlySessionScopePort`: bound in OT-60R through a non-mutating session query in `apps/web/src/server/app.ts`.
- `CommunicationsReadRepository`: current Postgres adapter reads local outbox intents and bounded contact context only.

OT-60R wiring:

1. Imported and called `registerCommunicationsRoutes` from `apps/web/src/server/app.ts`.
2. Bound `ReadOnlySessionScopePort` to a non-mutating resolver that supplies server-only account/product scope.
3. Imported `communicationsRouteDescriptor` into the accepted authenticated CRM shell navigation.
4. Imported `contactCommunicationsTabDescriptor` into the accepted contact-detail flow as `/app/crm/contacts/:contactId/communications`.
5. Kept CRM Overview default silent: no Communications import, prefetch, hidden mount, or API request.
6. Rebuilt and inspected emitted Communications lazy chunk through `npm run build`.

Still pending:

- Run real PostgreSQL plan fixture and integrated 30-run performance proof.

Collision risks:

- Shared app/shell/CRM files were touched in OT-60R; keep future edits aligned with the lazy route/no-prefetch invariant.
- No migration collision exists because no migration was added.
- Integrated lazy chunk and shell-route collision risk was handled in the OT-60R convergence branch.

Rollback:

- Remove the owned paths listed above.
- No migration rollback is required.
