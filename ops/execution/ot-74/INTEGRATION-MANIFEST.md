# OT-74 Integration Manifest

## Branch

- Repository: `webcraft-media/onetimev2`
- Branch: `codex/ot74-audience-reconciliation`
- Base SHA: `dfef7de2035e08f1ee72e0133ccf656fe7a74444`
- PR base: `codex/ot60r-recovery-convergence`

## Implemented Owned Paths

- `packages/db/migrations/12xx_*`
- `packages/contracts/src/audience-reconciliation/*`
- `packages/domain/src/audience-reconciliation/*`
- `packages/db/src/audience-reconciliation/*`
- `apps/web/src/server/features/audience-reconciliation/*`
- `apps/web/src/client/features/audience-reconciliation/*`
- `scripts/ot74/*`
- `tests/unit/ot74-audience-*`
- `tests/integration/ot74-audience-*`
- `ops/execution/ot-74/*`
- `ops/evidence/ot-74/*`

## Explicit Non-Wiring

- No edits to `apps/web/src/server/app.ts`.
- No edits to AppShell or the central CRM entry.
- No edits to shared barrels or root package files unless an existing local test/tooling path proves it is required.
- No production import, send, deployment, provider mutation, or production database write.

## OT-80 Wiring Hooks

- Server router factory: `createOt74AudienceReconciliationRouter` from `apps/web/src/server/features/audience-reconciliation/router.ts`.
- Repository factory: `createPostgresLegacyAudienceRepository` from `packages/db/src/audience-reconciliation/repository.ts`.
- Client panel: `AudienceReconciliationPanel` from `apps/web/src/client/features/audience-reconciliation/AudienceReconciliationPanel.tsx`.
- Segment contracts: `legacyAudienceSegmentContracts` from `packages/domain/src/audience-reconciliation/service.ts`.

OT-80 must provide authenticated session guards, CSRF verification, and route/client mounting. OT-74 does not wire those hooks.
