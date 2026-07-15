# OT-75 Test Results

Generated: 2026-07-15T09:44:50+03:00

## Passed

- `node scripts/ot75/validate-release-readiness.mjs --write-report`
  - Passed with 327 checks.
  - Evidence: `ops/release/ot75/evidence/validation-report.json`.
- `node scripts/ot75/check-predeploy-gates.mjs --json --out ops/release/ot75/evidence/predeploy-gates.local.json`
  - Passed in non-failing mode.
  - Reported 11 activation-only blockers and zero external mutations.
  - Evidence: `ops/release/ot75/evidence/predeploy-gates.local.json`.
- `node --check scripts/ot75/validate-release-readiness.mjs`
- `node --check scripts/ot75/check-predeploy-gates.mjs`
- `node --check scripts/ot75/render-release-manifest.mjs`
- `npx vitest run --config vitest.unit.config.ts tests/unit/ot75/release-readiness.test.ts`
  - Passed 5/5 tests.
- `npm run lint`
- `npm run typecheck`
- `npx prettier --check .github/workflows/ot75-release-readiness.yml ops/release/ot75 ops/observability/ot75 scripts/ot75 tests/unit/ot75`
- `npm run secret:scan`
  - Passed across 338 repo text files.
- `git diff --check`

## Expected Activation Blockers

The predeploy gate checker intentionally reports missing activation evidence for
staging services, staging domain, backup/PITR, restore drill, active source SHA,
migration ledger checksum, database reference drift, duplicate-data audit,
worker isolation approval, provider-state report, and owner/admin bootstrap
report. OT-75 does not read or print those values.
