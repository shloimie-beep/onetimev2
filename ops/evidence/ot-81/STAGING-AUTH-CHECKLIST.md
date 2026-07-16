# OT-81 Staging Authorization Checklist

Status: `READY_FOR_STAGING_AUTH`.

Strict local Day-One certification passed, but isolated staging was not deployed. The local Railway CLI is linked to project `one-time-production`, environment `production`, service `None`; OT81 forbids production deployment, production DNS changes, production database access, and BNA mutations.

## Required Operator Setup

Create or select a separate One Time staging Railway project/environment with:

- One Time staging web service.
- One Time staging delivery worker service.
- One Time staging provider worker service.
- One Time staging Telegram worker service, if present in the staging architecture.
- One Time staging PostgreSQL resource.
- Backup/PITR evidence URI.
- Restore drill evidence URI or precise staging blocker.
- Worker isolation approval.
- Provider state/default-off report.
- Owner/admin protected bootstrap report.
- Duplicate data audit report.

Set these env names in the shell or secure CI context, without committing values:

```text
OT75_STAGING_WEB_SERVICE
OT75_STAGING_DELIVERY_WORKER_SERVICE
OT75_STAGING_PROVIDER_WORKER_SERVICE
OT75_STAGING_TELEGRAM_WORKER_SERVICE
OT75_STAGING_DOMAIN
OT75_BACKUP_PITR_EVIDENCE_URI
OT75_RESTORE_DRILL_EVIDENCE_URI
OT75_EXPECTED_SOURCE_SHA
OT75_ACTIVE_SOURCE_SHA
OT75_MIGRATION_LEDGER_SHA256
OT75_STAGING_DATABASE_REFERENCE_ID
OT75_PRODUCTION_DATABASE_REFERENCE_ID
OT75_DUPLICATE_DATA_AUDIT_REPORT
OT75_WORKER_ISOLATION_APPROVED
OT75_PROVIDER_STATE_REPORT
OT75_OWNER_ADMIN_BOOTSTRAP_REPORT
DATABASE_URL
PGHOST
PGPORT
PGDATABASE
PGUSER
PGPASSWORD
```

## Safe Resume Commands

First link Railway to the isolated staging project/environment only:

```powershell
railway link --project <ONE_TIME_STAGING_PROJECT_ID> --environment <ONE_TIME_STAGING_ENVIRONMENT_ID>
railway service <ONE_TIME_STAGING_WEB_SERVICE>
railway status
```

`railway status` must not show `one-time-production` or `production`.

Then run the local/staging gates:

```powershell
node scripts/ot75/check-predeploy-gates.mjs --json --scope-base 741af0c08ee1d43be4e220b7c6e4c77a2330adc2
npm run db:verify
npx tsx scripts/postgres-assurance/run.ts
node scripts/day-one-certification-harness.mjs certify --manifest ops/day-one/ot81-release-manifest.json --scope-base 741af0c08ee1d43be4e220b7c6e4c77a2330adc2 --out-dir ops/evidence/ot-81/certification
```

Only after those pass, deploy the exact OT81 branch SHA to isolated staging, apply migrations to the staging database only, bootstrap protected activation for `one_time_owner` and `one_time_admin`, and record staging smoke evidence. Do not commit passwords, activation URLs, recovery emails, phone numbers, tokens, or secret values.
