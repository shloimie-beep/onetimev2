# OT-76 Test Results

## Local Verification

- `node --check scripts/day-one-certification-harness.mjs` passed.
- JSON parse passed for:
  - `ops/day-one/release-manifest.example.json`
  - `ops/day-one/day-one-capability-registry.json`
  - `ops/day-one/synthetic-fixtures.json`
  - `ops/execution/ot-76/INPUTS.json`
  - `ops/execution/ot-76/STATE.json`
  - `ops/execution/registry.json`
- `node scripts/day-one-certification-harness.mjs audit --scope-base bc2bcf2c7e16b5f1885aa65a2904f07578a18169` passed with exit code `0` and wrote:
  - `ops/evidence/ot-76/day-one-audit-report.json`
  - `ops/evidence/ot-76/day-one-audit-report.md`
- `node scripts/day-one-certification-harness.mjs certify --scope-base bc2bcf2c7e16b5f1885aa65a2904f07578a18169` failed with exit code `1` as expected because the current manifest is not Day-One certified. It wrote:
  - `ops/evidence/ot-76/day-one-certify-report.json`
  - `ops/evidence/ot-76/day-one-certify-report.md`
- Current HEAD observed by refreshed reports:
  `a95b4e3c2b7210f66f142322d2adcb900eb6890a`.
- Scope base used by refreshed reports:
  `bc2bcf2c7e16b5f1885aa65a2904f07578a18169`.

## Current Harness Verdict

- Audit mode: `audit_complete_not_certified`
- Certify mode: `failed`
- Day-One certified: `false`
- Gate summary: 13 total, 3 pass, 10 blockers.
- Forbidden changed files: none.
- External mutation counts: all zero.
