# Production-broad content media runbook

This runbook governs repeatable production media intake, processing, and private publication. It does not authorize activation. Keep `ONE_TIME_CONTENT_MEDIA_MODE=off` until a separate production change is approved and every preflight item below is satisfied.

## Launch profile: local Windows processing (2026-08-09)

The approved launch path no longer provisions AWS, S3, or KMS. The production Railway media mode remains `off`. The launch workflow is:

```text
existing Drive connector intake folder
  -> Google Drive for desktop sync
  -> Windows local runner
  -> local FFmpeg/ffprobe
  -> 16 kHz mono compressed audio only to OpenAI
  -> verified private Drive archive copy
  -> restricted private Vimeo upload and captions
  -> authenticated Owner/Admin local-import endpoint
  -> human review, approval, and publication
```

The canonical cloud intake is the already-existing `One Time Content Library Upload Drop - Connector (Empty) / Class Videos (Empty)` folder. Do not create or silently select another folder with a similar name. `ONETIME_MEDIA_INCOMING_DIR` must be the local Google Drive for desktop path that syncs that exact folder; validate it with one known file before installing the scheduled task.

Use the following commands:

```text
npm run media:local-runner
npm run media:local-runner:start
npm run media:local-runner:stop
npm run media:local-runner:status
npm run media:local-runner:install
npm run media:local-runner:uninstall
npm run media:local-runner:retry -- --job=<job-id>
```

The local runner keeps its durable SQLite ledger under `ONETIME_MEDIA_STATE_DIR`, requires unchanged size and mtime for 60 seconds plus a write-lock and ffprobe check, deduplicates on source SHA-256, and never alters the incoming original. Interrupted Vimeo work becomes `unknown_provider_effect` and requires reconciliation before any retry. Drive archive writes use a `.partial` suffix and become visible under the final name only after byte-length, SHA-256, and ffprobe checks pass.

Required local configuration:

```text
ONETIME_MEDIA_INCOMING_DIR=<local path synced from the exact existing connector intake>
ONETIME_MEDIA_PROCESSING_DIR=C:\OneTimeMedia\Processing
ONETIME_MEDIA_COMPLETE_DIR=C:\OneTimeMedia\Complete
ONETIME_MEDIA_FAILED_DIR=C:\OneTimeMedia\Failed
ONETIME_MEDIA_STATE_DIR=C:\OneTimeMedia\State
ONETIME_MEDIA_DRIVE_ARCHIVE_DIR=<private local Drive archive path>
ONETIME_MEDIA_TRANSCRIPTION_MODE=openai
ONETIME_MEDIA_LOCAL_RETENTION_DAYS=7
ONETIME_MEDIA_VIMEO_PROJECT_REF=<restricted project reference when used>
ONETIME_MEDIA_APP_BASE_URL=https://onetime.sh
```

The runner may import only through `/api/v1/admin/content/factory/local-import`, with an active Owner/Admin session, CSRF proof, the exact source-derived idempotency key, and an explicit class occurrence. No permanent `DATABASE_URL` belongs on the laptop. If zero or multiple occurrences are eligible, the job must remain `needs_occurrence_selection`; it must never guess.

The AWS/S3/KMS sections below are retained as historical production-broad design context only. They are not launch prerequisites and do not authorize AWS provisioning.

## Immutable boundaries

- `provider_canary` remains limited to `ONE_TIME_VERIFICATION_ENVIRONMENT_ID=production_operator_canary` and one exact `ONE_TIME_CONTENT_CANARY_ID`.
- `production_broad` requires the production runtime and `ONE_TIME_VERIFICATION_ENVIRONMENT_ID=production_broad`; it does not accept a canary ID as a work selector.
- Work is account/product/runtime scoped. Processing accepts only sources that have an Admin-confirmed occurrence. Private Vimeo publication accepts only approved processing versions with durable approval evidence.
- S3 originals and derivatives remain private, versioned, SSE-KMS encrypted, bucket-owner enforced, and blocked from public access. Playback stays behind the protected application route; raw provider URLs and IDs never enter browser responses, logs, or evidence.
- Provider acceptance that cannot be proven is quarantined as unknown and reconciled before any retry. Lease owner, generation, expiry, and expected version fence every dispatch persistence step.
- Direct upload and Drive intake converge on the same SHA-256 canonical source. Drive failure does not block direct upload.

## Current activation blockers (2026-08-07 preflight)

Production currently has zero governed S3, OpenAI, or Vimeo registry bindings and no content-media environment settings. This is an explicit stop condition: do not enable `provider_canary` or `production_broad` until owner-scoped bindings are registered, independently read back, and the protected settings are supplied.

The production image now installs FFmpeg and ffprobe and exposes them at `/usr/bin/ffmpeg` and `/usr/bin/ffprobe`. Deployment readback must still prove both executables are present before media activation.

## Read-only preflight

Record only booleans, counts, versions, timestamps, and digests. Never record tokens, service-account JSON, KMS material, provider resource IDs, raw media URLs, child data, transcript bodies, or signed URLs.

