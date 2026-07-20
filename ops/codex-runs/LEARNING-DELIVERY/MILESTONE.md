# Learning Delivery Vimeo + Zoom Milestone

Updated: 2026-07-20T15:07:33.7717060+03:00

## Scope Completed

- Created isolated branch `codex/learning-delivery-vimeo-zoom` from PR #94 head `ebd28c65fab5f11b2a334937ef10bdf1da7b62f3`.
- Reserved migration `2208_learning_delivery_media_pipeline.sql` after confirming PR #93 owns `2205` and PR #94 owns `2206`/`2207`.
- Added learning delivery contracts and domain helpers for the conductor state order:
  `discovered -> downloading -> probing -> transcribing -> transcript_ready -> trim_review -> rendering -> vimeo_uploading -> vimeo_processing -> content_review -> ready_to_publish -> published -> failed`.
- Added Drive metadata normalization that stores digests and rejects raw Drive URLs.
- Added ffprobe parsing, deterministic trim suggestion, and FFmpeg argv planning with required operator trim approval.
- Added an OpenAI transcription adapter boundary with fake-fetch tests and no live call.
- Added provider-neutral safe business events for `recording.available` and `class.reminder.requested` without raw URLs, transcripts, or student credentials.
- Added an opt-in worker hook behind `LEARNING_DELIVERY_WORKER_ENABLED=true`; provider calls remain disabled.
- Created private missing-values template at `C:\Users\User\BNA-Keyholder\learning-delivery-missing-values.private.template.json`.

## Validation

- `npx vitest run --config vitest.unit.config.ts tests/unit/content/learning-delivery.test.ts --reporter=dot` passed: 8 tests.
- `npm run unit` passed: 53 test files, 264 tests.
- `npm run typecheck` passed.
- `npm run secret:scan` passed across 1744 repo text files.
- `npm run lint` passed.
- `npx prettier --check <touched TypeScript files>` passed.
- `git diff --check` passed.
- `npx tsx scripts/media/learning-delivery-readiness.ts` passed with no external calls.

## Provider Canaries

No Vimeo, Zoom, Google Drive, OpenAI, HighLevel, production DB, or provider account mutations were performed.

## Remaining Operator Actions

- Drive: add approved folder ID and service-account or OAuth credential under `C:\Users\User\BNA-Keyholder`.
- Vimeo: add webhook secret/upload confirmation and explicitly approve one private upload canary.
- Zoom: add SDK key/secret and freshly approve one isolated Zoom canary.
- OpenAI: add a non-empty key at `C:\Users\User\BNA-Keyholder\openai-api-key.txt` or explicitly approve the alternate protected key path.
