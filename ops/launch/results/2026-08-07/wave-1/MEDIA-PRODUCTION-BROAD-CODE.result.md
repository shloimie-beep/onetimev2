# MEDIA-PRODUCTION-BROAD-CODE result

Status: **ready for child-PR review; not activated**

- Repository: `shloimie-beep/onetimev2`
- Target branch: `codex/one-time-complete-production-launch-20260805`
- Child branch: `codex/ot-wave1-media-production-broad-20260807`
- Base commit: `3fa18eca39c3d448a4295be9b4d8c401bb808959`
- Child PR: `https://github.com/shloimie-beep/onetimev2/pull/138` (draft)
- Live provider calls: **0**
- Railway or production setting changes: **0**

## Delivered

- Added explicit `production_broad` config binding. It requires production plus `ONE_TIME_VERIFICATION_ENVIRONMENT_ID=production_broad`; `provider_canary` remains bound to `production_operator_canary` and one exact canary ID.
- Added conservative bounded controls: batch 2 by default (maximum 10) and concurrency 1 by default (maximum 4).
- Composed broad Drive intake, processing selection, private Vimeo publication claims, unknown-effect reconciliation, and finalization around existing durable receipts, optimistic version fences, job leases, lease generations, retry/dead-letter behavior, and provider-operation bindings.
- Scoped broad work to the configured account, `one_time_mishnayos`, production runtime, and `production_broad`. Publication selectors require pending linked intents, approval evidence, approved processing for publish, and the primary Vimeo mutation binding.
- Preserved direct-upload and Drive SHA-256 convergence on one canonical source; terminal Drive observations no longer re-import.
- Added an Admin occurrence list and match action after direct-upload confirmation. An unmatched source remains preserved but cannot enter broad processing.
- Made incomplete broad provider composition return unavailable without blocking the safe application. No provider configuration was added or activated.
- Installed FFmpeg/ffprobe in the production image at `/usr/bin/ffmpeg` and `/usr/bin/ffprobe`.
- Updated `.env.example` with off-by-default media controls and protected provider-evidence key names.
- Added `ops/runbooks/CONTENT-MEDIA-PRODUCTION-BROAD.md` with preflight, pause, rollback, sanitized observability, and explicit no-activation guidance.
- Added a native PostgreSQL claim test guarded to an explicitly disposable loopback database named `onetime_media_broad_*`.

## Safety outcomes

- Canary work remains single-ID isolated.
- Broad selectors are bounded and reject the canary verification environment.
- Cross-account, cross-product, cross-runtime, unmatched, and unapproved work cannot be selected by the broad paths.
- Provider uncertainty remains quarantined for reconciliation; no blind redispatch path was introduced.
- Logs and this result contain no credentials, signed media URLs, provider resource IDs, child data, or transcript bodies.
- Immediate safe pause is `ONE_TIME_CONTENT_MEDIA_MODE=off`; durable rows are retained. A rollback to `provider_canary` requires its exact tuple and separate authorization.

## Validation

- Focused unit/integration/resilience tests: 90 passed across 17 files; the single native PostgreSQL test was safely skipped for the exact reason below.
- TypeScript typecheck: passed.
- Production build: passed. Vite retained the existing unresolved-at-build-time font URL warning.
- ESLint: passed.
- Brand-system check: passed.
- Secret scan: passed across 3,383 repository text files.
- Scoped Prettier check for every changed supported file: passed.
- Full-repository Prettier check: baseline failure across many unrelated existing files; no out-of-scope formatting rewrite was performed.
- `git diff --check`: passed (Windows line-ending notices only).

## Exact remaining verification blocker

The native PostgreSQL test could not execute locally because no safe `CONTENT_MEDIA_BROAD_TEST_DATABASE_URL`, Docker executable, or `psql` executable is available. It was skipped rather than pointed at persistent staging or production. Later command, with an explicitly disposable loopback database only:

```text
CONTENT_MEDIA_BROAD_TEST_DATABASE_URL=postgres://.../onetime_media_broad_<unique> npx vitest run tests/integration/content/content-media-production-broad.postgres.test.ts
```

## Production preflight state

Coordinator read-only preflight reports zero current S3/OpenAI/Vimeo governed registry rows and no production media variables. Those remain activation blockers. This lane did not create registry rows, set variables, deploy, or activate `production_broad`.
