param([switch]$ValidateOnly)
$ErrorActionPreference = 'Stop'
$manifest = Get-Content -LiteralPath (Join-Path $PSScriptRoot 'release.json') -Raw | ConvertFrom-Json
if ($manifest.rom.file -ne 'Pokemon-Kanto.gbc') { throw 'Unexpected ROM filename in release manifest.' }
$rom = Join-Path $PSScriptRoot $manifest.rom.file
if (-not (Test-Path -LiteralPath $rom -PathType Leaf)) { throw 'Extract the complete release ZIP before running this assistant.' }
$file = Get-Item -LiteralPath $rom
$digest = (Get-FileHash -LiteralPath $rom -Algorithm SHA256).Hash.ToLowerInvariant()
if ($file.Length -ne $manifest.rom.sizeBytes -or $digest -ne $manifest.rom.sha256) { throw 'ROM verification failed. Download a fresh release ZIP.' }
Write-Host ('Verified Pokemon Kanto ' + $manifest.version)
Write-Host ('ROM: ' + $rom)
Write-Host ('SHA256: ' + $digest)
Write-Host 'This assistant verifies the download and opens the installation guide.'
Write-Host 'It does NOT write a cartridge, install drivers, or change firmware.'
if (-not $ValidateOnly) {
  Start-Process -FilePath (Join-Path $PSScriptRoot 'INSTALL.html')
  Read-Host 'Press Enter to close'
}
