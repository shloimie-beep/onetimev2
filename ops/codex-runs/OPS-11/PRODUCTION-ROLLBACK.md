# OPS-11 Production Rollback

Status: `preserved_with_source_rebuild_caveat`

Production was promoted after native PG18 backup/restore, staging rollback
rehearsal, and source-rebuild rollback proof. Railway native rollback to the
prelaunch production image was not available from the CLI because old production
deployments were already marked `REMOVED`.

## Starting Production Evidence

- Production project: `one-time-production`
- Production web service: `one-time-web`
- Starting web deployment:
  `15280d13-3e12-4c72-8460-10e0c6e99b3e`
- Starting web digest:
  `sha256:3390fcfe443897c8da1a698c98428cc85458f6a5bef789492a53ddf4a0003553`
- Starting app SHA observed by OPS-10:
  `050170d3ce5e9d0ea8e0db5ca0fa96b369bff0b5`
- Starting cron deployment:
  `387e2e49-2055-43c8-86f4-de11f0e60b59`
- Starting cron digest:
  `sha256:cca6c9720caf97d780c455e403c9228756c97da56ef722c31f124a4376b1bc31`
- Starting cron state: stopped/build-only and not a functioning lifecycle
  worker

## Caveat

The starting production app SHA `050170d3ce5e9d0ea8e0db5ca0fa96b369bff0b5`
was not present in the local Git object database, and Railway listed the old
production web/cron deployments as `REMOVED`. Therefore the exact old
production image was not a reliable rollback primitive.

## Preserved Rollback Path

The practical rollback path is a source rebuild of the previous known-good
staged application source:

- Rollback source:
  `d13e9cd3117091e97ef973408d8742a13d1a9479`
- Staging rollback web deployment:
  `536e4a57-b1ea-42b8-9a97-44f08a735606`
- Staging rollback worker deployment:
  `08dc4a1f-5c3a-4f26-9886-4ca2764b569f`
- Rollback source smokes passed after the OPS-11 migrations:
  `/health`, `/ready`, `/version`, `/login`

Database restore remains last resort. The preferred rollback is app/worker
source rebuild to the rehearsed rollback source, with production DB retained.

## Current Production

- Current web deployment:
  `6f4fa4e4-0f49-4508-96fe-850a5430360e`
- Current web digest:
  `sha256:eb6f723aa76ccf7eee8bf00b2b19f3c865873c2c2c7102f66fe775b303e26c71`
- Current worker deployment:
  `45c4b4bc-b63f-4c50-84f9-87c72cf36ded`
- Current worker digest:
  `sha256:e4446dbc5b531c88b484ac04844503eae18916644159a165f7aa90adea250d43`
- Current `/version`:
  `1197673fa409bfc4c649c2683f782e86775caa5e`

## Rollback Steps

1. Stop any further activation/reset sends.
2. Deploy rollback source `d13e9cd3117091e97ef973408d8742a13d1a9479` to
   production web and worker with the same Railway services.
3. Keep `RUN_MIGRATIONS_ON_STARTUP=false`.
4. Verify `/health`, `/ready`, `/version`, `/login`, and owner/admin protected
   redirects.
5. Use the native PG18 dump from OPS-11 only if application rollback cannot
   recover integrity.
