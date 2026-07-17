# OPS-11 Resume

Status: `live_login_ready`

Repo: `webcraft-media/onetimev2`

Branch: `release/ops10-full-staged-production-launch-20260717T050800Z`

PR: `https://github.com/webcraft-media/onetimev2/pull/61`

Runtime source SHA:
`1197673fa409bfc4c649c2683f782e86775caa5e`

Production URL: `https://join.onetimeonetime.com`

## Done

- OPS-11 ZIP validated and extracted.
- PostgreSQL 18 production path certified and retained.
- Native PG18 production dump and disposable restore proof completed.
- Durable PG18 assurance CI job added and passed.
- Existing PG16 assurance checks retained and passed.
- Staging rollback and roll-forward rehearsed.
- Production migrations applied once and re-run idempotently.
- Production web promoted and verified.
- Production worker topology corrected from stopped build-only cron to running
  `PROCESS_TYPE=worker` service.
- Worker sink lifecycle proof completed before provider canary.
- One protected admin activation email sent.
- Production route checks passed:
  `/health`, `/ready`, `/version`, `/`, `/login`, `/forgot-password`,
  `/activate`, `/reset-password`, `/rabbi-member`, `/one-time/signup`.
- Bounded observation passed from `2026-07-17T08:39:10Z` to
  `2026-07-17T08:53:40Z`: `/health`, `/ready`, and `/version` stayed 200 for
  15 iterations; final worker readback was one running replica and zero crashed.

## Current Production IDs

- Web deployment:
  `6f4fa4e4-0f49-4508-96fe-850a5430360e`
- Web digest:
  `sha256:eb6f723aa76ccf7eee8bf00b2b19f3c865873c2c2c7102f66fe775b303e26c71`
- Worker deployment:
  `45c4b4bc-b63f-4c50-84f9-87c72cf36ded`
- Worker digest:
  `sha256:e4446dbc5b531c88b484ac04844503eae18916644159a165f7aa90adea250d43`
- Observation:
  `2026-07-17T08:39:10Z` to `2026-07-17T08:53:40Z`, 15 green iterations
- Database service:
  `Postgres-j9Pi`
- Latest migration:
  `2190_ot109_rabbi_content_publisher`

## Caveats

- Railway native rollback to the prelaunch production image was not available
  because old production deployments were marked `REMOVED` and source
  `050170d3ce5e9d0ea8e0db5ca0fa96b369bff0b5` was not present locally.
- The rehearsed rollback path is source rebuild to
  `d13e9cd3117091e97ef973408d8742a13d1a9479`, which passed staging rollback
  smokes after the OPS-11 migrations.
- The production worker remains provider-off by default. The single provider
  activation was sent through a bounded OPS-11 release command with the canary
  gates enabled.

## Next Operator Action

Open the activation email, set the password, and log in at:

`https://join.onetimeonetime.com/login`
