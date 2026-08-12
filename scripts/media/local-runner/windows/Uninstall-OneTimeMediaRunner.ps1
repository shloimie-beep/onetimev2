param(
    [string]$SettingsPath = "$env:USERPROFILE\OneTimeMedia\Config\settings.local.json",
    [string]$TaskName = 'One Time Local Media Runner'
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

& schtasks.exe /End /TN $TaskName 2>$null | Out-Null
& schtasks.exe /Delete /TN $TaskName /F 2>$null | Out-Null

if (Test-Path -LiteralPath $SettingsPath -PathType Leaf) {
    $settings = Get-Content -LiteralPath $SettingsPath -Raw | ConvertFrom-Json
    $configDir = Join-Path ([string]$settings.rootPath) 'Config'
    foreach ($name in @(
        'Start-OneTimeMediaRunnerTask.cmd',
        'Start-OneTimeMediaRunner.cmd',
        'Stop-OneTimeMediaRunner.cmd',
        'Status-OneTimeMediaRunner.cmd',
        'Retry-OneTimeMediaJob.cmd',
        'Select-OneTimeMediaOccurrence.cmd'
    )) {
        $target = Join-Path $configDir $name
        if (Test-Path -LiteralPath $target -PathType Leaf) {
            Remove-Item -LiteralPath $target -Force
        }
    }
}

Write-Host "Uninstalled current-user task: $TaskName"
Write-Host 'Recordings, processed media, settings, state, logs, and protected secrets were preserved.'
