[CmdletBinding()]
param()

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"
$taskName = "RemoteCTRL Server"
$startupShortcut = Join-Path ([Environment]::GetFolderPath("Startup")) "RemoteCTRL Server.lnk"
$protectedRoot = Join-Path $env:ProgramData "RemoteCTRL"

$taskRemoved = $false
try {
  & schtasks.exe /End /TN $taskName 2>$null
  & schtasks.exe /Delete /TN $taskName /F
  $taskRemoved = ($LASTEXITCODE -eq 0)
}
catch {
}

$shortcutRemoved = $false
if (Test-Path -LiteralPath $startupShortcut) {
  Remove-Item -LiteralPath $startupShortcut -Force
  $shortcutRemoved = $true
}

if (Test-Path -LiteralPath $protectedRoot) {
  Remove-Item -LiteralPath $protectedRoot -Recurse -Force
}

if ($taskRemoved) { Write-Host "RemoteCTRL boot startup has been removed." }
if ($shortcutRemoved) { Write-Host "RemoteCTRL sign-in startup has been removed." }
if (-not $taskRemoved -and -not $shortcutRemoved) {
  throw "Windows could not remove the RemoteCTRL startup task. Run this script in an elevated PowerShell window."
}
