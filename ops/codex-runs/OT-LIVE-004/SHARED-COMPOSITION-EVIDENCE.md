# OT-LIVE-004.01 shared-composition evidence

- Control: `origin/codex/v21-control` at `fb70bd65344513161c240e3ed6dfa30e0ad7fb54`.
- Final pre-commit control refresh advanced to `58e0497cbf35cdb456bc7b897523705fc09ca275`; the same immutable claim remains active with unchanged scope and authority.
- Claim: `4391fc4d-f645-4505-ad84-9a6950fa3cdf`; raw claim SHA-256 `25bde7d8027f33dd4f3cb4848b35ec7d7d0213bceae4cdc57f7032f309f23035`.
- Deployed source base: `27576fa64f0b37095e61ccca932c2e77cbf38844`.
- Accepted isolated media source: `795adc712e5ce16f2df6bf2d6a8372b41bf9de70`, cleanly cherry-picked as `cf65d20518a542b829887517887eacd569960c9e`.
- Shared branch: `codex/ot-live-004-media-shared-composition-20260804`.

## Composition and gates

- Direct browser upload is primary. The protected Admin route is mounted independently at `/api/app/content/ingest` and requires session identity, Admin role, CSRF, exact authorization ID, exact canary ID, and a configured injected managed-original runtime.
- The canary ID is also the begin idempotency key, so a different recording cannot reuse the one-recording authorization without a request-hash conflict.
- `ONE_TIME_CONTENT_MEDIA_MODE=off` is the default. No storage, processing, publication, or optional Drive runtime is constructed from credentials by the default web or worker entry point.
- Optional Drive intake is nonblocking. Missing or partial Drive configuration leaves only Drive provider-off and does not disable direct upload.
- Worker ingest, processing, and publication runners have a hard budget of one. Canary mismatches stop before provider invocation; provider identity/fingerprint readback is required by each injected adapter.
- Original-object acceptance requires a versioned object, full SHA-256, KMS version, storage class, private-access posture, recovery-journal agreement, and exact browser CORS readback. The original remains checksum-canonical and retained.
- Existing migrations `2245`, `2246`, `2252`, and `2253` are read as the schema contracts. No migration was edited, created, or applied.

## Canonical provider seams

- `s3_content_original_primary`: provider-account hash, principal-ARN hash, `eu-central-1`, bucket, KMS version, versioning, block-public-access, bucket-owner enforcement, browser-credential prohibition, and exact PUT/ETag CORS posture.
- `google_drive_content_ingest_optional`: provider-account hash, service-account hash, registered-folder hash; optional and nonblocking.
- `openai_content_processing_primary`: provider-account hash, project hash, credential fingerprint hash, model identities, and FFmpeg/FFprobe binary SHA-256 readback.
- `vimeo_publication_primary`: provider-account hash, authenticated-user hash, credential fingerprint hash, private-upload enforcement, exact content-version correlation, and opaque resource hash.

Credential configuration names are `CONTENT_S3_BUCKET`, `CONTENT_S3_KMS_KEY_ARN`, `AWS_REGION`, `GOOGLE_DRIVE_FOLDER_ID`, `GOOGLE_DRIVE_SERVICE_ACCOUNT_JSON`, `CONTENT_FFMPEG_PATH`, `CONTENT_FFPROBE_PATH`, `OPENAI_API_KEY`, `OPENAI_PROJECT_ID`, `OPENAI_ORGANIZATION_ID`, `VIMEO_ACCESS_TOKEN`, `VIMEO_ACCOUNT_ID`, and `VIMEO_WEBHOOK_SECRET`. Tests and evidence contain synthetic values or hashes only, never live secret readback.

## Verification ledger

- TypeScript typecheck: pass.
- Public and authenticated client production builds: pass.
- Claimed-path ESLint: pass.
- Claimed-path Prettier and `git diff --check`: pass.
- Secret scan: pass across 3,241 repository text files.
- Focused config tests: 5 passed.
- Focused web/client/worker tests: 24 passed, including the unchanged out-of-claim publication composition test.
- Focused media integration: 4 passed (default-off zero effect, source-only synthetic mode, existing migration readback, managed-original identity/readback).
- Deployed auth-browser preservation: 3 passed.
- Deployed Family/Parent-session composition: 3 passed, 1 pre-existing conditional test skipped.
- Public metadata/landing preservation: canonical/OG and authenticated app HTML checks passed; the fixed-name `app-PortalFeatures.js` fixture check remains a pre-existing build-manifest mismatch outside this claim.
- Brand check remains red on the repository's pre-existing manifest/branding drift, including numerous unrelated canonical routes and an unrelated governance-script raw color. No brand manifest path is in this claim.

## Zero-effect ledger

No database connection or write, migration execution, provider call, S3/Drive upload, transcode, transcription, OpenAI request, Vimeo publication/readback, deployment, DNS mutation, or bulk-media operation was performed. Verification used injected fakes, local loopback HTTP, local dependency installation, and ignored local build artifacts only.
