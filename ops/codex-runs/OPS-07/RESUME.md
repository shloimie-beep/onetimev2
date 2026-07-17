# OPS-07 Resume

Status: `gates_ready_with_blocking_findings`

Run:

```bash
npx tsx scripts/ux-certify/ops07-build-matrices.ts
npx playwright test tests/ux/ops07-dayone-route-gates.spec.ts
npx playwright test tests/visual/ops07-visual-matrix.spec.ts
```

OPS-08 should run these gates against the final integration candidate and treat `FAIL` rows as product defects unless explicitly superseded by a newer completed input branch.
