# One Time local media laptop package

1. Install Node 24 and FFmpeg if the prerequisite check reports them missing.
2. Run `Install-OneTimeMediaRunner.ps1` from the repository checkout. If Task Scheduler returns
   access denied, run the same command from an Administrator PowerShell; the task itself is still
   registered at limited current-user privilege.
3. Enter provider secrets interactively with `Set-OneTimeMediaSecret.ps1`; do not put secrets in
   JSON, a command line, chat, logs, or screenshots.
4. Configure the non-secret One Time URL, OpenAI project ID, and exact Vimeo owner account ID in
   `%USERPROFILE%\OneTimeMedia\Config\settings.local.json`.
5. Record OBS to MKV inside `Incoming`. Use Status and the occurrence-selection control if the
   approved time window does not contain exactly one class.

Uninstall preserves all recordings, processed media, settings, state, logs, and protected secrets.
