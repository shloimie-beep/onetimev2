# One Time Local Media Preparation

This package has one job: turn an operator-owned `.mkv`, `.mp4`, or `.mov` recording into a local review-ready MP4 plus a local `.review.json` manifest.

It makes zero OpenAI, Vimeo, Google Drive, One Time, or other network calls. It cannot transcribe, upload, publish, import, approve, or delete a recording. The source recording stays in `Incoming`.

## Prerequisites

- Windows
- Node.js 24
- FFmpeg and ffprobe already available to the current user

The package checks these prerequisites. It does not install system software.

## Install

1. Double-click `VERIFY-PACKAGE-INTEGRITY.cmd`.
2. Double-click `INSTALL-LOCAL-ONLY-MEDIA-RUNNER.cmd`.

The installer uses only `%USERPROFILE%\OneTimeMedia`. It never changes a desktop shortcut. If a managed file already exists with different contents, installation stops before changing anything.

An intentional replacement requires this exact PowerShell confirmation:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\Install-Local-Only-Media-Runner.ps1 -ReplaceExistingFiles -ConfirmReplace REPLACE-WITH-BACKUP
```

Every differing managed file is copied into a timestamped backup folder before replacement.

## Prepare one local derivative

1. Copy one operator-owned video into `%USERPROFILE%\OneTimeMedia\Incoming`.
2. Double-click `%USERPROFILE%\OneTimeMedia\Config\PROCESS-INCOMING-VIDEO.cmd`.
3. Keep the window open while the runner observes the file twice, 60 seconds apart.
4. Review the MP4 and matching `.review.json` in `ReadyForVimeo`.

Only one runner may use the queue at a time. Existing outputs are never overwritten.

## Uninstall the runner

Double-click `UNINSTALL-LOCAL-ONLY-MEDIA-RUNNER.cmd` and type the requested confirmation token. Uninstall removes only unchanged runner-owned files and an owned scheduled task, if one was explicitly installed. It preserves recordings, derivatives, settings, state, logs, and backups.
