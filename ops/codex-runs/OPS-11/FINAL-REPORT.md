LIVE_LOGIN_READY

# OPS-11 Final Report

Generated: 2026-07-17T11:40:00+03:00

Production is live at `https://join.onetimeonetime.com` with activation email
handoff complete.

## Source And PR

- Repo: `webcraft-media/onetimev2`
- Branch: `release/ops10-full-staged-production-launch-20260717T050800Z`
- PR: `https://github.com/webcraft-media/onetimev2/pull/61`
- Runtime source SHA:
  `1197673fa409bfc4c649c2683f782e86775caa5e`
- Production `/version`: `ops11-1197673`

## Database

- Production database retained: `Postgres-j9Pi`
- PostgreSQL version: `18.4`
- Native PG18 backup: passed
- Native PG18 restore proof: passed
- Dump SHA-256:
  `6f35f3a116e3b095ad8244f1d6d6cbc2668292f2adb4741753ce24e4ba750698`
- Latest production migration:
  `2190_ot109_rabbi_content_publisher`
- Production migrations: `35` applied once, `35` already applied on
  idempotency verification

## CI And Staging

- PR checks green on runtime source.
- Added PG18 assurance workflow and fixed expected PG18 teardown handling.
- PG18 assurance run `29563814222`, job `87831829048`: passed.
- Staging rollback to `d13e9cd3117091e97ef973408d8742a13d1a9479`: passed.
- Staging roll-forward to `1197673fa409bfc4c649c2683f782e86775caa5e`:
  passed.

## Production Deployments

- Web deployment:
  `6f4fa4e4-0f49-4508-96fe-850a5430360e`
- Web digest:
  `sha256:eb6f723aa76ccf7eee8bf00b2b19f3c865873c2c2c7102f66fe775b303e26c71`
- Worker deployment:
  `45c4b4bc-b63f-4c50-84f9-87c72cf36ded`
- Worker digest:
  `sha256:e4446dbc5b531c88b484ac04844503eae18916644159a165f7aa90adea250d43`
- Worker mode: `PROCESS_TYPE=worker`
- Worker readiness: continuous sink mode, batch size `1`, poll interval
  `300000` ms

## Live Routes

Verified through `https://join.onetimeonetime.com`:

- `/health`: 200
- `/ready`: 200
- `/version`: 200, exact source SHA
- `/`: 200
- `/login`: 200
- `/forgot-password`: 200
- `/activate`: 200
- `/reset-password`: 200
- `/rabbi-member`: 301 to `/login`
- `/one-time/signup`: 301 to `/signup`

## Observation

- Window: `2026-07-17T08:39:10Z` to `2026-07-17T08:53:40Z`
- Iterations: `15`
- `/health`, `/ready`, and `/version`: 200 on every iteration
- Final worker readback: `one-time-delivery-cron` `SUCCESS`, deployment
  `45c4b4bc-b63f-4c50-84f9-87c72cf36ded`, running `1`, crashed `0`

## Login Delivery

- Protected destination source: `ONE_TIME_OWNER_TEST_EMAIL`
- Destination hash:
  `fab156df2719852de2dafb24f3e29548d4a2c5e8ef2374f7d3db47a0cef645e8`
- Existing account row before handoff: absent
- Action: one admin activation email
- Provider result: one `provider_delivered` lifecycle delivery
- Duplicates: none queued after send
- Raw destination, token, password, and activation link: not printed or stored

## Rollback

Railway native rollback to the old production image was not available because
old production deployments were already `REMOVED` and old source
`050170d3ce5e9d0ea8e0db5ca0fa96b369bff0b5` was not present locally. The
preserved rollback path is source rebuild to the rehearsed staged source
`d13e9cd3117091e97ef973408d8742a13d1a9479`; database restore is last resort.

## External Mutations

- Production web deploys: one failed config attempt, two successful deploys.
- Production worker deploys: one successful worker topology deploy.
- Production database writes: migrations, sink proof activation, provider
  activation, delivery state updates.
- Production email sends: exactly one protected admin activation email.
- DNS changes: none.
- Existing production database deletion/replacement: none.
- Live Stripe charges: none.
- Live Buffer publication: none.
- Broad customer sends/imports: none.
- Credential disclosure: none.

## Successful Next Operator Action

Open the activation email, set your password, and log in at
`https://join.onetimeonetime.com/login`.
