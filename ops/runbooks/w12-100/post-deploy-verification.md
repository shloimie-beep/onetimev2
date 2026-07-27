# W12-100 Post-Deploy Verification Runbook

Purpose: verify web readiness, worker heartbeat, deployment identity, migration
status, backup metadata, and launch observability after staging deploy,
rollback, roll-forward, or production promotion.

## Inputs

```powershell
$RunDir = "ops/codex-runs/W12-100-10/live-evidence"
$Manifest = "$RunDir/staging-launch.manifest.json"
$Backup = "$RunDir/backup-metadata.staging.json"
```

For production, use the production evidence directory and manifest instead.

## Collect Current State

```powershell
railway status --json --project <RAILWAY_PROJECT_ID> --environment <ENVIRONMENT_ID> > "$RunDir/railway-status.verify.json"
railway deployment list --json --project <RAILWAY_PROJECT_ID> --environment <ENVIRONMENT_ID> --service <WEB_SERVICE_ID> --limit 20 > "$RunDir/deployments.web.verify.json"
railway deployment list --json --project <RAILWAY_PROJECT_ID> --environment <ENVIRONMENT_ID> --service <WORKER_SERVICE_ID> --limit 20 > "$RunDir/deployments.worker.verify.json"
railway run --project <RAILWAY_PROJECT_ID> --environment <ENVIRONMENT_ID> --service <WEB_SERVICE_ID> --no-local -- npx tsx scripts/w12-100/deploy/migration-status.ts --environment-kind staging --output "$RunDir/migration-status.verify.json"
```

Combine web and worker deployment list JSON into
`$RunDir/deployments.verify.combined.json`.

## Verify Runtime

`OPERATIONS_PROBE_TOKEN` must be present in the local shell and must not be
printed.

```powershell
npx tsx scripts/w12-100/deploy/railway-launch-toolkit.ts verify-staging --manifest "$Manifest" --railway-status-json "$RunDir/railway-status.verify.json" --migration-status-json "$RunDir/migration-status.verify.json" --backup-metadata-json "$Backup" --deployment-list-json "$RunDir/deployments.verify.combined.json" --output "$RunDir/verify-staging.evidence.json"
```

For production, use `verify-production` and the production manifest/evidence.

## Observability Snapshot

Create a redacted snapshot with the fields documented in
`alert-observability.md`, then run:

```powershell
npx tsx scripts/w12-100/ops/observability-checks.ts --input "$RunDir/observability-snapshot.json" --output "$RunDir/observability.evidence.json"
```

## Pass Criteria

- Toolkit evidence status is `passed`.
- Observability evidence status is `passed`.
- Pending migration count is zero.
- Protected `/api/internal/ops/diagnostics` runtime commit matches the required
  source for the operation.
- Deployment IDs are recorded for web and worker.
- Image digests match the expected digest when Railway reports them.
- Provider transports remain off/sink/mock/not configured.
- `external_actions` in verification evidence is zero.
- `production_mutations` in verification evidence is zero.

Stop and run rollback if any critical check fails after staging deployment.
