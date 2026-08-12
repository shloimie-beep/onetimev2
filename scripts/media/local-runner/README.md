# One Time local Windows media runner

This runner watches `%USERPROFILE%\OneTimeMedia\Incoming` for OBS `.mkv`, `.mp4`, and
`.mov` recordings. It keeps video processing on the laptop, sends only bounded extracted audio
to OpenAI when transcription is enabled, uploads the OT-VIDEO-1 MP4 to private Vimeo, and calls
the narrow signed One Time Draft-import endpoint. Optional Drive-folder copying is asynchronous
and never gates Vimeo or One Time import.

## Install and controls

Run `npm run media:local-runner:install-windows` from an ordinary current-user PowerShell. The
installer validates Node 24, FFmpeg, ffprobe, the bootstrap settings, folder write access, and
dependencies before registering the `One Time Local Media Runner` logon task. It writes Start,
Stop, Status, Retry, and occurrence-selection controls into the bootstrap `Config` folder.

Use `windows/Set-OneTimeMediaSecret.ps1 -Name <name>` in an interactive PowerShell to enter each
provider secret directly into current-user DPAPI-protected storage. Never put a secret in
`settings.local.json` or a command line. The supported names are `openai_api_key`,
`vimeo_access_token`, and `one_time_import_hmac_key`.

The non-secret settings that must be configured for the full path are `oneTimeBaseUrl`,
`openAiProjectId` (unless transcription mode is `off`), and `vimeoAccountId`. An optional
`vimeoProjectUri` and Drive sync-folder `driveArchiveDir` may also be set.

If zero or several occurrences match the approved time window, run Status and then use:

```text
npm run media:local-runner:select-occurrence -- --job <job-id> --occurrence <occurrence-key>
```

Uninstalling removes only the task and control wrappers. It intentionally preserves raw
recordings, processed media, SQLite state, logs, settings, and protected secrets.
