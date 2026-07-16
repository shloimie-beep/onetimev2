# OPS-05 Implementation

Checkpoint status: `ready_for_observability_configuration`

## Runtime Changes

- Extended `@onetime/observability` with the OPS-05 metric catalog, approved
  low-cardinality labels, route/status classification, runtime readback helpers,
  telemetry sanitization, and privacy findings.
- Added `/healthz` and `/readyz` aliases beside `/health` and `/ready`.
- Added source SHA, release ID, config mode, and provider mode headers to
  health, readiness, and version responses.
- Kept `/healthz` liveness free of database/provider fan-out.
- Kept `/readyz` database check bounded to `SELECT 1`.
- Reused shared telemetry sanitization in the delivery worker logger.
- Fixed delivery credential redaction so `token=...`, `secret=...`, and
  `api_key=...` redact as keyed credentials rather than the literal `$1`.

## Contract Artifacts

Added `ops/observability/ops05/` with:

- telemetry/privacy contract;
- SLO and alert matrix;
- operator dashboard query examples;
- provider-off synthetic check plan;
- operator runbooks;
- verification plan;
- protected configuration checkpoint.

## Scope Boundary

No deploy, provider call, external send, payment action, DNS change,
production data access, production database read, credential mutation, or raw
PII/secret logging was performed.

The BNA support seam is represented only as asynchronous redacted receipts and
cached status contracts. Ordinary One Time routes still must not synchronously
call BNA.
