# OT-111 Resume

Worktree:

`C:\Users\User\.batch-20260716-worktrees\OT-111`

Branch:

`codex/ot111-legacy-activation-campaign`

Base:

`origin/codex/ops03-staging-readiness-repair` at `fb5f5eebc539afc9e93833e9417ee67524d62c36`.

If resuming:

1. Confirm `git status --short --branch`.
2. Read `ops/codex-runs/OT-111/STATE.json` and this file.
3. Run the focused OT-111 tests listed in `FINAL-REPORT.md` or `STATE.json`.
4. Do not run real imports, production sends, production deploys, DNS changes, live charges, or BNA mutations.

Current implementation direction:

- Contracts: `packages/contracts/src/audience-reconciliation/index.ts`
- Domain: `packages/domain/src/audience-reconciliation/service.ts`
- Campaign service: `packages/domain/src/audience-reconciliation/activation-campaign.ts`
- Persistence: `packages/db/src/audience-reconciliation/repository.ts`
- Migration: `packages/db/migrations/2010_ot111_legacy_activation_campaign.sql`
- Router: `apps/web/src/server/features/audience-reconciliation/router.ts`
- UI summary: `apps/web/src/client/features/audience-reconciliation/AudienceReconciliationPanel.tsx`
- Synthetic CLI: `scripts/ot111/legacy-activation-campaign-dry-run.ts`
