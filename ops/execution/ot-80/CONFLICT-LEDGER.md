# OT-80 Conflict Ledger

## OT-71

Merged `origin/codex/ot71-product-core-train` without conflicts.

Carried forward:

- OT-71 migration `1700_ot71_account_lifecycle.sql` is now present.
- OT-72 also has a `1700` provider-truth migration; OT80 must renumber the
  provider-truth migration during OT-72 integration.
- OT-71 Phase 6 combined proof/publication is pending and will be completed
  after all lanes converge.

## OT-74

Merged `origin/codex/ot74-audience-reconciliation` with one registry conflict
in `ops/execution/registry.json`.

Resolved deliberately:

- Kept existing OT60R/OT80 registry entries and added the OT74 entry.
- Chose the legacy `audience-reconciliation` implementation as the single
  canonical audience path for OT80.
- Removed the parallel generic `audience` import-preview implementation,
  migration, synthetic helper, and tests from the merge result.
- Retained migration `1201_ot74_legacy_audience_reconciliation.sql`.
- Rejected duplicate migration `1200_ot74_audience_reconciliation.sql`.

Verification before checkpoint:

- `npm run typecheck` - PASS.
- `npx vitest run --config vitest.unit.config.ts tests/unit/ot74-audience-reconciliation.test.ts tests/unit/ot74-audience-panel.test.ts` - PASS, 6 tests.
- `npx vitest run --config vitest.integration.config.ts tests/integration/ot74-audience-repository.test.ts tests/integration/ot74-audience-router.test.ts` - PASS, 8 tests.
- `npx tsx scripts/ot74/audience-dry-run.ts --rows=10000` - PASS, counts-only output with `raw_row_contents_included: false` and `production_side_effects: false`.

Known required collision work from the OT80 packet:

- OT-71 and OT-72 both use migration prefix `1700`; provider-truth migration
  must be renumbered to the next stable free prefix during integration.
- OT-75 must preserve OT-72 PostgreSQL teardown guard.
- OT-71 and OT-72 Telegram DB test overlap must be reconciled without weakening
  product isolation or provider-truth assertions.
- OT-71 and OT-73 public-page build changes must be reconciled so public,
  Parent, and Student pages build as isolated entries.
- Execution registry entries from OT-73, OT-74, and OT-76 must be merged
  semantically.
- OT80 must retain one auth/session/CSRF/MFA/capability system, one CRM API,
  one outbox, one delivery worker, one class/content model, and one
  Parent/Student portal model.
