# OT-80 Test Results

## Phase 0

- `git fetch origin --prune` - PASS.
- Remote head freeze - PASS.
- OT-71 through OT-76 ancestry against OT60R - PASS.
- Remote communications hash search - PASS, zero matches.
- Local worktree communications hash search - PASS, zero matches.
- Clean worktree creation - PASS.

No product compile, migration, unit, integration, browser, accessibility,
performance, CI, staging, provider, or send tests have run yet in OT80.

## OT-71 Merge Checkpoint

Initial check attempt before dependency install:

- `npm run typecheck` - BLOCKED, fresh worktree had no `node_modules`
  (`tsc` missing).
- Focused Vitest commands - BLOCKED, fresh worktree had no `vitest` dependency
  available.

Dependency install:

- `npm ci` - PASS, 348 packages installed, 0 vulnerabilities.

Post-install verification:

- `npm run typecheck` - PASS.
- `npx vitest run --config vitest.unit.config.ts tests/unit/classes/schedule.test.ts tests/unit/content/redaction.test.ts tests/unit/delivery/eligibility.test.ts` - PASS, 3 files, 25 tests.
- `npx vitest run --config vitest.integration.config.ts tests/integration/accounts/account-lifecycle.test.ts tests/integration/classes/class-fulfillment.test.ts tests/integration/content/content-library.test.ts tests/integration/dashboard/owner-dashboard.test.ts tests/integration/portals/portal-mount.test.ts tests/integration/lead-capture.test.ts tests/integration/telegram-db-foundation.test.ts` - PASS, 7 files, 28 tests.

Earlier Phase 0 hygiene:

- `npm run secret:scan` - PASS across 358 repo text files after Phase 0.
- `git diff --check` - PASS after Phase 0.

## OT-74 Merge Checkpoint

Canonicalization:

- Retained `audience-reconciliation` as the single audience model.
- Removed the duplicate generic `audience` import-preview code and migration
  from the merge result.

Verification before checkpoint:

- `npm run typecheck` - PASS.
- `npx vitest run --config vitest.unit.config.ts tests/unit/ot74-audience-reconciliation.test.ts tests/unit/ot74-audience-panel.test.ts` - PASS, 2 files, 6 tests.
- `npx vitest run --config vitest.integration.config.ts tests/integration/ot74-audience-repository.test.ts tests/integration/ot74-audience-router.test.ts` - PASS, 2 files, 8 tests.
- `npx tsx scripts/ot74/audience-dry-run.ts --rows=10000` - PASS. Output was counts-only and reported `raw_row_contents_included: false` and `production_side_effects: false`.
- JSON parse for `ops/execution/registry.json`, `STATE.json`, `MIGRATION-LEDGER.json`, `RELEASE-MANIFEST.json`, and `ACTION-AND-ROUTE-REGISTRY.json` - PASS.
- `npm run secret:scan` - PASS across 389 repo text files.
- `git diff --check` - PASS with line-ending warnings only.

## OT-72 Merge Checkpoint

Collision resolution:

- Renamed source-lane migration `1700_ot72_provider_truth.sql` to
  `1800_ot72_provider_truth.sql`.
- Reconciled the Telegram DB migration-order test so it requires OT51,
  OT71, and OT72 migrations.

Verification before checkpoint:

- `npm run typecheck` - PASS.
- `npx vitest run --config vitest.unit.config.ts tests/unit/ot72-provider-adapters.test.ts` - PASS, 1 file, 8 tests.
- `npx vitest run --config vitest.integration.config.ts tests/integration/ot72-provider-truth.test.ts tests/integration/telegram-db-foundation.test.ts` - PASS, 2 files, 3 tests.
- JSON parse for `ops/execution/registry.json`, `STATE.json`, `MIGRATION-LEDGER.json`, `RELEASE-MANIFEST.json`, and `ACTION-AND-ROUTE-REGISTRY.json` - PASS.
- `npm run secret:scan` - PASS across 424 repo text files.
- `git diff --check` - PASS with line-ending warnings only.

