param(
    [Parameter(Mandatory = $true)]
    [string]$ConfirmRemove
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

if ($ConfirmRemove -ne 'REMOVE-LOCAL-RUNNER') {
    throw 'Uninstall requires the exact confirmation token REMOVE-LOCAL-RUNNER.'
}

$TaskName = 'One Time Local Media Runner'
$UserProfilePath = [Environment]::GetFolderPath('UserProfile')
if ([string]::IsNullOrWhiteSpace($UserProfilePath)) { throw 'The current user profile path is unavailable.' }
$CanonicalRoot = [IO.Path]::GetFullPath((Join-Path $UserProfilePath 'OneTimeMedia'))
if (-not (Test-Path -LiteralPath $CanonicalRoot -PathType Container)) {
    throw 'The canonical current-user OneTimeMedia folder does not exist.'
}
$rootItem = Get-Item -LiteralPath $CanonicalRoot -Force
if (($rootItem.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0) {
    throw 'The canonical OneTimeMedia root cannot be a symlink, junction, or reparse point.'
}
$resolvedRoot = [IO.Path]::GetFullPath($rootItem.FullName)
if (-not [string]::Equals($resolvedRoot, $CanonicalRoot, [StringComparison]::OrdinalIgnoreCase)) {
    throw 'The uninstall target did not resolve to the canonical current-user OneTimeMedia folder.'
}

function Resolve-OwnedPath {
    param([string]$RelativePath)
    if ([IO.Path]::IsPathRooted($RelativePath) -or $RelativePath -match '(^|[\\/])\.\.([\\/]|$)') {
        throw "Unsafe installed-file path: $RelativePath"
    }
    $candidate = [IO.Path]::GetFullPath((Join-Path $CanonicalRoot $RelativePath.Replace('/', '\')))
    $prefix = $CanonicalRoot.TrimEnd('\') + '\'
    if (-not $candidate.StartsWith($prefix, [StringComparison]::OrdinalIgnoreCase)) {
        throw "Installed-file path escapes the canonical root: $RelativePath"
    }
    $inspected = $CanonicalRoot
    foreach ($segment in $RelativePath.Replace('/', '\').Split('\', [StringSplitOptions]::RemoveEmptyEntries)) {
        $inspected = Join-Path $inspected $segment
        if (Test-Path -LiteralPath $inspected) {
            $item = Get-Item -LiteralPath $inspected -Force
            if (($item.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0) {
                throw "Installed-file path crosses a symlink, junction, or reparse point: $RelativePath"
            }
        }
    }
    return $candidate
}

$installRecordPath = Resolve-OwnedPath -RelativePath 'State/local-media-runner-install.json'
if (-not (Test-Path -LiteralPath $installRecordPath -PathType Leaf)) {
    throw 'The verified local media runner install record is missing.'
}
$recordItem = Get-Item -LiteralPath $installRecordPath -Force
if (($recordItem.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0) {
    throw 'The install record cannot be a symlink or reparse point.'
}
$record = Get-Content -LiteralPath $installRecordPath -Raw | ConvertFrom-Json
if (-not [string]::Equals([IO.Path]::GetFullPath($record.canonicalRoot), $CanonicalRoot, [StringComparison]::OrdinalIgnoreCase)) {
    throw 'The install record names a different root.'
}

$verifiedFiles = @()
$allowedRemovalPaths = @(
    'runner/onetimelocalmediarunner.mjs',
    'config/process-incoming-video.cmd',
    'config/check-media-queue.cmd',
    'config/start-one-time-media-runner.cmd'
)
foreach ($installedFile in $record.installedFiles) {
    if ($installedFile.removeOnUninstall -eq $false) { continue }
    $normalizedRelativePath = ([string]$installedFile.relativePath).Replace('\', '/').ToLowerInvariant()
    if ($allowedRemovalPaths -notcontains $normalizedRelativePath) {
        throw "The install record requested removal of an unrecognized path: $normalizedRelativePath"
    }
    $filePath = Resolve-OwnedPath -RelativePath $installedFile.relativePath
    if (-not (Test-Path -LiteralPath $filePath)) { continue }
    $item = Get-Item -LiteralPath $filePath -Force
    if ($item.PSIsContainer -or ($item.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0) {
        throw "Runner-owned path is no longer a safe regular file: $filePath"
    }
    $hash = (Get-FileHash -LiteralPath $filePath -Algorithm SHA256).Hash.ToLowerInvariant()
    if ($hash -ne $installedFile.sha256) {
        throw "Runner-owned file changed after installation and will not be removed: $filePath"
    }
    $verifiedFiles += $filePath
}

if ($null -ne $record.task) {
    if ($record.task.name -ne $TaskName) { throw 'The install record names an unrecognized scheduled task.' }
    $task = Get-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue
    if ($task) {
        $expectedCommand = Resolve-OwnedPath -RelativePath 'Config/START-ONE-TIME-MEDIA-RUNNER.cmd'
        $actions = @($task.Actions)
        if ($actions.Count -ne 1) { throw 'The existing scheduled task is not owned by this package.' }
        $actualCommand = [IO.Path]::GetFullPath(([string]$actions[0].Execute).Trim('"'))
        if (-not [string]::Equals($actualCommand, $expectedCommand, [StringComparison]::OrdinalIgnoreCase)) {
            throw 'The existing scheduled task is not owned by this package.'
        }
        Unregister-ScheduledTask -TaskName $TaskName -Confirm:$false
    }
}

foreach ($filePath in $verifiedFiles) { Remove-Item -LiteralPath $filePath -Force }
Remove-Item -LiteralPath $installRecordPath -Force

$runnerDirectory = Resolve-OwnedPath -RelativePath 'Runner'
if ((Test-Path -LiteralPath $runnerDirectory -PathType Container) -and -not (Get-ChildItem -LiteralPath $runnerDirectory -Force)) {
    Remove-Item -LiteralPath $runnerDirectory
}

Write-Host 'The verified local runner files were removed.'
Write-Host "Recordings, derivatives, settings, state, logs, and backups remain under: $CanonicalRoot"
