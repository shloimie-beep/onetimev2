# W12-100 Production Promotion Runbook

Purpose: promote the exact candidate to production after isolated staging has
passed. This runbook is not approval by itself. It requires a separate operator
approval for the exact project, environment, services, commit, digest, backup
metadata, and rollback fallback.

Do not execute this from W12-100-10.

## Known Rollback Limitation

Native Railway production rollback may not exist or may not be available for
older deployments. In this environment, `railway rollback` was not an installed
CLI subcommand. The current fallback is source rebuild/redeploy to the recorded
pre-promotion source. Database restore is last resort and requires separate
operator approval.

## Preconditions

1. Staging verification passed for the same candidate commit and expected image
   digest.
2. The production manifest uses `"environment_kind": "production"`.
3. The manifest records the current production `/version` source under
   `predeploy.expected_commit_sha` and `rollback.predeploy_commit_sha`.
4. Fresh backup/PITR metadata is present.
5. Provider transports remain off unless a separate provider acceptance window
   explicitly enables a bounded test mode. This runbook assumes transports off.
6. A rollback source worktree can be created immediately if needed.

## Production Evidence Collection

```powershell
$RunDir = "ops/codex-runs/W12-100-10/live-evidence-production"
$Manifest = "$RunDir/production-promotion.manifest.json"
$Backup = "$RunDir/backup-metadata.production.json"
New-Item -ItemType Directory -Force $RunDir | Out-Null

railway status --json --project <RAILWAY_PROJECT_ID> --environment <PRODUCTION_ENVIRONMENT_ID> > "$RunDir/railway-status.production.json"
railway run --project <RAILWAY_PROJECT_ID> --environment <PRODUCTION_ENVIRONMENT_ID> --service <WEB_SERVICE_ID> --no-local -- npx tsx scripts/w12-100/deploy/migration-status.ts --environment-kind production --confirm-production-metadata-read W12-100-PRODUCTION-METADATA-READ-OK --output "$RunDir/migration-status.production-before.json"
```

The migration helper reads only migration ledger IDs and emits counts/hashes.
It must not print private rows or database URLs.

## Fail-Closed Production Preflight

```powershell
npx tsx scripts/w12-100/deploy/railway-launch-toolkit.ts preflight-production --manifest "$Manifest" --railway-status-json "$RunDir/railway-status.production.json" --migration-status-json "$RunDir/migration-status.production-before.json" --backup-metadata-json "$Backup" --output "$RunDir/preflight-production.evidence.json"
```

Stop unless the evidence status is `passed`.

## Promote Web And Worker

This mutates production. It requires exact confirmation text:

```powershell
npx tsx scripts/w12-100/deploy/railway-launch-toolkit.ts promote-production --manifest "$Manifest" --railway-status-json "$RunDir/railway-status.production.json" --migration-status-json "$RunDir/migration-status.production-before.json" --backup-metadata-json "$Backup" --confirm-production-mutation W12-100-PRODUCTION-PROMOTION-OK --execute --output "$RunDir/promote-production.evidence.json"
```

## Run Migrations Separately

Run only after web/worker promotion has completed and only if the approved
manifest includes this migration operation:

```powershell
npx tsx scripts/w12-100/deploy/railway-launch-toolkit.ts migrate-production --manifest "$Manifest" --railway-status-json "$RunDir/railway-status.production.json" --migration-status-json "$RunDir/migration-status.production-before.json" --backup-metadata-json "$Backup" --confirm-production-mutation W12-100-PRODUCTION-PROMOTION-OK --execute --skip-http --output "$RunDir/migrate-production.evidence.json"
```

Collect production migration status again:

```powershell
railway run --project <RAILWAY_PROJECT_ID> --environment <PRODUCTION_ENVIRONMENT_ID> --service <WEB_SERVICE_ID> --no-local -- npx tsx scripts/w12-100/deploy/migration-status.ts --environment-kind production --confirm-production-metadata-read W12-100-PRODUCTION-METADATA-READ-OK --output "$RunDir/migration-status.production-after.json"
```

## Post-Promotion Verification

Run `post-deploy-verification.md` with the production manifest. The evidence
must include:

- `/health` 2xx
- `/ready` 2xx and ok
- `/version` exact candidate commit
- worker heartbeat fresh
- pending migration count zero
- backup metadata fresh
- deployment IDs and digests recorded
- external notifications sent by observability checker: zero
