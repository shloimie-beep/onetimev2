# W12-100 Staging Deploy Runbook

Purpose: deploy the exact approved candidate to an isolated Railway staging
environment, with provider transports off and migrations run as a separate
controlled operation.

This runbook must not be executed from W12-100-10. It is for a later approved
operator window.

## Preconditions

1. Worktree HEAD is the exact candidate commit from the manifest.
2. `npm ci` has completed.
3. `OPERATIONS_PROBE_TOKEN` is set in the local shell only for probing; do not
   print it.
4. The manifest exists at:

```powershell
$RunDir = "ops/codex-runs/W12-100-10/live-evidence"
$Manifest = "$RunDir/staging-launch.manifest.json"
New-Item -ItemType Directory -Force $RunDir | Out-Null
```

5. The manifest has exact project, environment, web service, worker service,
   database service, candidate commit, expected image digest, predeploy source,
   and provider-off transport states.

## Evidence Collection

Collect Railway state without reading variables:

```powershell
railway status --json --project <RAILWAY_PROJECT_ID> --environment <STAGING_ENVIRONMENT_ID> > "$RunDir/railway-status.staging.json"
```

Collect counts-only migration metadata. This reads only migration ledger IDs and
does not print `DATABASE_URL`:

```powershell
railway run --project <RAILWAY_PROJECT_ID> --environment <STAGING_ENVIRONMENT_ID> --service <WEB_SERVICE_ID> --no-local -- npx tsx scripts/w12-100/deploy/migration-status.ts --environment-kind staging --output "$RunDir/migration-status.before.json"
```

Create redacted backup metadata from the approved Railway backup/PITR source:

```json
{
  "schema_version": "onetime.w12_100.backup_metadata.v1",
  "status": "ok",
  "latest_backup_age_minutes": 0,
  "pitr_enabled": true,
  "private_values_recorded": false
}
```

Save it as:

```powershell
$Backup = "$RunDir/backup-metadata.staging.json"
```

## Fail-Closed Preflight

```powershell
npx tsx scripts/w12-100/deploy/railway-launch-toolkit.ts preflight-staging --manifest "$Manifest" --railway-status-json "$RunDir/railway-status.staging.json" --migration-status-json "$RunDir/migration-status.before.json" --backup-metadata-json "$Backup" --output "$RunDir/preflight-staging.evidence.json"
```

Stop unless `preflight-staging.evidence.json` has `"status": "passed"`,
`"external_actions": 0`, and `"production_mutations": 0`.

## Deploy Web And Worker

This is the first mutating step. It uploads the current source for the web and
worker services only. It does not run migrations.

```powershell
npx tsx scripts/w12-100/deploy/railway-launch-toolkit.ts deploy-staging --manifest "$Manifest" --railway-status-json "$RunDir/railway-status.staging.json" --migration-status-json "$RunDir/migration-status.before.json" --backup-metadata-json "$Backup" --confirm-staging-mutation W12-100-STAGING-MUTATION-OK --execute --output "$RunDir/deploy-staging.evidence.json"
```

Stop if the evidence does not report exactly the expected external action count
for the operation and zero production mutations.

## Run Migrations Separately

Run this only after the deploy command returns. Pending migrations are allowed
only for this operation and must return to zero in post-migration verification.

```powershell
npx tsx scripts/w12-100/deploy/railway-launch-toolkit.ts migrate-staging --manifest "$Manifest" --railway-status-json "$RunDir/railway-status.staging.json" --migration-status-json "$RunDir/migration-status.before.json" --backup-metadata-json "$Backup" --confirm-staging-mutation W12-100-STAGING-MUTATION-OK --execute --skip-http --output "$RunDir/migrate-staging.evidence.json"
```

Collect migration status again:

```powershell
railway run --project <RAILWAY_PROJECT_ID> --environment <STAGING_ENVIRONMENT_ID> --service <WEB_SERVICE_ID> --no-local -- npx tsx scripts/w12-100/deploy/migration-status.ts --environment-kind staging --output "$RunDir/migration-status.after.json"
```

## Deployment Records

Collect deployment IDs and digests without variables:

```powershell
railway deployment list --json --project <RAILWAY_PROJECT_ID> --environment <STAGING_ENVIRONMENT_ID> --service <WEB_SERVICE_ID> --limit 20 > "$RunDir/deployments.web.after.json"
railway deployment list --json --project <RAILWAY_PROJECT_ID> --environment <STAGING_ENVIRONMENT_ID> --service <WORKER_SERVICE_ID> --limit 20 > "$RunDir/deployments.worker.after.json"
```

Combine the web and worker deployment JSON arrays into
`$RunDir/deployments.after.combined.json`, then run the verification runbook.

## Stop Conditions

- Railway status does not contain all exact IDs.
- `/version` before deploy does not match the manifest predeploy source.
- Provider transports are not off/sink/mock/not configured.
- Backup metadata is missing or stale.
- Migration status cannot be collected.
- Any command plan contains database delete, service delete, variable list, file
  upload, config apply, `down`, or source disconnect.
