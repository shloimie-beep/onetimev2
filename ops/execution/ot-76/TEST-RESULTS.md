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
- `node scripts/day-one-certification-harness.mjs audit` passed with exit code
  `0` and wrote:
  - `ops/evidence/ot-76/day-one-audit-report.json`
  - `ops/evidence/ot-76/day-one-audit-report.md`
- `node scripts/day-one-certification-harness.mjs certify` failed with exit
  code `1` as expected because the current manifest is not Day-One certified.
  It wrote:
  - `ops/evidence/ot-76/day-one-certify-report.json`
  - `ops/evidence/ot-76/day-one-certify-report.md`

## Current Harness Verdict

- Audit mode: `audit_complete_not_certified`
- Certify mode: `failed`
- Day-One certified: `false`
- Gate summary: 13 total, 3 pass, 10 blockers.
- Forbidden changed files: none.
- External mutation counts: all zero.
