param(
    [string]$SettingsPath = "$env:USERPROFILE\OneTimeMedia\Config\settings.local.json",
    [string]$TaskName = 'One Time Local Media Runner',
    [switch]$NoDependencyInstall,
    [switch]$NoStart
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..\..\..\..')).Path
if (-not (Test-Path -LiteralPath $SettingsPath -PathType Leaf)) {
    throw "Local media settings were not found: $SettingsPath"
}

$nodeVersion = (& node.exe --version 2>$null).Trim()
if ($nodeVersion -notmatch '^v24\.') {
    throw "Node 24 is required. Found: $nodeVersion"
}
$persistedUserPath = [Environment]::GetEnvironmentVariable('Path', 'User')
if (-not [string]::IsNullOrWhiteSpace($persistedUserPath)) {
    $env:Path = "$env:Path;$persistedUserPath"
}

$settings = Get-Content -LiteralPath $SettingsPath -Raw | ConvertFrom-Json
foreach ($requiredProperty in @('rootPath', 'stateDir', 'logsDir', 'configDir')) {
    if ($requiredProperty -eq 'configDir') { continue }
    if (-not $settings.PSObject.Properties.Name.Contains($requiredProperty)) {
        throw "The settings file is missing $requiredProperty."
    }
}

function Resolve-ConfiguredExecutable {
    param([string]$PropertyName, [string]$CommandName)
    if ($settings.PSObject.Properties.Name.Contains($PropertyName)) {
        $configured = [string]$settings.$PropertyName
        if (-not [string]::IsNullOrWhiteSpace($configured) -and (Test-Path -LiteralPath $configured -PathType Leaf)) {
            return (Resolve-Path -LiteralPath $configured).Path
        }
    }
    $command = Get-Command $CommandName -ErrorAction SilentlyContinue
    if (-not $command) {
        throw "$CommandName is required and was not found."
    }
    return $command.Source
}

$ffmpegPath = Resolve-ConfiguredExecutable -PropertyName 'ffmpegPath' -CommandName 'ffmpeg.exe'
$ffprobePath = Resolve-ConfiguredExecutable -PropertyName 'ffprobePath' -CommandName 'ffprobe.exe'

foreach ($update in @{
    repositoryPath = $repoRoot
    ffmpegPath = $ffmpegPath
    ffprobePath = $ffprobePath
}.GetEnumerator()) {
    if ($settings.PSObject.Properties.Name.Contains($update.Key)) {
        $settings.($update.Key) = $update.Value
    } else {
        $settings | Add-Member -NotePropertyName $update.Key -NotePropertyValue $update.Value
    }
}
$settings | ConvertTo-Json -Depth 10 | Set-Content -LiteralPath $SettingsPath -Encoding UTF8

$permissionProbe = Join-Path ([string]$settings.stateDir) 'install-permission-probe.tmp'
New-Item -ItemType Directory -Path ([string]$settings.stateDir) -Force | Out-Null
Set-Content -LiteralPath $permissionProbe -Value 'permission-check' -Encoding ASCII
Remove-Item -LiteralPath $permissionProbe -Force

if (-not $NoDependencyInstall) {
    Push-Location $repoRoot
    try {
        & npm.cmd ci
        if ($LASTEXITCODE -ne 0) { throw "npm ci failed with exit code $LASTEXITCODE." }
    } finally {
        Pop-Location
    }
}

$configDir = Join-Path ([string]$settings.rootPath) 'Config'
$logsDir = [string]$settings.logsDir
New-Item -ItemType Directory -Path $configDir, $logsDir -Force | Out-Null
$runnerWrapper = Join-Path $configDir 'Start-OneTimeMediaRunnerTask.cmd'
$runnerLog = Join-Path $logsDir 'runner.log'
@"
@echo off
set "ONE_TIME_MEDIA_SETTINGS_PATH=$SettingsPath"
cd /d "$repoRoot"
call npm.cmd run media:local-runner:start >> "$runnerLog" 2>&1
"@ | Set-Content -LiteralPath $runnerWrapper -Encoding ASCII

$startControl = Join-Path $configDir 'Start-OneTimeMediaRunner.cmd'
$stopControl = Join-Path $configDir 'Stop-OneTimeMediaRunner.cmd'
$statusControl = Join-Path $configDir 'Status-OneTimeMediaRunner.cmd'
$retryControl = Join-Path $configDir 'Retry-OneTimeMediaJob.cmd'
$selectControl = Join-Path $configDir 'Select-OneTimeMediaOccurrence.cmd'

"@echo off`r`nschtasks.exe /Run /TN `"$TaskName`"`r`n" |
    Set-Content -LiteralPath $startControl -Encoding ASCII
"@echo off`r`nschtasks.exe /End /TN `"$TaskName`"`r`n" |
    Set-Content -LiteralPath $stopControl -Encoding ASCII
@"
@echo off
set "ONE_TIME_MEDIA_SETTINGS_PATH=$SettingsPath"
cd /d "$repoRoot"
call npm.cmd run media:local-runner:status
pause
"@ | Set-Content -LiteralPath $statusControl -Encoding ASCII
@"
@echo off
set "ONE_TIME_MEDIA_SETTINGS_PATH=$SettingsPath"
cd /d "$repoRoot"
call npm.cmd run media:local-runner:retry -- %*
"@ | Set-Content -LiteralPath $retryControl -Encoding ASCII
@"
@echo off
set "ONE_TIME_MEDIA_SETTINGS_PATH=$SettingsPath"
cd /d "$repoRoot"
call npm.cmd run media:local-runner:select-occurrence -- %*
"@ | Set-Content -LiteralPath $selectControl -Encoding ASCII

& schtasks.exe /Create /TN $TaskName /TR ('"' + $runnerWrapper + '"') /SC ONLOGON /RL LIMITED /F | Out-Host
if ($LASTEXITCODE -ne 0) { throw "Task registration failed with exit code $LASTEXITCODE." }

Push-Location $repoRoot
try {
    & npm.cmd run media:local-runner:status | Out-Host
    if ($LASTEXITCODE -ne 0) { throw 'The local runner status validation failed.' }
} finally {
    Pop-Location
}

if (-not $NoStart) {
    & schtasks.exe /Run /TN $TaskName | Out-Host
    if ($LASTEXITCODE -ne 0) { throw "Task start failed with exit code $LASTEXITCODE." }
}

Write-Host "Installed current-user task: $TaskName"
Write-Host "Settings: $SettingsPath"
Write-Host "Controls: $configDir"
Write-Host 'Provider credentials were not read or written by this installer.'
