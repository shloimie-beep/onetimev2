# OPS-11 Resume

Status: `in_progress`

Current phase: Phase 1 candidate freeze is recorded. Continue Phase 2.

Repo: `webcraft-media/onetimev2`

Branch: `release/ops10-full-staged-production-launch-20260717T050800Z`

PR: `https://github.com/webcraft-media/onetimev2/pull/61`

Current PR head at OPS-11 start:
`05529dcf96e00982a4a25ec69492b080f9f4da05`

Staged app/source SHA:
`d13e9cd3117091e97ef973408d8742a13d1a9479`

Staging URL: `https://ot99-web-staging.up.railway.app`

Production URL: `https://join.onetimeonetime.com`

## Done

- OPS-11 ZIP validated and preserved.
- PR #61 refetched; head remains the reported `05529dc`.
- Required PR checks are green.
- `d13e9cd` is an ancestor of current PR head.
- The only files changed after `d13e9cd` are OPS-10 evidence/report files, so
  no runtime restage is required for the report-only head.
- Staging `/health`, `/ready`, `/version`, `/login`, `/forgot-password`,
  `/activate`, and `/reset-password` returned 200.
- Staging TOTP/authenticator route probes returned 404.

## Next

Phase 2:

1. Read production Railway service/database metadata without printing secrets.
2. Certify `Postgres-j9Pi` as the actual PostgreSQL 18 production path if it
   passes evidence.
3. Produce native PG18 dump and disposable PG18 restore proof using protected
   Railway/GitHub one-shot tooling if local tools are absent.
4. Add a durable PG18 assurance job to CI, then rerun checks and restage the new
   source SHA before any production promotion.

## Do Not Do Yet

- Do not deploy production.
- Do not run production migrations.
- Do not send activation/reset email.
- Do not change DNS.
- Do not delete or replace the production database.
- Do not print database URLs, passwords, private destinations, or login/reset
  links.
