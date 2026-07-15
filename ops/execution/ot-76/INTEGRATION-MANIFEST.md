# OT-76 Integration Manifest

## Scope

This branch adds a black-box, manifest-driven Day-One QA harness only.

## Files

- `scripts/day-one-certification-harness.mjs`
- `ops/day-one/release-manifest.example.json`
- `ops/day-one/day-one-capability-registry.json`
- `ops/day-one/synthetic-fixtures.json`
- `ops/evidence/ot-76/day-one-audit-report.json`
- `ops/evidence/ot-76/day-one-audit-report.md`
- `ops/execution/ot-76/*`
- `ops/execution/registry.json`

## Forbidden Work Not Performed

- No product source edits.
- No migration edits.
- No existing shared test edits.
- No package/runtime composition edits.
- No provider, AppShell, or central workflow edits.
- No deployment, production database access, external provider call, live send,
  payment/access mutation, DNS, or Railway mutation.
