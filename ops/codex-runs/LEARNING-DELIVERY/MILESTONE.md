# Learning Delivery Vimeo + Zoom Milestone

Updated: 2026-07-20T15:29:14.7697909+03:00

## Scope Completed

- Created isolated branch `codex/learning-delivery-vimeo-zoom` from PR #94 head `ebd28c65fab5f11b2a334937ef10bdf1da7b62f3`.
- Opened draft stacked PR #95: https://github.com/webcraft-media/onetimev2/pull/95.
- Reserved migration `2208_learning_delivery_media_pipeline.sql` after confirming PR #93 owns `2205` and PR #94 owns `2206`/`2207`.
- Added learning delivery contracts and domain helpers for the conductor state order:
  `discovered -> downloading -> probing -> transcribing -> transcript_ready -> trim_review -> rendering -> vimeo_uploading -> vimeo_processing -> content_review -> ready_to_publish -> published -> failed`.
- Added Drive metadata normalization that stores digests and rejects raw Drive URLs.
- Added ffprobe parsing, deterministic trim suggestion, and FFmpeg argv planning with required operator trim approval.
- Added an OpenAI transcription adapter boundary with fake-fetch tests and no live call.
- Added provider-neutral safe business events for `recording.available` and `class.reminder.requested` without raw URLs, transcripts, or student credentials.
- Added an opt-in worker hook behind `LEARNING_DELIVERY_WORKER_ENABLED=true`; provider calls remain disabled.
- Created private missing-values template at `C:\Users\User\BNA-Keyholder\learning-delivery-missing-values.private.template.json`.
- Ran the local video review canary against a 3-second MP4 found on the computer: ffprobe succeeded, reviewed no-trim render succeeded, WAV extract succeeded.
- Ran the OpenAI transcription transport canary with `C:\Users\User\BNA-Keyholder\openaiv2.txt`: provider call accepted; non-speech fixture returned zero transcript characters; no raw transcript was saved.
- Ran the approved Vimeo private upload/playback canary: account readback succeeded, TUS upload returned 204, project add succeeded, privacy is `nobody`, and transcode reached `complete`.

## Validation

- `npx vitest run --config vitest.unit.config.ts tests/unit/content/learning-delivery.test.ts --reporter=dot` passed: 8 tests.
- `npm run unit` passed: 53 test files, 264 tests.
- `npm run typecheck` passed.
- `npm run secret:scan` passed across 1748 repo text files.
- `npm run lint` passed.
- `npx prettier --check <touched TypeScript files>` passed.
- `git diff --check` passed.
- `npx tsx scripts/media/learning-delivery-readiness.ts` passed with no external calls; OpenAI is accepted through `openaiv2.txt`.
- FFmpeg/ffprobe local canary passed with rendered video SHA-256 prefix `d3ff9e5163de`.
- OpenAI transcription transport canary passed with audio SHA-256 prefix `a710507df15e`.
- Vimeo private upload/playback canary passed with provider video URI SHA-256 prefix `5e8dc5a72ef4`.

## Provider Canaries

Vimeo and OpenAI provider canaries were performed with explicit operator approval. No Zoom, Google Drive, HighLevel, or production DB calls were made.

## Remaining Operator Actions

- Drive: provide the exact protected path names for the existing BNA Google Drive auth ID, folder ID, and service-account/OAuth credential.
- Zoom: say exactly `approve one isolated Zoom canary meeting now`; also provide the SDK key/secret path names or confirm which existing BNA auth files map to SDK key/secret.
