# W12-100 Staging Roll-Forward Runbook

Purpose: redeploy the exact candidate after a rollback or failed staging
attempt, without guessing Railway state.

## Preconditions

1. A clean worktree is checked out at `candidate.commit_sha`.
2. The manifest still points to the same Railway staging IDs.
3. Backup metadata is fresh.
4. Provider transports remain off/sink/mock/not configured.

## Prepare Evidence

```powershell
$RunDir = "ops/codex-runs/W12-100-10/live-evidence"
$Manifest = "$RunDir/staging-launch.manifest.json"
$Backup = "$RunDir/backup-metadata.staging.json"

git rev-parse HEAD
railway status --json --project <RAILWAY_PROJECT_ID> --environment <STAGING_ENVIRONMENT_ID> > "$RunDir/railway-status.roll-forward.json"
railway run --project <RAILWAY_PROJECT_ID> --environment <STAGING_ENVIRONMENT_ID> --service <WEB_SERVICE_ID> --no-local -- npx tsx scripts/w12-100/deploy/migration-status.ts --environment-kind staging --output "$RunDir/migration-status.roll-forward-before.json"
```

The `git rev-parse HEAD` output must equal `candidate.commit_sha`.

## Execute Roll-Forward

```powershell
npx tsx scripts/w12-100/deploy/railway-launch-toolkit.ts roll-forward-staging --manifest "$Manifest" --railway-status-json "$RunDir/railway-status.roll-forward.json" --migration-status-json "$RunDir/migration-status.roll-forward-before.json" --backup-metadata-json "$Backup" --confirm-staging-mutation W12-100-STAGING-MUTATION-OK --execute --output "$RunDir/roll-forward-staging.evidence.json"
```

Run migrations separately only if `migration-status.roll-forward-before.json`
shows pending migrations:

```powershell
npx tsx scripts/w12-100/deploy/railway-launch-toolkit.ts migrate-staging --manifest "$Manifest" --railway-status-json "$RunDir/railway-status.roll-forward.json" --migration-status-json "$RunDir/migration-status.roll-forward-before.json" --backup-metadata-json "$Backup" --confirm-staging-mutation W12-100-STAGING-MUTATION-OK --execute --skip-http --output "$RunDir/migrate-roll-forward-staging.evidence.json"
```

## Verify

Run `post-deploy-verification.md`. The protected diagnostics runtime commit must
equal `candidate.commit_sha`, pending migration count must be zero, and worker
heartbeat must be fresh.
