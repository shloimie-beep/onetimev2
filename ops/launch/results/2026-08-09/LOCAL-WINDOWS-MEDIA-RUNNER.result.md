# OT-P5 Local Windows Media Runner Result

Date: 2026-08-09  
Status: IN PROGRESS — durable runner implemented and the authorized Drive canary copy is staged; local sync-path selection, installation, and the real provider/application canary remain.

## Delta-only basis

- PR #136 and its canonical result remain the prior proof for the media architecture and protected production readback.
- PR #142 is merged and remains the durable Vimeo/media preflight record. Its provider identity and binding checks are preserved; they were not repeated.
- The current integration checkpoint supplied by OT-CTRL for PR #131 is `aade78dd5d58808b80c11251274d8c27b78c9103`.
- Preserved facts: the exact OpenAI production project credential and the approved restricted Vimeo credential were already bound to the intended Railway web/worker scope, their safe read-only identity checks succeeded, and production `ONE_TIME_CONTENT_MEDIA_MODE` remains `off`.
- Operator changes since that proof: AWS/S3/KMS was removed from the launch design; the authorized path is local Windows processing with Drive archive and private Vimeo. No Railway deployment or media-mode change occurred.
- This result inspects and implements only the unresolved local runner, existing Drive intake, one canary source copy, local archive, occurrence-selection, and authenticated import delta.

## Existing ingest folder proof

The canary uses the already-existing connector intake. No new intake folder was created.

- Connector parent: `One Time Content Library Upload Drop - Connector (Empty)`
- Connector parent reference digest: `3de7f111bc3a56946db7b9638c84b02b9cd17081188a6c0f432e39d2cfeaf7f2`
- Canonical intake: `Class Videos (Empty)`
- Canonical intake reference digest: `3d5e881d6517d865cd0c86bc6c0eb1c2c3d3694eb3329f691e2e2cb40f736988`
- The separate `Desktop Sync (Do Not Ingest)` folder remains explicitly excluded.

`ONETIME_MEDIA_INCOMING_DIR` must resolve to the Google Drive for desktop path that syncs this exact canonical intake. The local Drive mount did not respond during read-only inspection, so no local path was guessed and the scheduled task was not installed against an unverified directory.

## Authorized canary copy

- Source retained in place: `06-whiteboard-hand-movement-2026-07-09-3220-3455.mp4`
- Source reference digest: `673131229c1704bbd0e9bf30703aa5d1fae6e128ccf4beebce49a4536c74c441`
- New copy reference digest: `6450468246be2b0ef78a8c5e4396df68d6d50e3bf8bed80dca71e6593cf853c3`
- Source and copy byte length: `54,266,856`
- Reported duration: `2:35`
- Mutation: server-side Drive copy into the canonical existing intake; the source was not moved or altered.
- This copy is a real operator-selected Drive source candidate. It has not yet been used as OpenAI, Vimeo, One Time playback, or entitlement evidence.

## Implemented runner contract

- Commands: `media:local-runner`, `start`, `stop`, `status`, `install`, `uninstall`, and explicit job `retry`.
- Windows Task Scheduler installation uses one `ONLOGON` task and a singleton PID lock.
- Durable SQLite states include detection, stability, processing, Drive copy, Vimeo upload/wait, occurrence selection, import, retry, failure, completion, and unknown provider effect.
- Intake accepts `.mkv`, `.mov`, and `.mp4`; it requires unchanged byte length and mtime for 60 seconds, a readable/writeable handle, ffprobe video, and audio when OpenAI transcription is enabled.
- Original intake files are never modified. Source SHA-256 is the duplicate boundary.
- Existing FFmpeg/OpenAI/VTT/Vimeo canary code is reused. Only a compressed 16 kHz mono MP3 is sent to OpenAI.
- Drive archive writes use `YYYY/MM/DD`, a `.partial` copy, byte-length and SHA-256 verification, final rename, and ffprobe verification of the archived video.
- Any uncertain Vimeo effect is quarantined as `unknown_provider_effect` and is not retryable without reconciliation.
- Final application import uses the authenticated Owner/Admin `/api/v1/admin/content/factory/local-import` endpoint with CSRF, an exact source-derived idempotency key, and an explicit occurrence. The runner does not use a permanent laptop database credential.
- With zero or multiple eligible occurrences, the state is `needs_occurrence_selection`; the runner never guesses.

## Focused verification

- Local runner safety unit file: 9 tests passed.
- Covered: stability window, source-hash duplicate handling, restart recovery, interrupted Drive partial copy, occurrence ambiguity, unknown Vimeo effect, no retry after unknown provider effect, import retry idempotency, and credential/URL redaction.
- Touched files passed ESLint.
- The runner `status` command succeeded against isolated temporary directories and reported a stopped singleton with an empty durable ledger.
- No broad historical suite or provider inventory was rerun.

## Current external effect and safety proof

- Google Drive effects: exactly one copied canary file in the existing connector intake; original preserved.
- OpenAI canary effects from this result: zero.
- Vimeo canary effects from this result: zero.
- One Time import/publication effects from this result: zero.
- Contact or learner notifications: zero.
- Railway configuration changes or deployments from this result: zero.
- Production media mode: `off` (preserved prior protected readback; not re-inventoried).
- Login and Zoom paths were not changed.

## Remaining exact delta

1. Select or expose the local Google Drive for desktop folder that maps to the canonical `Class Videos (Empty)` intake, then set `ONETIME_MEDIA_INCOMING_DIR` to that exact path.
2. Select a private local Drive archive directory for `ONETIME_MEDIA_DRIVE_ARCHIVE_DIR` and install/start the scheduled runner.
3. Let the copied 54,266,856-byte canary finish local sync; validate stability, write-lock, ffprobe, and audio before any provider request.
4. Run the one real source through local FFmpeg, audio-only OpenAI transcription, verified Drive archive, private Vimeo upload/captions, and occurrence selection.
5. Complete signed-in Admin review, private publication, entitled Student playback, and unentitled denial.
6. Reconcile or remove only the disposable canary provider/application artifacts, retain governed evidence, stop the runner if requested, and keep Railway media mode `off`.

No AWS account, bucket, or KMS action remains in this launch delta.
