#Requires -RunAsAdministrator
<#
.SYNOPSIS
  Prepare a Windows PC for Green Pasture on-prem apps (hosts + trusted local CA).

.DESCRIPTION
  - Maps hris / csm / timekeep.greenpasture.com -> 10.0.0.110
  - Installs greenpasture-local-ca.crt into Local Machine Trusted Root

  Right-click install-office-client.cmd -> Run as administrator
  Or: powershell -ExecutionPolicy Bypass -File .\install-office-client.ps1
#>
[CmdletBinding()]
param(
  [string]$ServerIp = "10.0.0.110",
  [string]$CaPath = ""
)

$ErrorActionPreference = "Stop"

$Hosts = @(
  "hris.greenpasture.com",
  "csm.greenpasture.com",
  "timekeep.greenpasture.com"
)
$Marker = "Green Pasture on-prem"
$HostsFile = "$env:SystemRoot\System32\drivers\etc\hosts"

if (-not $CaPath) {
  $CaPath = Join-Path $PSScriptRoot "greenpasture-local-ca.crt"
}

Write-Host ""
Write-Host "Green Pasture office client setup" -ForegroundColor Green
Write-Host "  Server : $ServerIp"
Write-Host "  CA     : $CaPath"
Write-Host ""

if (-not (Test-Path -LiteralPath $CaPath)) {
  throw "CA file not found: $CaPath (keep greenpasture-local-ca.crt next to this script)"
}

# --- hosts ---
$line = "$ServerIp  $($Hosts -join ' ')  # $Marker"
$existing = Get-Content -LiteralPath $HostsFile -ErrorAction Stop

# Drop prior GP on-prem lines (marker or any of our hostnames)
$filtered = foreach ($row in $existing) {
  if ($row -match [regex]::Escape($Marker)) { continue }
  $drop = $false
  foreach ($h in $Hosts) {
    if ($row -match ("(?i)\b{0}\b" -f [regex]::Escape($h))) { $drop = $true; break }
  }
  if (-not $drop) { $row }
}

$filtered += $line
Set-Content -LiteralPath $HostsFile -Value $filtered -Encoding ASCII
Write-Host "[ok] hosts updated" -ForegroundColor Green
Write-Host "     $line"

# Flush DNS
ipconfig /flushdns | Out-Null
Write-Host "[ok] DNS cache flushed" -ForegroundColor Green

# --- trust CA ---
$cert = New-Object System.Security.Cryptography.X509Certificates.X509Certificate2((Resolve-Path -LiteralPath $CaPath))
$store = New-Object System.Security.Cryptography.X509Certificates.X509Store(
  [System.Security.Cryptography.X509Certificates.StoreName]::Root,
  [System.Security.Cryptography.X509Certificates.StoreLocation]::LocalMachine
)
$store.Open([System.Security.Cryptography.X509Certificates.OpenFlags]::ReadWrite)
# Remove older same-subject GP Local CA if present, then add
$thumb = $cert.Thumbprint
$removed = 0
foreach ($c in @($store.Certificates)) {
  if ($c.Subject -eq $cert.Subject -and $c.Thumbprint -ne $thumb) {
    $store.Remove($c)
    $removed++
  }
}
$already = $store.Certificates | Where-Object { $_.Thumbprint -eq $thumb }
if (-not $already) {
  $store.Add($cert)
  Write-Host "[ok] Trusted Root CA installed ($($cert.Subject))" -ForegroundColor Green
} else {
  Write-Host "[ok] Trusted Root CA already present ($thumb)" -ForegroundColor Green
}
if ($removed -gt 0) {
  Write-Host "[ok] Removed $removed older CA certificate(s)" -ForegroundColor Green
}
$store.Close()

Write-Host ""
Write-Host "Done. Close ALL browsers, then open:" -ForegroundColor Cyan
Write-Host "  https://hris.greenpasture.com"
Write-Host "  https://csm.greenpasture.com"
Write-Host "  https://timekeep.greenpasture.com"
Write-Host ""
Write-Host "Press Enter to exit..."
[void][System.Console]::ReadLine()
