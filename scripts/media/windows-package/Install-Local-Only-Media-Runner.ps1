param(
    [switch]$ReplaceExistingFiles,
    [string]$ConfirmReplace = '',
    [switch]$RegisterCurrentUserTask
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$TaskName = 'One Time Local Media Runner'
$UserProfilePath = [Environment]::GetFolderPath('UserProfile')
if ([string]::IsNullOrWhiteSpace($UserProfilePath)) { throw 'The current user profile path is unavailable.' }
$CanonicalRoot = [IO.Path]::GetFullPath((Join-Path $UserProfilePath 'OneTimeMedia'))

function Assert-CanonicalSafeRoot {
    param([string]$RootPath)
    $resolved = [IO.Path]::GetFullPath($RootPath)
    if (-not [string]::Equals($resolved, $CanonicalRoot, [StringComparison]::OrdinalIgnoreCase)) {
        throw 'Only the canonical current-user OneTimeMedia folder is allowed.'
    }
    if (Test-Path -LiteralPath $resolved) {
        $item = Get-Item -LiteralPath $resolved -Force
        if (($item.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0) {
            throw 'The canonical OneTimeMedia root cannot be a symlink, junction, or reparse point.'
        }
    }
    return $resolved
}

function Assert-ContainedPath {
    param([string]$RootPath, [string]$CandidatePath)
    $rootWithSeparator = $RootPath.TrimEnd('\') + '\'
    $candidate = [IO.Path]::GetFullPath($CandidatePath)
    if (-not $candidate.StartsWith($rootWithSeparator, [StringComparison]::OrdinalIgnoreCase)) {
        throw "Managed path escapes the canonical root: $CandidatePath"
    }
    return $candidate
}

function Require-Command {
    param([string]$Name)
    if (-not (Get-Command $Name -ErrorAction SilentlyContinue)) {
        throw "Required prerequisite missing: $Name. Install it for this Windows user, then run this installer again."
    }
}

function Bytes-Equal {
    param([byte[]]$Left, [byte[]]$Right)
    if ($Left.Length -ne $Right.Length) { return $false }
    for ($index = 0; $index -lt $Left.Length; $index += 1) {
        if ($Left[$index] -ne $Right[$index]) { return $false }
    }
    return $true
}

function Get-BytesSha256 {
    param([byte[]]$Bytes)
    $algorithm = [Security.Cryptography.SHA256]::Create()
    try {
        return ([BitConverter]::ToString($algorithm.ComputeHash($Bytes))).Replace('-', '').ToLowerInvariant()
    } finally {
        $algorithm.Dispose()
    }
}

function Write-AtomicBytes {
    param([string]$Destination, [byte[]]$Bytes)
    $directory = Split-Path -Parent $Destination
    New-Item -ItemType Directory -Path $directory -Force | Out-Null
    $temporary = Join-Path $directory ('.' + [IO.Path]::GetFileName($Destination) + '.' + [guid]::NewGuid().ToString('N') + '.tmp')
    try {
        [IO.File]::WriteAllBytes($temporary, $Bytes)
        Move-Item -LiteralPath $temporary -Destination $Destination -Force
    } finally {
        if (Test-Path -LiteralPath $temporary) { Remove-Item -LiteralPath $temporary -Force }
    }
}

$RootPath = Assert-CanonicalSafeRoot -RootPath $CanonicalRoot
if ($ReplaceExistingFiles -and $ConfirmReplace -ne 'REPLACE-WITH-BACKUP') {
    throw 'Replacement requires -ConfirmReplace REPLACE-WITH-BACKUP.'
}
if (-not $ReplaceExistingFiles -and -not [string]::IsNullOrEmpty($ConfirmReplace)) {
    throw 'The replacement confirmation token is valid only with -ReplaceExistingFiles.'
}

Require-Command 'node'
Require-Command 'ffmpeg'
Require-Command 'ffprobe'
$nodeVersion = (& node --version).Trim()
if ($nodeVersion -notmatch '^v24\.') { throw "Node 24 is required; found $nodeVersion." }

$requiredFolders = @('Incoming', 'Processing', 'ReadyForVimeo', 'Complete', 'Failed', 'State', 'Logs', 'Config', 'Runner', 'Backups')
foreach ($folder in $requiredFolders) {
    $directory = Assert-ContainedPath -RootPath $RootPath -CandidatePath (Join-Path $RootPath $folder)
    if (Test-Path -LiteralPath $directory) {
        $item = Get-Item -LiteralPath $directory -Force
        if (-not $item.PSIsContainer -or ($item.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0) {
            throw "Required folder is not a safe local directory: $directory"
        }
    }
}

$utf8 = New-Object Text.UTF8Encoding($false)
$runnerSource = Join-Path $PSScriptRoot 'OneTimeLocalMediaRunner.mjs'
if (-not (Test-Path -LiteralPath $runnerSource -PathType Leaf)) { throw 'The packaged runner is missing.' }
$runnerPath = Join-Path $RootPath 'Runner\OneTimeLocalMediaRunner.mjs'
$settingsPath = Join-Path $RootPath 'Config\settings.local.json'
$processCommandPath = Join-Path $RootPath 'Config\PROCESS-INCOMING-VIDEO.cmd'
$statusCommandPath = Join-Path $RootPath 'Config\CHECK-MEDIA-QUEUE.cmd'
$taskCommandPath = Join-Path $RootPath 'Config\START-ONE-TIME-MEDIA-RUNNER.cmd'
$installRecordPath = Join-Path $RootPath 'State\local-media-runner-install.json'

$settings = [ordered]@{
    schemaVersion = 2
    rootPath = $RootPath
    incomingDir = (Join-Path $RootPath 'Incoming')
    processingDir = (Join-Path $RootPath 'Processing')
    readyForVimeoDir = (Join-Path $RootPath 'ReadyForVimeo')
    completeDir = (Join-Path $RootPath 'Complete')
    failedDir = (Join-Path $RootPath 'Failed')
    stateDir = (Join-Path $RootPath 'State')
    logsDir = (Join-Path $RootPath 'Logs')
    stableFileSeconds = 60
    rawSourceRetentionDays = 7
    transcriptionMode = 'off'
}
$settingsText = ($settings | ConvertTo-Json -Depth 4) + "`n"
$processCommand = @"
@echo off
node "$runnerPath" start --once --wait-for-stability --process-local --root "$RootPath"
pause
"@
$statusCommand = @"
@echo off
node "$runnerPath" status --root "$RootPath"
pause
"@
$taskCommand = @"
@echo off
node "$runnerPath" start --process-local --root "$RootPath" >> "$RootPath\Logs\runner.log" 2>&1
"@

$managedFiles = @(
    [pscustomobject]@{ RelativePath = 'Runner/OneTimeLocalMediaRunner.mjs'; Destination = $runnerPath; Bytes = [IO.File]::ReadAllBytes($runnerSource); RemoveOnUninstall = $true },
    [pscustomobject]@{ RelativePath = 'Config/settings.local.json'; Destination = $settingsPath; Bytes = $utf8.GetBytes($settingsText); RemoveOnUninstall = $false },
    [pscustomobject]@{ RelativePath = 'Config/PROCESS-INCOMING-VIDEO.cmd'; Destination = $processCommandPath; Bytes = [Text.Encoding]::ASCII.GetBytes($processCommand); RemoveOnUninstall = $true },
    [pscustomobject]@{ RelativePath = 'Config/CHECK-MEDIA-QUEUE.cmd'; Destination = $statusCommandPath; Bytes = [Text.Encoding]::ASCII.GetBytes($statusCommand); RemoveOnUninstall = $true }
)
if ($RegisterCurrentUserTask) {
    $managedFiles += [pscustomobject]@{ RelativePath = 'Config/START-ONE-TIME-MEDIA-RUNNER.cmd'; Destination = $taskCommandPath; Bytes = [Text.Encoding]::ASCII.GetBytes($taskCommand); RemoveOnUninstall = $true }
    if (Get-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue) {
        throw "Scheduled task '$TaskName' already exists. The installer will not replace any existing task."
    }
}

$installedFileRecords = @($managedFiles | ForEach-Object {
    [ordered]@{
        relativePath = $_.RelativePath
        sha256 = Get-BytesSha256 -Bytes $_.Bytes
        removeOnUninstall = $_.RemoveOnUninstall
    }
})
$installRecord = [ordered]@{
    schemaVersion = 1
    canonicalRoot = $RootPath
    installedFiles = $installedFileRecords
    task = if ($RegisterCurrentUserTask) { [ordered]@{ name = $TaskName; commandPath = $taskCommandPath } } else { $null }
}
$installRecordBytes = $utf8.GetBytes(($installRecord | ConvertTo-Json -Depth 8) + "`n")
$installRecordFile = [pscustomobject]@{
    RelativePath = 'State/local-media-runner-install.json'
    Destination = $installRecordPath
    Bytes = $installRecordBytes
    RemoveOnUninstall = $true
}
$allManagedFiles = @($managedFiles) + @($installRecordFile)

$differences = @()
foreach ($file in $allManagedFiles) {
    $destination = Assert-ContainedPath -RootPath $RootPath -CandidatePath $file.Destination
    if (Test-Path -LiteralPath $destination) {
        $item = Get-Item -LiteralPath $destination -Force
        if ($item.PSIsContainer -or ($item.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0) {
            throw "Managed destination is not a safe regular file: $destination"
        }
        if (-not (Bytes-Equal -Left ([IO.File]::ReadAllBytes($destination)) -Right $file.Bytes)) {
            $differences += $file
        }
    }
}
if ($differences.Count -gt 0 -and -not $ReplaceExistingFiles) {
    $names = ($differences.RelativePath -join ', ')
    throw "Installation refused because managed files differ: $names. Use the documented replacement command to back them up first."
}

New-Item -ItemType Directory -Path $RootPath -Force | Out-Null
foreach ($folder in $requiredFolders) {
    $directory = Assert-ContainedPath -RootPath $RootPath -CandidatePath (Join-Path $RootPath $folder)
    if (-not (Test-Path -LiteralPath $directory)) {
        New-Item -ItemType Directory -Path $directory | Out-Null
    }
}

$backupDirectory = $null
if ($differences.Count -gt 0) {
    $backupDirectory = Join-Path $RootPath ('Backups\installer-' + (Get-Date).ToUniversalTime().ToString('yyyyMMddTHHmmssZ') + '-' + [guid]::NewGuid().ToString('N'))
    New-Item -ItemType Directory -Path $backupDirectory | Out-Null
    foreach ($file in $differences) {
        $backupPath = Join-Path $backupDirectory $file.RelativePath.Replace('/', '\')
        New-Item -ItemType Directory -Path (Split-Path -Parent $backupPath) -Force | Out-Null
        Copy-Item -LiteralPath $file.Destination -Destination $backupPath
    }
}

foreach ($file in $allManagedFiles) {
    if (-not (Test-Path -LiteralPath $file.Destination) -or $differences.RelativePath -contains $file.RelativePath) {
        Write-AtomicBytes -Destination $file.Destination -Bytes $file.Bytes
    }
}

if ($RegisterCurrentUserTask) {
    schtasks.exe /Create /TN $TaskName /TR ('"' + $taskCommandPath + '"') /SC ONLOGON /RL LIMITED | Out-Host
    if ($LASTEXITCODE -ne 0) { throw 'The current-user scheduled task could not be created.' }
}

Write-Host 'Local-only media preparation is installed.'
if ($backupDirectory) { Write-Host "Previous managed files were backed up to: $backupDirectory" }
Write-Host "Copy one operator-owned video into $RootPath\Incoming, then run $processCommandPath"
Write-Host 'No desktop shortcut was created or changed. No provider or network call was made.'
