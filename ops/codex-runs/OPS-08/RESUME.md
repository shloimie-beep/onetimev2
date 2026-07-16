# OPS-08 Resume

Resume from:

- Worktree: `C:\Users\User\.overnight-20260717-worktrees\OPS-08`
- Branch: `integration/ops08-overnight-final-20260716T230543Z`
- Repository: `webcraft-media/onetimev2`

## Immediate Next Steps

1. Refresh remote refs:
   - `git fetch origin --prune +refs/pull/44/head:refs/remotes/origin/pr/44`
2. Re-check PR #44:
   - Current observed head: `3871c38b75e7fc866f572ec80d3b2ec37cde6b6e`
   - Do not merge until conflicts are resolved and green check evidence exists.
3. Re-check OT-113:
   - No remote branch/ref was observed by OPS-08.
   - Expected dependency: repaired PR #44.
4. Re-check OT-114:
   - Observed head: `096dd614c9493cec1c29851e14f56166863ad26b`
   - Merge-tree conflict observed in `apps/web/src/server/app.ts`.
   - Resolve only after PR #44/OT-113 ordering is clear, because support/CRM/server-route changes overlap broad central code.
5. Re-check BNA-OPS-02:
   - No remote One Time input branch observed for `codex/bna-ops02-onetime-support-consumer`.
   - BNA work is canary-readiness only; do not use dirty BNA checkout as One Time source.

## Validation To Repeat After Any New Merge

- `npm run secret:scan`
- `npx prettier --check --ignore-unknown <touched files>`
- `npm run brand:check`
- `npm run lint`
- `npm run typecheck`
- `npm run unit`
- `npm run integration`
- `npm run build`
- `npx playwright test tests/ux/ops07-dayone-route-gates.spec.ts`
- `npm run db:verify` only with a safe non-production `DATABASE_URL`

## Current Known Good Local Evidence

- Unit: 37 files, 189 tests passed.
- Integration: 36 files, 169 tests passed.
- Build, lint, typecheck, brand check, secret scan, diff check passed.
- OPS-07 route gate passed for 8 routes.
- `npm run format` remains blocked by inherited repo-wide baseline formatting drift.
- `npm run db:verify` is blocked without `DATABASE_URL`.
