# OPS-10 Backup And Restore

Generated: 2026-07-17T08:50:00+03:00

## Current Status

`blocked_preproduction`

## Evidence Collected

- Railway CLI authenticated.
- Release worktree is not linked to a Railway project.
- Production project: `one-time-production`.
- Production web: `one-time-web`, deployment
  `15280d13-3e12-4c72-8460-10e0c6e99b3e`.
- Production DB binding: `Postgres-j9Pi`, proven by redacted
  `DATABASE_URL` hash match `64f90e4cfe72`.
- Production DB service image: Railway Postgres 18 template.
- Staging web and worker bind to `ot99-pg16`, a Railway Postgres 16 template.

## Not Satisfied Yet

- Native `pg_dump -Fc` backup has not been created.
- Disposable restore verification has not been run.
- Production PITR state has not been verified.
- Local `pg_dump`, `pg_restore`, `pg_isready`, `psql`, and Docker are not
  installed.
- Railway SSH cannot be used yet because no Railway SSH key is registered. No
  Railway account SSH key was added by OPS-10.

## Required Next Gate

Create a timestamped native `pg_dump -Fc` backup of the selected production DB
without exposing its URL or contents, restore it to an isolated disposable target,
verify migration ledger/schema/count/hash sanity, then destroy or isolate the
restore target according to the approved runbook.

## Secret Handling

No database URL, password, token, private destination, activation link, reset
link, or dump contents were printed or stored.
