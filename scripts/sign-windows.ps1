[CmdletBinding()]
param(
  [string]$ReleaseDirectory = "artifacts/api-server/release",
  [string]$CertificatePath = $env:WINDOWS_SIGNING_PFX_PATH,
  [string]$CertificatePassword = $env:WINDOWS_SIGNING_PFX_PASSWORD,
  [string]$CertificateThumbprint = $env:WINDOWS_SIGNING_CERT_THUMBPRINT,
  [string]$TimestampUrl = "http://timestamp.digicert.com",
  [switch]$RequireSignature
)

$ErrorActionPreference = "Stop"
$releasePath = (Resolve-Path -LiteralPath $ReleaseDirectory).Path
$executables = @(Get-ChildItem -LiteralPath $releasePath -Filter "*.exe" -File)
if ($executables.Count -eq 0) { throw "No Windows executables found in $releasePath." }

$signToolCommand = Get-Command signtool.exe -ErrorAction SilentlyContinue
if (-not $signToolCommand) {
  $kitsRoot = Join-Path ${env:ProgramFiles(x86)} "Windows Kits\10\bin"
  $signToolCommand = Get-ChildItem -LiteralPath $kitsRoot -Filter signtool.exe -File -Recurse -ErrorAction SilentlyContinue |
    Sort-Object FullName -Descending | Select-Object -First 1
}
if (-not $signToolCommand) {
  if ($RequireSignature) { throw "signtool.exe was not found. Install the Windows SDK on the signing runner." }
  Write-Warning "signtool.exe was not found; leaving the local build unsigned."
  exit 0
}

if ($CertificatePath) {
  if (-not (Test-Path -LiteralPath $CertificatePath -PathType Leaf)) { throw "Signing certificate was not found at $CertificatePath." }
  if (-not $CertificatePassword) { throw "WINDOWS_SIGNING_PFX_PASSWORD is required when a PFX path is supplied." }
  $securePassword = ConvertTo-SecureString $CertificatePassword -AsPlainText -Force
  $certificate = Import-PfxCertificate -FilePath $CertificatePath -CertStoreLocation Cert:\CurrentUser\My -Password $securePassword
  $CertificateThumbprint = $certificate.Thumbprint
}
if (-not $CertificateThumbprint) {
  if ($RequireSignature) { throw "Provide a code-signing certificate through a PFX path or certificate thumbprint." }
  Write-Warning "No code-signing certificate was configured; leaving the local build unsigned."
  exit 0
}

$signToolPath = if ($signToolCommand.Source) { $signToolCommand.Source } else { $signToolCommand.FullName }
foreach ($executable in $executables) {
  & $signToolPath sign /fd SHA256 /sha1 $CertificateThumbprint /tr $TimestampUrl /td SHA256 $executable.FullName
  if ($LASTEXITCODE -ne 0) { throw "Signing failed for $($executable.Name)." }
  & $signToolPath verify /pa /all $executable.FullName
  if ($LASTEXITCODE -ne 0) { throw "Signature verification failed for $($executable.Name)." }
}
Write-Host "Signed and verified $($executables.Count) Windows executable(s)."
