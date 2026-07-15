# OT-74 Test Results

- `npm ci`: PASS. Installed 348 packages from lockfile; npm reported 0 vulnerabilities.
- `npx vitest run --config vitest.unit.config.ts tests/unit/ot74-audience-reconciliation.test.ts tests/unit/ot74-audience-panel.test.ts`: PASS, 6 tests.
- `npx vitest run --config vitest.integration.config.ts tests/integration/ot74-audience-repository.test.ts tests/integration/ot74-audience-router.test.ts`: PASS, 8 tests.
- `npm run typecheck`: PASS.
- `npm run lint`: PASS.
- `npm run secret:scan`: PASS across 323 repo text files.
- `npx prettier --check --ignore-unknown <OT-74 supported files>`: PASS. SQL migration excluded because this repo has no SQL parser.
- `npx tsx scripts/ot74/audience-dry-run.ts --rows=10000`: PASS. Printed counts/reasons only with `raw_row_contents_included: false` and `production_side_effects: false`.
- `npm run build`: PASS.
- `psql --version` and `docker --version`: BLOCKED. Local PostgreSQL 16 proof unavailable because neither command is installed.
