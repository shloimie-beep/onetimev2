# Local Windows Media Runner — Build Result

Candidate: `codex/ot-p5-local-windows-media-runner-20260812` from exact integration `149e681955be7d6ddca65e3e74a1f5ce7208b966`.

## What this candidate provides

- A local, SQLite-backed Windows media queue rooted at the operator's existing `OneTimeMedia` folder.
- A two-observation, 60-second unchanged-file stability gate and ffprobe validation for `.mkv`, `.mp4`, and `.mov` inputs; first sighting always waits.
- An explicit local-only FFmpeg path that produces an H.264/AAC, max-1080p/30fps, fast-start MP4 in `ReadyForVimeo`.
- A redacted review manifest which records hashes and the remaining review/occurrence/publication steps.
- Status and retry commands that expose no local paths or provider values.

## Deliberate safety boundary

This candidate does not call Vimeo, OpenAI, Drive, One Time, or any other provider. It does not upload, publish, import, transcribe, delete source recordings, or schedule a background task. Local processing requires the operator to add `--process-local`; all provider effects remain unavailable pending one-video acceptance.

## Operator workflow after merge

1. Install FFmpeg and ffprobe for the current user (the bootstrap check currently reports both missing).
2. Extract `ONE-TIME-LOCAL-MEDIA-LAPTOP-BOOTSTRAP-2026-08-12-R3.zip`, then use `VERIFY-PACKAGE-INTEGRITY.cmd` and double-click `INSTALL-LOCAL-ONLY-MEDIA-RUNNER.cmd`.
3. Put one operator-owned video in `Incoming`, then double-click `Config\PROCESS-INCOMING-VIDEO.cmd`; it performs the required two stable observations itself.
4. Review the derivative and its `.review.json` file in `ReadyForVimeo`; no publication occurs from this command.

## Verification

Run the focused unit test and TypeScript check before integrating. No real or synthetic videos, credentials, provider calls, scheduled tasks, or production changes were used for this result.
