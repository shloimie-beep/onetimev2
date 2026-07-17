# W12-100 Staging Rollback Runbook

Purpose: return isolated staging to the exact pre-deploy source recorded before
the candidate deploy.

Known limitation: this toolkit does not depend on a native Railway rollback
command. The installed Railway CLI in this environment did not expose
`railway rollback`. Source rebuild/redeploy to the recorded pre-deploy commit is
the current fallback.

## Preconditions

1. `ops/runbooks/w12-100/staging-deploy.md` recorded the pre-deploy source in
   the manifest under `rollback.predeploy_commit_sha`.
2. A clean worktree is checked out at exactly that pre-deploy commit.
3. No production environment is targeted.
4. Provider transports remain off/sink/mock/not configured.

## Prepare Evidence

```powershell
$RunDir = "ops/codex-runs/W12-100-10/live-evidence"
$Manifest = "$RunDir/staging-launch.manifest.json"
$Backup = "$RunDir/backup-metadata.staging.json"

git rev-parse HEAD
railway status --json --project <RAILWAY_PROJECT_ID> --environment <STAGING_ENVIRONMENT_ID> > "$RunDir/railway-status.rollback.json"
railway run --project <RAILWAY_PROJECT_ID> --environment <STAGING_ENVIRONMENT_ID> --service <WEB_SERVICE_ID> --no-local -- npx tsx scripts/w12-100/deploy/migration-status.ts --environment-kind staging --output "$RunDir/migration-status.rollback-before.json"
```

The `git rev-parse HEAD` output must equal
`rollback.predeploy_commit_sha` in the manifest.

## Execute Rollback

```powershell
npx tsx scripts/w12-100/deploy/railway-launch-toolkit.ts rollback-staging --manifest "$Manifest" --railway-status-json "$RunDir/railway-status.rollback.json" --migration-status-json "$RunDir/migration-status.rollback-before.json" --backup-metadata-json "$Backup" --confirm-staging-mutation W12-100-STAGING-MUTATION-OK --execute --output "$RunDir/rollback-staging.evidence.json"
```

The toolkit refuses rollback unless the local git HEAD exactly matches the
pre-deploy rollback source.

## Verify Rollback

```powershell
railway deployment list --json --project <RAILWAY_PROJECT_ID> --environment <STAGING_ENVIRONMENT_ID> --service <WEB_SERVICE_ID> --limit 20 > "$RunDir/deployments.web.rollback.json"
railway deployment list --json --project <RAILWAY_PROJECT_ID> --environment <STAGING_ENVIRONMENT_ID> --service <WORKER_SERVICE_ID> --limit 20 > "$RunDir/deployments.worker.rollback.json"
railway run --project <RAILWAY_PROJECT_ID> --environment <STAGING_ENVIRONMENT_ID> --service <WEB_SERVICE_ID> --no-local -- npx tsx scripts/w12-100/deploy/migration-status.ts --environment-kind staging --output "$RunDir/migration-status.rollback-after.json"
```

Combine the deployment lists into
`$RunDir/deployments.rollback.combined.json`, then run:

```powershell
npx tsx scripts/w12-100/deploy/railway-launch-toolkit.ts rollback-staging --manifest "$Manifest" --railway-status-json "$RunDir/railway-status.rollback.json" --migration-status-json "$RunDir/migration-status.rollback-after.json" --backup-metadata-json "$Backup" --deployment-list-json "$RunDir/deployments.rollback.combined.json" --confirm-staging-mutation W12-100-STAGING-MUTATION-OK --skip-http --output "$RunDir/rollback-staging.postcheck.evidence.json"
```

Then run `post-deploy-verification.md` against the staging URL. Stop if
`/version` does not show the exact pre-deploy source.
