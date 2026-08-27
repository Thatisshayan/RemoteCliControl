[CmdletBinding()]
param()

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"
$taskName = "RemoteCTRL Server"
$startupShortcut = Join-Path ([Environment]::GetFolderPath("Startup")) "RemoteCTRL Server.lnk"

try {
  & schtasks.exe /End /TN $taskName 2>$null
  & schtasks.exe /Delete /TN $taskName /F
  if ($LASTEXITCODE -eq 0) {
    Write-Host "RemoteCTRL boot startup has been removed."
    return
  }
}
catch {
}

if (Test-Path -LiteralPath $startupShortcut) {
  Remove-Item -LiteralPath $startupShortcut -Force
  Write-Host "RemoteCTRL sign-in startup has been removed."
  return
}

throw "Windows could not remove the RemoteCTRL startup task. Run this script in an elevated PowerShell window."
