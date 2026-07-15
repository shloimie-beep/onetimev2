# OT-75 Rollback And Source Readback Runbook

This runbook prepares the rollback contract. OT-75 does not perform rollback or
deployment.

## Required Readbacks

- Web liveness status.
- Web readiness status.
- Worker liveness status for each worker.
- Worker readiness status for each worker.
- Exact source SHA for each service.
- Release ID for each service.
- Migration ledger checksum.
- Provider-state count/status readback.

## Rollback Trigger Examples

- Source SHA mismatch on any service.
- Migration checksum mismatch.
- Readiness failure on any service for two consecutive checks.
- 5xx rate above threshold during canary.
- Worker lease conflict above threshold.
- Any provider mutation attempt while release mode is `prepare_only`.

## Rollback Procedure For OT-80

1. Preserve redacted evidence before changing state.
2. Stop promotion.
3. Roll the staging service back to the prior approved source SHA only after
   explicit deployment approval.
4. Re-run source SHA readback.
5. Re-run readiness.
6. Record release manifest status as `rolled_back`.
7. Do not retry provider mutation or message send paths without a new approval.