## Day-One Communications Checkpoint

Implementation:

- Added server-owned catalog source metadata and 19 message keys from the
  preserved archive.
- Updated active delivery copy/policy for Family acknowledgements, class
  reminders, internal lead alerts, and School no-public-send behavior.
- Required protected One Time app routes before class reminder delivery.

Verification before checkpoint:

- `npm run typecheck` - PASS.
- `npx vitest run --config vitest.unit.config.ts tests/unit/delivery/catalog.test.ts tests/unit/delivery/eligibility.test.ts tests/unit/lead-validation.test.ts tests/unit/communications/communications-contract.test.ts` - PASS, 4 files, 37 tests.
- `npx vitest run --config vitest.integration.config.ts tests/integration/lead-capture.test.ts tests/integration/delivery/outbox-pipeline.test.ts tests/integration/delivery/postgres-repository.test.ts tests/integration/classes/class-fulfillment.test.ts tests/integration/communications/api.test.ts` - PASS, 5 files, 38 tests.
- `npm run secret:scan` - PASS across 426 repo text files.
- `git diff --check` - PASS with line-ending warnings only.

## OT-73 Merge Checkpoint

Reconciliation:

- Preserved the OT73 corrected-addendum ticker, self-hosted font, public landing
  layout/copy, and footer behavior.
- Reconciled the generated signup fallback success panel with the Day-One
  communications domain copy.
- Kept School submissions as public web acknowledgement plus internal alert
  only; no School public email/WhatsApp send path was reintroduced.

Verification before checkpoint:

- `npm run typecheck` - PASS.
- `npx vitest run --config vitest.unit.config.ts tests/unit/lead-validation.test.ts tests/unit/delivery/catalog.test.ts` - PASS, 2 files, 10 tests.
- `npm run build` - PASS, including clean, public/app Vite builds, page
  generation, and typecheck.
- `npx vitest run --config vitest.integration.config.ts tests/integration/lead-capture.test.ts tests/integration/communications/api.test.ts` - PASS, 2 files, 14 tests.
- `npx playwright test tests/e2e/landing-signup.spec.ts --reporter=line` - PASS, 7 tests.

## OT-75 Merge Checkpoint

Reconciliation:

- OT75 merged as preparation-only release/observability assets.
- Added conductor-aware scope-base support to OT75 scripts so OT80 can validate
  only the OT75 merge contribution while preserving standalone OT75 default
  behavior.
- No deployment, DNS, database, provider, message, payment, real-user, or BNA
  mutation was performed.

Verification before checkpoint:

- `node scripts/ot75/validate-release-readiness.mjs --write-report` - EXPECTED FAIL in unscoped OT80 conductor mode because prior OT80 lanes are outside OT75-owned paths.
- `node scripts/ot75/validate-release-readiness.mjs --scope-base d7bf846dda1c27aadd61f51c71aa163c70b2b871 --write-report` - PASS, 327 checks.
- `node scripts/ot75/check-predeploy-gates.mjs --scope-base d7bf846dda1c27aadd61f51c71aa163c70b2b871 --json --out ops/release/ot75/evidence/predeploy-gates.local.json` - PASS in non-failing mode, 11 activation-only blockers, zero external mutations.
- `node --check scripts/ot75/validate-release-readiness.mjs` - PASS.
- `node --check scripts/ot75/check-predeploy-gates.mjs` - PASS.
- `node --check scripts/ot75/render-release-manifest.mjs` - PASS.
- `npx vitest run --config vitest.unit.config.ts tests/unit/ot75/release-readiness.test.ts` - PASS, 1 file, 6 tests.
- `npm run typecheck` - PASS.
- `npm run lint` - PASS.
- `npx prettier --check .github/workflows/ot75-release-readiness.yml ops/release/ot75 ops/observability/ot75 scripts/ot75 tests/unit/ot75` - PASS.
