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

## OT-80 Conductor Rerun

After merge into `codex/ot80-one-shot-final-convergence`, the scope validator
was adapted to accept `--scope-base` / `OT75_SCOPE_BASE_SHA` so OT80 can
validate only the OT75 merge contribution instead of all prior conductor lanes.

- Initial unscoped conductor run - EXPECTED FAIL, because OT71/OT72/OT73/OT74
  and OT80 communications files are outside OT75-owned paths.
- `node scripts/ot75/validate-release-readiness.mjs --scope-base d7bf846dda1c27aadd61f51c71aa163c70b2b871 --write-report`
  - PASS, 327 checks.
- `node scripts/ot75/check-predeploy-gates.mjs --scope-base d7bf846dda1c27aadd61f51c71aa163c70b2b871 --json --out ops/release/ot75/evidence/predeploy-gates.local.json`
  - PASS in non-failing mode.
  - Reported 11 activation-only blockers, passed the no-runtime-composition
    drift gate, and recorded zero external mutations.
- `npx vitest run --config vitest.unit.config.ts tests/unit/ot75/release-readiness.test.ts`
  - PASS, 6/6 tests.
- `npm run lint` - PASS.
- `npm run typecheck` - PASS.
- `npx prettier --check .github/workflows/ot75-release-readiness.yml ops/release/ot75 ops/observability/ot75 scripts/ot75 tests/unit/ot75` - PASS.
