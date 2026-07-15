# OT-76 Implemented

- Added `scripts/day-one-certification-harness.mjs`.
- Added `ops/day-one/release-manifest.example.json` as the current audit
  manifest and future integrated release manifest template.
- Added `ops/day-one/day-one-capability-registry.json` with the 13 Day-One
  certification gates.
- Added `ops/day-one/synthetic-fixtures.json` with safe `.test` synthetic
  inputs for future black-box certification.
- Added OT-76 execution packet files under `ops/execution/ot-76/`.

The harness supports:

- `audit`: exits 0 when the harness is valid and scoped, even when current
  release capabilities are missing.
- `certify`: exits nonzero for every missing or partial Day-One release
  blocker.
- Scope enforcement: changed files outside OT-76 harness/evidence paths fail
  both modes.
- Conductor scope override: OT80 can pass `--scope-base` or
  `OT76_SCOPE_BASE_SHA` so earlier merged lanes do not become false file-scope
  failures.
- Explicit external mutation counts, always zero in this implementation.
