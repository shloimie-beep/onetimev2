param(
    [Parameter(Mandatory = $true)]
    [ValidateSet('openai_api_key', 'vimeo_access_token', 'one_time_import_hmac_key')]
    [string]$Name,
    [string]$SettingsPath = "$env:USERPROFILE\OneTimeMedia\Config\settings.local.json"
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

if (-not (Test-Path -LiteralPath $SettingsPath -PathType Leaf)) {
    throw "Local media settings were not found: $SettingsPath"
}
$settings = Get-Content -LiteralPath $SettingsPath -Raw | ConvertFrom-Json
$secretDir = Join-Path ([string]$settings.rootPath) 'Config\secrets'
New-Item -ItemType Directory -Path $secretDir -Force | Out-Null
$secret = Read-Host "Enter $Name (input is hidden)" -AsSecureString
$encrypted = ConvertFrom-SecureString $secret
if ([string]::IsNullOrWhiteSpace($encrypted)) { throw 'The protected secret was empty.' }
$destination = Join-Path $secretDir "$Name.dpapi"
Set-Content -LiteralPath $destination -Value $encrypted -Encoding ASCII
Write-Host "Stored $Name using current-user Windows DPAPI protection."
