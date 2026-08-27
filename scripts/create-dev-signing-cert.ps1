[CmdletBinding()]
param(
  [string]$Subject = "CN=RemoteCTRL Dev",
  [int]$ValidYears = 3
)

$ErrorActionPreference = "Stop"

Write-Warning "This creates a SELF-SIGNED certificate for LOCAL DEV/TEST use only."
Write-Warning "It is trusted only on this machine, for the current user. It must never be used for a public release build."

$cert = New-SelfSignedCertificate -Type CodeSigningCert -Subject $Subject `
  -CertStoreLocation Cert:\CurrentUser\My -KeyExportPolicy Exportable `
  -KeyUsage DigitalSignature -KeyAlgorithm RSA -KeyLength 2048 `
  -NotAfter (Get-Date).AddYears($ValidYears)

foreach ($storeName in @("Root", "TrustedPublisher")) {
  $store = New-Object System.Security.Cryptography.X509Certificates.X509Store($storeName, "CurrentUser")
  $store.Open("ReadWrite")
  $store.Add($cert)
  $store.Close()
}

Write-Host "Created and trusted dev signing certificate."
Write-Host "Thumbprint: $($cert.Thumbprint)"
Write-Host ""
Write-Host "To sign a local build with it:"
Write-Host "  .\scripts\sign-windows.ps1 -CertificateThumbprint `"$($cert.Thumbprint)`" -RequireSignature"
