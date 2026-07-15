# OT-37 PostgreSQL Assurance Harness

Run this from the repository root against an ephemeral PostgreSQL admin
database. The runner creates random disposable databases, applies migrations,
seeds synthetic data, writes sanitized summaries, and drops the databases at the
end.

```bash
PGHOST=127.0.0.1 PGPORT=5432 PGDATABASE=postgres PGUSER=postgres PGPASSWORD=postgres npx tsx scripts/postgres-assurance/run.ts
```

The GitHub Actions workflow uses Node 24 and PostgreSQL 16:

```text
.github/workflows/ot37-postgres-assurance.yml
```

In OT-60R convergence, the workflow also runs on
`codex/ot60r-recovery-convergence` and checks the integrated migration stack
through `1600_ot51_telegram_bot_foundation.sql`.

Reports are written to:

```text
ops/evidence/ot-37/latest-postgres-assurance-report.json
ops/evidence/ot-37/latest-postgres-assurance-report.md
```

## Future Branch Instructions

OT-34, OT-36, OT-60R, and later integration branches can run the same command
after rebasing or stacking on a branch that contains this harness. Add new
scenarios under `tests/postgres-assurance/` and call them from
`scripts/postgres-assurance/run.ts`; do not rewrite the database helpers for
each lane.

This harness intentionally exposes current-base gaps as expected-open findings
instead of repairing application code or migrations. Migration execution and
checksum failures are hard failures.
