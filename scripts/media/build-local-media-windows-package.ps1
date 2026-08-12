param(
    [Parameter(Mandatory = $true)]
    [string]$OutputRoot,
    [Parameter(Mandatory = $true)]
    [string]$PackageName
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$repositoryRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..\..'))
$templateRoot = Join-Path $PSScriptRoot 'windows-package'
$outputRootPath = [IO.Path]::GetFullPath($OutputRoot)
$packageDirectory = Join-Path $outputRootPath $PackageName
$zipPath = Join-Path $outputRootPath ($PackageName + '.zip')
if (Test-Path -LiteralPath $packageDirectory) { throw "Package directory already exists: $packageDirectory" }
if (Test-Path -LiteralPath $zipPath) { throw "Package ZIP already exists: $zipPath" }
New-Item -ItemType Directory -Path $outputRootPath -Force | Out-Null
New-Item -ItemType Directory -Path $packageDirectory | Out-Null

Get-ChildItem -LiteralPath $templateRoot -File | ForEach-Object {
    Copy-Item -LiteralPath $_.FullName -Destination (Join-Path $packageDirectory $_.Name)
}

$esbuild = Join-Path $repositoryRoot 'node_modules\.bin\esbuild.cmd'
if (-not (Test-Path -LiteralPath $esbuild -PathType Leaf)) {
    throw 'Local repository dependencies are missing; run npm ci before building the package.'
}
$runnerSource = Join-Path $PSScriptRoot 'local-media-runner.ts'
$runnerOutput = Join-Path $packageDirectory 'OneTimeLocalMediaRunner.mjs'
& $esbuild $runnerSource --bundle --platform=node --format=esm --target=node24 "--outfile=$runnerOutput"
if ($LASTEXITCODE -ne 0) { throw 'The local media runner bundle failed.' }

$sourceCommit = (& git -C $repositoryRoot rev-parse HEAD).Trim()
if ($LASTEXITCODE -ne 0 -or $sourceCommit -notmatch '^[a-f0-9]{40}$') {
    throw 'Unable to resolve the exact repository source commit.'
}
$utf8 = New-Object Text.UTF8Encoding($false)
$generatedAt = (Get-Date).ToUniversalTime().ToString('o')
$manifestPath = Join-Path $packageDirectory 'MANIFEST.json'
$selfBytes = 0
$manifestBytes = $null
for ($attempt = 0; $attempt -lt 10; $attempt += 1) {
    $entries = @(Get-ChildItem -LiteralPath $packageDirectory -File | Sort-Object Name | ForEach-Object {
        [ordered]@{
            path = $_.Name
            bytes = $_.Length
            sha256 = (Get-FileHash -LiteralPath $_.FullName -Algorithm SHA256).Hash.ToLowerInvariant()
            integrity = 'sha256'
        }
    })
    $entries += [ordered]@{
        path = 'MANIFEST.json'
        bytes = $selfBytes
        sha256 = $null
        integrity = 'self_inventory'
    }
    $entries = @($entries | Sort-Object path)
    $manifest = [ordered]@{
        schemaVersion = 3
        sourceCommit = $sourceCommit
        generatedAt = $generatedAt
        externalCallsAvailable = $false
        files = $entries
    }
    $manifestBytes = $utf8.GetBytes(($manifest | ConvertTo-Json -Depth 8) + "`n")
    if ($manifestBytes.Length -eq $selfBytes) { break }
    $selfBytes = $manifestBytes.Length
}
if ($manifestBytes.Length -ne $selfBytes) { throw 'Manifest self-inventory length did not stabilize.' }
[IO.File]::WriteAllBytes($manifestPath, $manifestBytes)

& (Join-Path $packageDirectory 'Test-MediaPackageManifest.ps1')
if ($LASTEXITCODE -ne 0) { throw 'The generated package manifest failed verification.' }
Compress-Archive -LiteralPath $packageDirectory -DestinationPath $zipPath -CompressionLevel Optimal

$zipHash = (Get-FileHash -LiteralPath $zipPath -Algorithm SHA256).Hash.ToUpperInvariant()
Write-Output ([ordered]@{
    packageDirectory = $packageDirectory
    zipPath = $zipPath
    zipSha256 = $zipHash
    sourceCommit = $sourceCommit
} | ConvertTo-Json -Compress)
