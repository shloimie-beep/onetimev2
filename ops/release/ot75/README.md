# OT-75 Release And Observability Readiness

Status: preparation only. No deployment, DNS, database, provider, payment, send,
or production mutation is authorized by this packet.

OT-75 prepares the release, staging, and observability machinery that OT-80 can
activate after the integrated heads are selected. It intentionally does not
change current web runtime composition, central worker startup, domain code,
provider code, auth, CRM, AppShell, root package scripts, or current workflows.

## Local Validation

Run these from the repository root:

```powershell
node scripts/ot75/validate-release-readiness.mjs --write-report
node scripts/ot75/check-predeploy-gates.mjs --json
npx vitest run --config vitest.unit.config.ts tests/unit/ot75/release-readiness.test.ts
npm run secret:scan
```

The predeploy gate check is expected to report activation blockers on machines
that do not have staging service names, staging domains, backup/PITR evidence,
restore-drill evidence, source-readback evidence, database reference evidence,
or worker isolation approval configured. That is not a local preparation
failure.

## OT-80 Inputs

OT-80 should fill `ops/release/ot75/release-manifest.template.json` from the
actual integrated heads and staging evidence, then run:

```powershell
node scripts/ot75/render-release-manifest.mjs --out ops/release/ot75/evidence/release-manifest.ot80.json
node scripts/ot75/check-predeploy-gates.mjs --json --fail-on-blocked
```

The scripts do not print secret values. They only report presence, equality or
inequality checks, source SHA matches, and evidence paths.

## Prepared Files

- `release-readiness.contract.json` is the top-level OT-75 contract.
- `predeploy-gates.json` turns known Railway/release blockers into gates.
- `environment-schema.json` names staging and production variables without
  storing values.
- `health-readiness-contracts.json` defines liveness, readiness, source SHA,
  migration/checksum, worker lease, and provider-state contracts.
- `deployment-descriptors/` describes the isolated web, delivery-worker,
  provider-worker, and Telegram-worker topology without wiring it into current
  runtime startup.
- `ops/observability/ot75/` defines redacted logs, metrics, traces, dashboards,
  and alert thresholds.
- `runbooks/` contains the staging canary, rollback/source-readback, PostgreSQL
  assurance, backup/PITR, transitional domain, and owner/admin bootstrap
  procedures.
