# OT-74 Integration Manifest

## Branch

- Repository: `webcraft-media/onetimev2`
- Branch: `codex/ot74-audience-reconciliation`
- Base SHA: `dfef7de2035e08f1ee72e0133ccf656fe7a74444`
- PR base: `codex/ot60r-recovery-convergence`

## Implemented Owned Paths

- `packages/db/migrations/1200_ot74_audience_reconciliation.sql`
- `packages/db/migrations/1201_ot74_legacy_audience_reconciliation.sql`
- `packages/contracts/src/audience/*`
- `packages/contracts/src/audience-reconciliation/*`
- `packages/domain/src/audience/*`
- `packages/domain/src/audience-reconciliation/*`
- `packages/db/src/audience-reconciliation/*`
- `apps/web/src/server/features/audience/*`
- `apps/web/src/server/features/audience-reconciliation/*`
- `apps/web/src/client/app/audience/*`
- `apps/web/src/client/features/audience-reconciliation/*`
- `scripts/audience-reconciliation-dry-run.ts`
- `scripts/support/audience-synthetic-fixtures.ts`
- `scripts/ot74/*`
- `tests/unit/audience/*`
- `tests/unit/ot74-audience-*`
- `tests/integration/audience/*`
- `tests/integration/ot74-audience-*`
- `ops/execution/ot-74/*`
- `ops/evidence/ot-74/*`

## Explicit Non-Wiring

- No edits to `apps/web/src/server/app.ts`.
- No edits to AppShell or the central CRM entry.
- No edits to shared barrels or root package files.
- No production import, send, deployment, provider mutation, or production database write.

## OT-80 Wiring Hooks

- Remote router factory: `createAudienceImportRouter` from `apps/web/src/server/features/audience/router.ts`.
- Local router factory: `createOt74AudienceReconciliationRouter` from `apps/web/src/server/features/audience-reconciliation/router.ts`.
- Local repository factory: `createPostgresLegacyAudienceRepository` from `packages/db/src/audience-reconciliation/repository.ts`.
- Local client panel: `AudienceReconciliationPanel` from `apps/web/src/client/features/audience-reconciliation/AudienceReconciliationPanel.tsx`.
- Remote client preview: `AudienceImportPreview` from `apps/web/src/client/app/audience/AudienceImportPreview.tsx`.
- Segment contracts: `legacyAudienceSegmentContracts` from `packages/domain/src/audience-reconciliation/service.ts`.

OT-80 must choose and wire the final surface, provide authenticated session guards, CSRF verification, route/client mounting, and any real input gate. OT-74 does not mount these hooks.
