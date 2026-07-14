# OT-37 Local Environment Blocker

Date: 2026-07-15.

The PostgreSQL assurance harness was ported/adapted for OT-60R, but the local
desktop environment does not currently provide a safe disposable PostgreSQL
target.

## Local Attempts

- `npx tsx scripts/postgres-assurance/run.ts`: blocked by
  `connect ECONNREFUSED 127.0.0.1:5432`.
- `docker --version`: blocked because `docker` is not installed.
- `docker ps --format "{{.Names}} {{.Image}} {{.Ports}}"`: blocked because
  `docker` is not installed.
- `psql --version`: blocked because `psql` is not installed.
- `Get-Service postgresql*`: no PostgreSQL service was found.
- `PGHOST`, `PGDATABASE`, `PGUSER`, `PGPORT`, `PGPASSWORD`, and `DATABASE_URL`
  environment variables are not set.

## Safe Next Proof

The adapted workflow `.github/workflows/ot37-postgres-assurance.yml` starts a
PostgreSQL 16 service, runs the harness against disposable databases, and
uploads sanitized summaries. This avoids production database access and keeps
external mutation counts at zero.
