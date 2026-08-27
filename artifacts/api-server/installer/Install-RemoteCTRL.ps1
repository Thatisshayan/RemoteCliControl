[CmdletBinding()]
param(
  [string]$InstallRoot = (Split-Path -Parent $PSScriptRoot)
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$serverPath = Join-Path $InstallRoot "RemoteCTRLServer.exe"
$configPath = Join-Path $InstallRoot "data\config.json"
$taskName = "RemoteCTRL Server"
$startupShortcut = Join-Path ([Environment]::GetFolderPath("Startup")) "RemoteCTRL Server.lnk"

function Install-StartupShortcut {
  param(
    [string]$TargetPath,
    [string]$WorkingDirectory,
    [string]$ShortcutPath
  )

  $shell = New-Object -ComObject WScript.Shell
  $shortcut = $shell.CreateShortcut($ShortcutPath)
  $shortcut.TargetPath = $TargetPath
  $shortcut.WorkingDirectory = $WorkingDirectory
  $shortcut.WindowStyle = 7
  $shortcut.Save()
}

if (-not (Test-Path -LiteralPath $serverPath -PathType Leaf)) {
  throw "RemoteCTRLServer.exe was not found in $InstallRoot. Extract the complete release ZIP before installing startup."
}

if (-not (Test-Path -LiteralPath $configPath -PathType Leaf)) {
  throw "Configure RemoteCTRL by running RemoteCTRL.exe once before enabling boot startup."
}

try {
  & schtasks.exe /Create /TN $taskName /TR ('"{0}"' -f $serverPath) /SC ONSTART /RU SYSTEM /RL HIGHEST /F
  if ($LASTEXITCODE -ne 0) {
    throw "Windows could not create the RemoteCTRL startup task (exit code $LASTEXITCODE)."
  }

  & schtasks.exe /Run /TN $taskName
  if ($LASTEXITCODE -ne 0) {
    throw "Windows created the startup task but could not start it (exit code $LASTEXITCODE)."
  }

  Write-Host "RemoteCTRL will now start at Windows boot as '$taskName'."
}
catch {
  Install-StartupShortcut -TargetPath $serverPath -WorkingDirectory $InstallRoot -ShortcutPath $startupShortcut
  Start-Process -FilePath $serverPath -WorkingDirectory $InstallRoot -WindowStyle Hidden
  Write-Warning "Windows could not create the boot task, so RemoteCTRL was installed for the current user instead."
  Write-Host "RemoteCTRL will now start when you sign in as the current user."
}
