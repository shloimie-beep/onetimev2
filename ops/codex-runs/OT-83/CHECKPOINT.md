# OT-83 Checkpoint

Status: `VERIFIED_PARTIAL_CHECKPOINT`

Base:

- OT81: `ff23c9af0c3e3de18cd991097eb6e66032b11546`
- OT82: `a8e4109b0530855bc7a5f56c90104706b9c8cd7c`
- Branch: `codex/ot83-household-portals-foundation`
- Checkpoint commit: `3c5c39327bcc6e4e96cba9016c7d5ea65110aed4`
- Worktree: `C:\Users\User\OneTimeOneTime-ot83-household-portals-foundation`

Implemented in this checkpoint:

- Added parent-managed `revoke_sessions` as a canonical student-access operation.
- Reused the accepted account lifecycle/session invalidation path; no impersonation or parallel auth stack.
- Added migration `1900_ot83_household_portal_foundation.sql`.
- Added OT83 PostgreSQL 16 concurrency proof script and CI workflow.

Local verification passed:

- `npm run typecheck`
- `npm run lint`
- `npm run secret:scan`
- `npm run brand:check`
- `npm run build`
- `npx vitest run tests/ot-52/portal-services.test.ts`
- `npx vitest run --config vitest.integration.config.ts tests/integration/accounts/account-lifecycle.test.ts tests/integration/portals/portal-mount.test.ts`
- `npx prettier --check <touched TS/TSX/YML files>`
- `git diff --check`

Local blocker:

- `npx tsx tests/ot-83/real-postgres-concurrency.ts` wrote blocked evidence because no explicit safe PostgreSQL target was configured locally.

Next action:
Push and open the stacked draft PR, then let `.github/workflows/ot83-postgres-concurrency.yml` run the real PostgreSQL proof.
