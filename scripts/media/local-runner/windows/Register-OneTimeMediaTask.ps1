param(
    [Parameter(Mandatory = $true)]
    [string]$RepoPath,
    [string]$RootPath = "$env:USERPROFILE\OneTimeMedia",
    [string]$TaskName = 'One Time Local Media Runner'
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$packageJson = Join-Path $RepoPath 'package.json'
if (-not (Test-Path -LiteralPath $packageJson -PathType Leaf)) {
    throw "Repository package.json not found: $packageJson"
}
$package = Get-Content -LiteralPath $packageJson -Raw | ConvertFrom-Json
if (-not $package.scripts.'media:local-runner:start') {
    throw 'The repository does not expose media:local-runner:start.'
}

$settingsPath = Join-Path $RootPath 'Config\settings.local.json'
if (-not (Test-Path -LiteralPath $settingsPath -PathType Leaf)) {
    throw "Local media settings were not found: $settingsPath"
}
$logs = Join-Path $RootPath 'Logs'
$config = Join-Path $RootPath 'Config'
New-Item -ItemType Directory -Path $logs, $config -Force | Out-Null
$wrapperPath = Join-Path $config 'Start-OneTimeMediaRunnerTask.cmd'
$logPath = Join-Path $logs 'runner.log'
@"
@echo off
set "ONE_TIME_MEDIA_SETTINGS_PATH=$settingsPath"
cd /d "$RepoPath"
call npm.cmd run media:local-runner:start >> "$logPath" 2>&1
"@ | Set-Content -LiteralPath $wrapperPath -Encoding ASCII

& schtasks.exe /Create /TN $TaskName /TR ('"' + $wrapperPath + '"') /SC ONLOGON /RL LIMITED /F | Out-Host
if ($LASTEXITCODE -ne 0) { throw "Task registration failed with exit code $LASTEXITCODE." }
Write-Host "Registered scheduled task: $TaskName"
Write-Host "Runner wrapper: $wrapperPath"
