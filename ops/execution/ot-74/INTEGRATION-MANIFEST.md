# OT-74 Integration Manifest

## Branch

- Repository: `webcraft-media/onetimev2`
- Branch: `codex/ot74-audience-reconciliation`
- Base SHA: `dfef7de2035e08f1ee72e0133ccf656fe7a74444`
- PR base: `codex/ot60r-recovery-convergence`

## Planned Owned Paths

- `packages/db/migrations/12xx_*`
- Feature-local legacy audience domain, repository, contracts, routers, tools, components, fixtures, tests, and evidence.
- `ops/execution/ot-74/*`
- `ops/evidence/ot-74/*`

## Explicit Non-Wiring

- No edits to `apps/web/src/server/app.ts`.
- No edits to AppShell or the central CRM entry.
- No edits to shared barrels or root package files unless an existing local test/tooling path proves it is required.
- No production import, send, deployment, provider mutation, or production database write.
