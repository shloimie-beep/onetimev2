# OT-74 Test Results

## Passed

- `npm run unit -- tests/unit/audience/audience-reconciliation.test.ts`
  - 11 tests passed.
  - Covers CSV-shaped parsing, duplicate inputs, conflicting identities,
    same-name people, missing email with phone normalization, replay
    determinism, rollback counts, cross-account isolation, archived and
    suppressed contacts, school handling, counts-only report safety, and 10000
    synthetic rows.
- `npm run integration -- tests/integration/audience/audience-migration.test.ts`
  - 2 tests passed.
  - Covers migration `1200_ot74_audience_reconciliation`, namespace order, and
    non-destructive provenance/segment/rollback persistence in pg-mem.
- `npx tsx scripts/audience-reconciliation-dry-run.ts --count=10000 --write-report`
  - Generated `ops/evidence/ot-74/dry-run-report.md`.
  - Generated `ops/evidence/ot-74/dry-run-report.json`.
  - Report includes counts and reasons only; no source row contents.
- `npm run typecheck`
  - Passed.
- `npx eslint ...changed TypeScript/TSX files...`
  - Passed.
- `npm run secret:scan`
  - Passed across 325 repo text files.
- `npx prettier --check ...supported changed files...`
  - Passed.

## PostgreSQL 16 Proof

Local PostgreSQL 16 was not used. This task did not connect to any production or
real database. PostgreSQL 16 CI proof remains pending remote CI after push/PR;
local migration proof used the repository pg-mem harness.

## External Mutation Counts

- Deployments: 0
- Production database writes: 0
- Provider mutations: 0
- Messages sent: 0
- Payments or charges: 0
- DNS changes: 0
- Real users created: 0
- BNA repository modifications for OT74: 0
- Real spreadsheets ingested: 0
