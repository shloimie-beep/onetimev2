Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$manifestPath = Join-Path $PSScriptRoot 'MANIFEST.json'
$manifest = Get-Content -LiteralPath $manifestPath -Raw | ConvertFrom-Json
$actualFiles = @(Get-ChildItem -LiteralPath $PSScriptRoot -File -Recurse | ForEach-Object {
    $_.FullName.Substring($PSScriptRoot.Length + 1).Replace('\', '/')
} | Sort-Object)
$manifestFiles = @($manifest.files.path | Sort-Object)
if (Compare-Object $actualFiles $manifestFiles) {
    throw 'Package manifest does not enumerate exactly every packaged file.'
}

foreach ($entry in $manifest.files) {
    $filePath = Join-Path $PSScriptRoot $entry.path
    $item = Get-Item -LiteralPath $filePath
    if ($entry.path -eq 'MANIFEST.json') {
        if ($entry.integrity -ne 'self_inventory' -or $item.Length -ne $entry.bytes) {
            throw 'Manifest self-inventory metadata is invalid.'
        }
        continue
    }
    $hash = (Get-FileHash -LiteralPath $filePath -Algorithm SHA256).Hash.ToLowerInvariant()
    if ($item.Length -ne $entry.bytes -or $hash -ne $entry.sha256) {
        throw "Package integrity mismatch: $($entry.path)"
    }
}

Write-Host "Package manifest verified: $($manifest.files.Count) files."
