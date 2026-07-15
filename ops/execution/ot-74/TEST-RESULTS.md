# OT-74 Test Results

## Local Line Before Merge

- `npm ci`: PASS. Installed 348 packages from lockfile; npm reported 0 vulnerabilities.
- `npx vitest run --config vitest.unit.config.ts tests/unit/ot74-audience-reconciliation.test.ts tests/unit/ot74-audience-panel.test.ts`: PASS, 6 tests.
- `npx vitest run --config vitest.integration.config.ts tests/integration/ot74-audience-repository.test.ts tests/integration/ot74-audience-router.test.ts`: PASS, 8 tests.
- `npm run typecheck`: PASS.
- `npm run lint`: PASS.
- `npm run secret:scan`: PASS across 328 repo text files after evidence docs.
- `npx prettier --check --ignore-unknown <OT-74 supported files>`: PASS. SQL migration excluded because this repo has no SQL parser.
- `npx tsx scripts/ot74/audience-dry-run.ts --rows=10000`: PASS. Printed counts/reasons only with `raw_row_contents_included: false` and `production_side_effects: false`.
- `npm run build`: PASS.
- `psql --version` and `docker --version`: BLOCKED. Local PostgreSQL 16 proof unavailable because neither command is installed.

## After Merge Resolution

- `npm run typecheck`: PASS.
- `npx vitest run --config vitest.unit.config.ts tests/unit/audience/audience-reconciliation.test.ts tests/unit/ot74-audience-reconciliation.test.ts tests/unit/ot74-audience-panel.test.ts`: PASS, 17 tests.
- `npx vitest run --config vitest.integration.config.ts tests/integration/audience/audience-migration.test.ts tests/integration/ot74-audience-repository.test.ts tests/integration/ot74-audience-router.test.ts`: PASS, 10 tests.
- `npm run lint`: PASS.
- `npm run secret:scan`: PASS across 360 repo text files.
- `npx tsx scripts/audience-reconciliation-dry-run.ts`: PASS. Summary JSON reports zero production writes, sends, provider mutations, and real spreadsheet ingestion.
- `npx tsx scripts/ot74/audience-dry-run.ts --rows=10000`: PASS. Counts/reasons only, `raw_row_contents_included: false`, `production_side_effects: false`.
- `npm run build`: PASS.
