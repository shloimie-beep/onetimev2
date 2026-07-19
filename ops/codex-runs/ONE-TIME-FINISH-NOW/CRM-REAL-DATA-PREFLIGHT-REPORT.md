# CRM Real Data Preflight Report

Generated: 2026-07-19T15:57:22.8286523+03:00

Status: `done`

Current status: superseded by the CRM-first pivot evidence in
`ops/codex-runs/RABBI-DAY-ONE-CRM/`. The report below is retained as historical
counts-only evidence from the earlier broad launch-spine pass. Current corrected
CRM counts, guarded apply-writer status, and production apply blockers live in
`ops/codex-runs/RABBI-DAY-ONE-CRM/STATE.json` and
`ops/codex-runs/RABBI-DAY-ONE-CRM/crm-corrected-dry-run.json`.

Report JSON:
`ops/codex-runs/ONE-TIME-FINISH-NOW/CRM-REAL-DATA-PREFLIGHT.json`

Report SHA-256:
`0bf8ad1c72f2855a22dc42899873b88cceb8a29187db4be86610403ac7a3e22c`

## Authorization Boundary

The operator approval raw text is preserved in
`ops/codex-runs/ONE-TIME-FINISH-NOW/CRM-IMPORT-APPROVAL-RAW.md`.

A protected private checkpoint manifest was created outside git at the expected
W13-104 private handoff location. It records `dry_run_authorized=true` and
`production_apply_authorized=false`. Its contents were not printed or committed.

## Approved Scope

- Approved source files: 6
- One Time Rabbi followers sources: 1
- Email audience sources: 5
- OPS-13A expected naive rows: 2,509
- Real-source preflight total rows: 2,505
- Approved source group fingerprint:
  `0bee9ddd75358d7eb987c2581c79ff1e555a848d7830e002c80d3d34cf3e1e32`

## Counts-Only Result

- Unique identity count: 1,596
- Duplicate identity rows: 98
- Matched existing contact rows: 0
- Staged new contact rows: 3
- Duplicate input rows: 84
- No-op rows: 0
- Manual-review rows: 2,418
- Communication-eligible rows: 3
- Do-not-contact rows: 152

Consent and ownership blockers:

- Suppressed or opted out: 152
- Unknown consent: 868
- Channel-specific consent absent: 1,020
- Conflicting consent or suppression: 0

## Safety Assertions

The preflight report records:

- No raw row contents included.
- No row values, emails, phones, names, addresses, notes, or message bodies
  printed.
- No production database connection or read.
- No database writes.
- No external actions, provider mutations, or production mutations.
- Temporary cleanup completed.

The historical W12-100 preflight compatibility section also records
`production_side_effects=false`, `database_writes_performed=false`, and
`apply_mode_implemented=false`.

## Remaining Blocker

`CRM_REAL_DATA` remains `PREVIEW_READY`, not `ACCEPTED`.

The newer CRM-first pivot implements the guarded local apply writer. Production
CRM import apply still remains blocked by:

- Fresh backup/rollback proof JSON verified immediately before apply.
- Created-by user key.
- Production confirmation:
  `RABBI-DAY-ONE-CRM-PRODUCTION-APPLY-OK`.

Already present in protected/sanitized readiness evidence:

- Exact acceptance of the corrected dry-run hash/count set:
  `APPROVE_RABBI_DAY_ONE_CRM_IMPORT:93be5a0837d3d90f8995e873c2ea302987f45e0e52de79f08170f01a6223f1d8:1559:production`.
- `DATABASE_URL`.
- Idempotency key.
- Exclusion/terminal handling for 848 current manual-review rows.

No production CRM apply was performed.