1. Confirm the deployed source contains this runbook and the `production_broad` config contract.
2. Confirm the runtime tuple is production and the proposed verification environment is exactly `production_broad`.
3. Confirm the S3 bucket is in `eu-central-1`, versioning is enabled, default SSE-KMS uses the approved key, Block Public Access is complete, and Object Ownership is bucket-owner enforced.
4. Confirm governed registry bindings and current provider readback evidence exist for `CONTENT_S3`, `CONTENT_OPENAI`, and `CONTENT_VIMEO`. Add the `CONTENT_DRIVE` binding only when Drive intake is intentionally enabled.
5. Confirm the OpenAI project and models comply with DEC-077/DEC-078, and the Vimeo account supports private assets and private pull upload.
6. Confirm `ffmpeg -version` and `ffprobe -version` succeed inside both the web and worker production images.
7. Confirm an Admin can see eligible class dates after direct upload and that matching changes the source from `matchConfidence=none` to the selected occurrence before processing becomes eligible.
8. Confirm provider queues contain no stale canary rows incorrectly scoped to `production_broad`, and broad selectors return only the configured account/product.

## Protected configuration

Use the keys documented in `.env.example`; supply protected values only through the approved production secret store. The conservative controls are:

```text
ONE_TIME_CONTENT_MEDIA_BATCH_SIZE=2
ONE_TIME_CONTENT_MEDIA_CONCURRENCY=1
CONTENT_FFMPEG_PATH=/usr/bin/ffmpeg
CONTENT_FFPROBE_PATH=/usr/bin/ffprobe
AWS_REGION=eu-central-1
CONTENT_S3_STORAGE_CLASS=STANDARD
```

`ONE_TIME_CONTENT_MEDIA_AUTHORIZATION_ID` must identify the separately approved promotion. Provider credentials alone are insufficient: all required registry versions, account-reference hashes, evidence digests, readback digests, and observed-not-before timestamps must also be present.

## Separately authorized activation sequence

Do not perform these steps from an implementation lane.

1. Keep mode `off`; deploy the code and verify unrelated application health.
2. Complete and retain sanitized preflight evidence. Stop if any provider is incomplete, any selector returns cross-scope data, or the production image lacks either executable.
3. If the change authority requires one-recording proof, use only `provider_canary` with `production_operator_canary` and the exact authorized canary occurrence. Returning from canary to broad requires a separate configuration promotion.
4. For a separately approved broad promotion, set the exact runtime tuple to `production` / `production_broad`, supply the approved authorization ID, and set mode to `production_broad`. Start at batch 2 and concurrency 1.
5. Observe one bounded cycle. Validate counts for Drive observations, direct uploads, processing selections, publication claims, retries, dead letters, unknown effects, reconciliation, and finalization. Evidence must remain aggregate and sanitized.
6. In Admin, choose the class date for every newly confirmed direct upload. Unmatched sources remain preserved but are not eligible for processing.
7. Approve drafts only after human review. Approval is the publication authority boundary; processing completion alone cannot publish.

## Pause and rollback

- Immediate pause: set `ONE_TIME_CONTENT_MEDIA_MODE=off` and deploy the web and worker services together. New media database/provider claims stop; durable rows remain for later reconciliation. Unrelated safe application routes continue operating.
- Provider degradation: if required provider configuration or registry readback is missing, broad runtime composition returns unavailable and performs no media database/provider work. Do not work around this gate.
- Unknown external effect: leave the operation quarantined. Reconcile canonical provider state; never blindly redispatch.
- Safe canary rollback: only with separate exact authorization, set the tuple to `production_operator_canary`, set one exact canary ID, and set mode `provider_canary`. This is not a broad-work fallback and must not claim ordinary production rows.
- Safest rollback is `off`. Do not delete outbox, source, receipt, job, or provider-operation rows during rollback.

## Verification commands

Run from a clean worktree without provider credentials:

```text
npx vitest run tests/unit/config/content-media-config.test.ts packages/domain/src/content/ingest/content-ingest.test.ts apps/web/src/server/features/content/ingest/router.test.ts apps/web/src/client/app/admin/content/ingest/api.test.ts apps/web/src/client/app/admin/content/ingest/ContentIngestWorkspace.test.tsx apps/worker/src/runners/content-media/runtime.test.ts apps/worker/src/runners/content-ingest/runner.test.ts apps/worker/src/runners/content-processing/runner.test.ts apps/worker/src/runners/foundation/runner.test.ts apps/worker/src/runners/content-publication/runner.test.ts apps/worker/src/runners/content-publication/composition.test.ts apps/worker/src/runners/provider-reconciliation/runner.test.ts tests/integration/content/content-media-composition.test.ts
npm run typecheck
npm run build
npm run format
npm run brand:check
npm run secret:scan
```

Run the focused integration suite against an explicitly disposable real PostgreSQL instance when one is available. Never substitute production or persistent staging. If no safe database is configured, record the exact missing test target as a verification blocker rather than claiming real-PostgreSQL proof.
