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

## OT-72

Merged `origin/codex/ot72-provider-sandbox-train` with one content conflict in
`tests/integration/telegram-db-foundation.test.ts`.

Resolved deliberately:

- Preserved OT71 account-lifecycle migration coverage.
- Preserved OT72's explicit Telegram foundation migration assertion.
- Renamed OT72 provider-truth migration from `1700_ot72_provider_truth.sql` to
  `1800_ot72_provider_truth.sql`.
- Updated the OT72 provider-truth test, Telegram migration-order test, and
  OT72 integration references to `1800_ot72_provider_truth`.
- Preserved the OT72 PostgreSQL assurance teardown guard in
  `scripts/postgres-assurance/run.ts`.

Verification before checkpoint:

- `npm run typecheck` - PASS.
- `npx vitest run --config vitest.unit.config.ts tests/unit/ot72-provider-adapters.test.ts` - PASS, 8 tests.
- `npx vitest run --config vitest.integration.config.ts tests/integration/ot72-provider-truth.test.ts tests/integration/telegram-db-foundation.test.ts` - PASS, 3 tests.

## OT-73

Merged `origin/codex/ot73-landing-intent-reconciliation` without textual
conflicts.

Resolved deliberately after auto-merge review:

- Preserved OT73's corrected-addendum ticker, self-hosted font, and public
  landing layout/copy changes.
- Kept the Day-One communications success-copy policy for Family and School.
- Updated the generated signup fallback panel to call `successCopy('family')`
  instead of using stale hardcoded class-details copy.
- Confirmed no School public email/WhatsApp send path or class-access promise
  was reintroduced.

Verification before checkpoint:

- `npm run typecheck` - PASS.
- `npx vitest run --config vitest.unit.config.ts tests/unit/lead-validation.test.ts tests/unit/delivery/catalog.test.ts` - PASS, 10 tests.
- `npm run build` - PASS.
- `npx vitest run --config vitest.integration.config.ts tests/integration/lead-capture.test.ts tests/integration/communications/api.test.ts` - PASS, 14 tests.
- `npx playwright test tests/e2e/landing-signup.spec.ts --reporter=line` - PASS, 7 tests.

## OT-75

Merged `origin/codex/ot75-release-observability-readiness` without textual
conflicts.

Resolved deliberately after validation:

- OT75's original scope validator compared `dfef7de...HEAD`, which is correct
  for the standalone OT75 branch but invalid for the OT80 conductor after
  earlier lanes are merged.
- Added `--scope-base` / `OT75_SCOPE_BASE_SHA` support to the validator and
  predeploy no-runtime-composition drift gate.
- Used scope base `d7bf846dda1c27aadd61f51c71aa163c70b2b871`, the first parent
  of the OT75 merge commit, to validate only the OT75 contribution.
- Preserved the standalone OT75 default of validating against immutable OT60R
  when no override is provided.

Verification before checkpoint:

- Unscoped conductor validator - EXPECTED FAIL due prior lane files.
- Scoped validator - PASS, 327 checks.
- Scoped predeploy gate checker - PASS in non-failing mode, 11
  activation-only blockers, no-runtime-composition drift passed, zero external
  mutations.
- Release-only unit test - PASS, 6 tests.
- `npm run typecheck` - PASS.
- `npm run lint` - PASS.
- OT75 Prettier check - PASS.

## OT-76

Merged `origin/codex/ot76-day-one-certification-harness` with one registry
conflict in `ops/execution/registry.json`.

Resolved deliberately:

- Kept existing OT60R, OT73, OT74, OT75, and OT80 conductor entries.
- Added the OT76 Day-One certification harness entry.
- Updated OT80 status to `ot76_integrated_checkpoint_ready`.
- Added `--scope-base` / `OT76_SCOPE_BASE_SHA` support to the harness so OT80
  can validate only the OT76 contribution while standalone OT76 keeps the
  immutable-base default.

Verification before checkpoint:

- Harness syntax check - PASS.
- OT76 JSON parse - PASS.
- Audit mode with scope base `bc2bcf2c7e16b5f1885aa65a2904f07578a18169` -
  PASS, 13 gates, 3 pass, 10 blockers, forbidden changed files 0.
- Strict certify with the same scope base - EXPECTED FAIL, candidate not
  Day-One certified.

Known required collision work from the OT80 packet:

- OT-75 preserved OT-72 PostgreSQL teardown guard by avoiding runtime and
  assurance-script changes.
- OT-71 and OT-72 Telegram DB test overlap must be reconciled without weakening
  product isolation or provider-truth assertions.
- OT-71 and OT-73 public-page build changes were reconciled for this checkpoint;
  final certification must still rerun cross-lane public, Parent, and Student
  isolated-entry proof.
- Execution registry entries from OT-73, OT-74, and OT-76 must be merged
  semantically.
- OT80 must retain one auth/session/CSRF/MFA/capability system, one CRM API,
  one outbox, one delivery worker, one class/content model, and one
  Parent/Student portal model.
