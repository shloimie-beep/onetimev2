param(
    [string]$RootPath = "$env:USERPROFILE\OneTimeMedia"
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$settingsPath = Join-Path $RootPath 'Config\settings.local.json'
$nodeVersion = (& node.exe --version 2>$null).Trim()
$npmVersion = (& npm.cmd --version 2>$null).Trim()
$gitVersion = (& git.exe --version 2>$null).Trim()
$ffmpeg = Get-Command ffmpeg.exe -ErrorAction SilentlyContinue
$ffprobe = Get-Command ffprobe.exe -ErrorAction SilentlyContinue
if (Test-Path -LiteralPath $settingsPath -PathType Leaf) {
    $settings = Get-Content -LiteralPath $settingsPath -Raw | ConvertFrom-Json
    if (-not $ffmpeg -and $settings.PSObject.Properties.Name.Contains('ffmpegPath')) {
        $ffmpeg = Get-Item -LiteralPath ([string]$settings.ffmpegPath) -ErrorAction SilentlyContinue
    }
    if (-not $ffprobe -and $settings.PSObject.Properties.Name.Contains('ffprobePath')) {
        $ffprobe = Get-Item -LiteralPath ([string]$settings.ffprobePath) -ErrorAction SilentlyContinue
    }
}
$report = [ordered]@{
    checkedAt = (Get-Date).ToString('o')
    rootPath = $RootPath
    node24 = [bool]($nodeVersion -match '^v24\.')
    nodeVersion = $nodeVersion
    npmVersion = $npmVersion
    gitVersion = $gitVersion
    ffmpeg = [bool]$ffmpeg
    ffprobe = [bool]$ffprobe
    settings = (Test-Path -LiteralPath $settingsPath -PathType Leaf)
}
$reportPath = Join-Path $RootPath 'State\prerequisites.json'
New-Item -ItemType Directory -Path (Split-Path -Parent $reportPath) -Force | Out-Null
$report | ConvertTo-Json -Depth 4 | Set-Content -LiteralPath $reportPath -Encoding UTF8
$report | ConvertTo-Json -Depth 4 | Write-Host
if (-not $report.node24 -or -not $report.ffmpeg -or -not $report.ffprobe -or -not $report.settings) {
    exit 1
}
