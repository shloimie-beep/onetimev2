# Local Windows Media Runner Result

- Result: `code_ready_laptop_installed_protected_canary_pending`
- Recorded at: `2026-08-12T11:15:00+03:00`
- Repository: `shloimie-beep/onetimev2`
- Integration branch: `codex/one-time-complete-production-launch-20260805`
- Child branch: `codex/ot-p5-local-windows-media-runner-20260809`
- Base SHA: `9b987dabdd45266dde63cdf4e55b17947152ae11`
- Production Railway media mode: `off`
- Windows task: `One Time Local Media Runner` (`current_user`, `running`)
- Raw recording retention: `at_least_7_days`
- AWS/S3/KMS: `deferred_disabled`

## Implemented launch path

The current launch contract now names the laptop path as authoritative:

```text
OBS Incoming folder
-> 60-second size/mtime and released-write-handle stability gate
-> local ffprobe decode proof and source SHA-256
-> exact or operator-selected class occurrence
-> local OT-VIDEO-1 FFmpeg render
-> bounded local audio extraction and optional OpenAI transcription
-> private Vimeo TUS upload, reconciliation, readiness polling, and captions
-> narrow HMAC-signed One Time Draft import
-> optional non-blocking Drive sync-folder archive
```

The full video is never submitted to OpenAI. Transcription mode `off` still renders, uploads,
and imports a truthful Draft without claiming captions or transcript effects. Drive archive
failure remains visible and retryable but does not gate Vimeo or One Time import.

## Durability and safety

- SQLite stores the required job states with WAL and full synchronous writes.
- The duplicate boundary is source SHA-256 plus the selected occurrence.
- Interrupted processing/transcription returns to retry; interrupted import returns to the
  idempotent signed import step.
- Vimeo creation is preceded by an exact operation-marker reconciliation query. A ticket is
  persisted before upload, and TUS resumes from the provider-reported offset.
- An uncertain Vimeo ticket effect is quarantined for reconciliation instead of blindly
  creating another upload.
- The Vimeo credential is bound to an exact expected owner account before writes.
- Private Vimeo readiness and exact marker/privacy readback are required before import.
- Provider secrets use current-user Windows DPAPI storage or explicit environment/legacy
  keyholder adapters; settings, SQLite, and sanitized logs never store the secret values.
- The narrow server endpoint is default-off, body-bound by HMAC SHA-256, timestamp-bounded,
  target-bounded, and fails closed without its configured key.
- Content remains `needs_review` until the existing Admin approval and publication path runs.
- Uninstall removes the task and controls only; recordings, processed files, state, settings,
  logs, and protected secrets are preserved.

## Laptop installation evidence

- Bootstrap root: `%USERPROFILE%\OneTimeMedia`
- Node: `v24.17.0`
- FFmpeg and ffprobe: Gyan FFmpeg `9.0`, installed through WinGet and saved as exact absolute
  executable paths in the local non-secret settings.
- Repository path was written to the bootstrap settings.
- Start, stop, status, retry, and occurrence-selection controls were written under the local
  `Config` folder.
- The elevated installer registered the `One Time Local Media Runner` current-user logon task.
- Task Scheduler readback reported the task as running under user `sdrat`.
- `media:local-runner:status` succeeded with an empty initial queue.
- The runner singleton remained active after installation.
- A copyable Windows control package was generated as
  `ONE-TIME-LOCAL-MEDIA-RUNNER-WINDOWS-2026-08-12.zip` with SHA-256
  `976204EF03930ED64821C718BF1002B5B6A84422D91A4826102A9BCB0AE05D72`.

## Local FFmpeg smoke evidence

An operator-owned synthetic three-second audio/video fixture exercised the real local processing
path with transcription disabled. It did not make an OpenAI, Vimeo, Drive, database, or One Time
network call.

- Source SHA-256: `a19b538d76e927aa544f6b060d97ed06a8b738a8a699ef588833a53a3101e725`
- Prepared SHA-256: `5d4a8f08299812bb2d71a5ebac4b67e8c584d094bce44df1dba25cd7ca7ef39c`
- Original duration: `3021 ms`
- Prepared duration: `3008 ms`
- Video readback: H.264, `yuv420p`, `640x360`, `30 fps`
- Audio readback: AAC-LC, `48 kHz`, stereo, measured average `121408 bps` against the
  `128000 bps` target
- Safe trim: full recording retained; no middle cut
- Transcription mode: `off`

This smoke revealed that short AAC streams do not read back as the literal encoder target. The
executable verifier now accepts only a bounded +/-16 kbps measured average while continuing to
return the canonical OT-VIDEO-1 `128000 bps` profile value.

## Focused validation

- TypeScript project type-check: `passed`
- Local runner/auth/config/migration unit coverage: `17 passed`
- Signed occurrence lookup and idempotent transcription-off Draft import integration: `2 passed`
- Targeted ESLint: `passed`
- Windows PowerShell installer/control parser validation: `passed`
- Real local FFmpeg processing smoke: `passed`
- Runner start-once/status validation: `passed`
- Diff whitespace check: `passed`
- Repository-wide Prettier check: `pre-existing baseline failure` (the checkout reports thousands
  of already-unformatted files); changed local-runner TypeScript files were formatted directly.
- Live PostgreSQL migration verification: `not run` because this laptop has no `DATABASE_URL`;
  the complete migration set, including `2278`, passed the pg-mem signed-import integration.

Coverage includes exact HMAC/body/target/time validation, unsigned denial, stability-clock reset,
source-plus-occurrence dedupe, SQLite restart recovery, provider-marker reconciliation,
credential/error redaction, default-off endpoint configuration, occurrence ambiguity state,
transcription-off import truth, and idempotent repeated import.

## Protected canary gate

No provider credential was entered, read, printed, or committed during implementation. No live
OpenAI request, Vimeo write, One Time production import, Drive copy, Admin approval, Student
playback, denial verification, or unpublish action was performed.

The one real two-to-three-minute canary must resume only after a human:

1. supplies the existing One Time OpenAI project ID and exact Vimeo owner account ID as non-secret
   settings;
2. enters the existing OpenAI, Vimeo, and shared import HMAC secrets directly into Windows
   DPAPI-protected storage and binds the same import key in the deployed One Time environment;
3. records an operator-owned OBS sample containing no children or third-party material; and
4. performs the final Admin approval plus entitled/unentitled browser verification.

OT-CTRL still owns merge, migration, production variable binding, and deployment. This child
branch did not deploy and does not change the production Railway media mode from `off`.
