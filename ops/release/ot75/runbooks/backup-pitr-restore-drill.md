# OT-75 Backup, PITR, And Restore Drill Checklist

This checklist is a predeploy blocker until completed outside OT-75.

## Backup/PITR Evidence

- Backup schedule exists for the production database.
- PITR capability is enabled or explicitly unavailable with an owner decision.
- Latest backup age is within the approved release threshold.
- Restore target is disposable and not production.
- Evidence is stored as a redacted URI or report reference, not raw database
  output.

## Restore Drill

1. Restore to a disposable database.
2. Run migration ledger checksum verification.
3. Run read-only sanity counts.
4. Run duplicate-data audit counts.
5. Destroy the disposable restore target after evidence is captured.

## Gate Mapping

- `GATE-BACKUP-PITR-EVIDENCE` requires backup/PITR evidence.
- `GATE-RESTORE-DRILL` requires restore drill evidence.
- `GATE-DATABASE-REFERENCE-DRIFT` must pass before any staging canary.
