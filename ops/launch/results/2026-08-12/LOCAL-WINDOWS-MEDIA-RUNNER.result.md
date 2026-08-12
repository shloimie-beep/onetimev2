# Local Windows Media Runner — Build Result

Candidate: `codex/ot-p5-local-windows-media-runner-20260812` rebased from exact integration `ce0d8ff9ce35d029f9287d09006dab99d7b04aa9`.

## What this candidate provides

- A local, SQLite-backed Windows media queue rooted at the operator's existing `OneTimeMedia` folder.
- A two-observation, 60-second unchanged-file stability gate and ffprobe validation for `.mkv`, `.mp4`, and `.mov` inputs; first sighting always waits.
- An explicit local-only FFmpeg path that produces an H.264/AAC, max-1080p/30fps, fast-start MP4 in `ReadyForVimeo`.
- A redacted local review manifest which records hashes and requires operator review while exposing no publication action.
- Status and retry commands that expose no local paths or provider values.
- A self-contained R4 Windows ZIP whose complete manifest inventories every packaged file, including the manifest self-entry.

## Deliberate safety boundary

This candidate does not call Vimeo, OpenAI, Drive, One Time, or any other provider. It does not upload, publish, import, transcribe, approve, or delete source recordings. Local processing requires the operator to add `--process-local`; all provider effects remain unavailable pending one-video acceptance.

Configured paths must resolve under the canonical local root without symlink, junction, or reparse escapes. Source files are re-statted after hashing and after probing/rendering. A full source SHA names the final derivative; FFmpeg cannot overwrite, temporary output is unique, finalization is exclusive, and a differing existing derivative is a hard stop. A stale runner lock is recovered only when the recorded PID is demonstrably dead.

## Operator workflow after merge

1. Install FFmpeg and ffprobe for the current user (the bootstrap check currently reports both missing).
2. Extract `ONE-TIME-LOCAL-MEDIA-LAPTOP-BOOTSTRAP-2026-08-12-R4.zip`, then use `VERIFY-PACKAGE-INTEGRITY.cmd` and double-click `INSTALL-LOCAL-ONLY-MEDIA-RUNNER.cmd`.
3. Put one operator-owned video in `Incoming`, then double-click `Config\PROCESS-INCOMING-VIDEO.cmd`; it performs the required two stable observations itself.
4. Review the derivative and its `.review.json` file in `ReadyForVimeo`; no publication occurs from this command.

## Verification

Run the focused runner/package unit tests, TypeScript, lint, formatting, PowerShell parser, package-manifest, and bundled custom-root status checks before integrating. No real or synthetic videos, credentials, provider calls, scheduled tasks, production changes, system-software installation, or writes to the installed `C:\Users\User\OneTimeMedia` were used for this result.
