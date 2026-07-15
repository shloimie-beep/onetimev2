# OT-75 Staging Canary Runbook

This is a preparation runbook. It must not be executed by OT-75.

## Preconditions

- `GATE-STAGING-SERVICE` passes.
- `GATE-STAGING-DOMAIN` passes.
- `GATE-ACTIVE-SOURCE-SHA` passes against the OT-80 release manifest.
- `GATE-MIGRATION-LEDGER-CHECKSUM` passes.
- Backup/PITR and restore-drill gates pass.
- Worker isolation is approved with redacted service evidence.

## Canary Steps For OT-80

1. Deploy only to the staging environment after explicit deployment approval.
2. Read back liveness and readiness for web, delivery-worker, provider-worker,
   and Telegram-worker.
3. Read back exact source SHA for each service and compare with the release
   manifest.
4. Run read-only smoke paths first.
5. Run disposable database assurance against a staging-cloned disposable
   database, never production.
6. Confirm provider state readback reports status/counts only and zero
   mutations.
7. Capture dashboard screenshots or exported JSON with counts only.
8. Stop if any alert in `ops/observability/ot75/alerts.json` fires.

## Forbidden During Canary

- Root-domain cutover.
- Production database writes.
- Provider sends or provider settings mutation.
- DNS changes.
- Payment or access mutation.
- Storing password, MFA secret, raw destination, message body, provider token,
  or database URL in evidence.
