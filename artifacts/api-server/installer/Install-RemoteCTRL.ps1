[CmdletBinding()]
param(
  [string]$InstallRoot = (Split-Path -Parent $PSScriptRoot)
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$sourceServerPath = Join-Path $InstallRoot "RemoteCTRLServer.exe"
$configPath = Join-Path $InstallRoot "data\config.json"
$taskName = "RemoteCTRL Server"
$startupShortcut = Join-Path ([Environment]::GetFolderPath("Startup")) "RemoteCTRL Server.lnk"

# SYSTEM-run executables must live in a directory standard users cannot write to,
# otherwise anyone with access to $InstallRoot could replace the exe and have it
# run as SYSTEM on the next boot. ProgramData is writable by default, so lock it
# down explicitly rather than relying on ambient ACLs.
$protectedRoot = Join-Path $env:ProgramData "RemoteCTRL"
$protectedServerPath = Join-Path $protectedRoot "RemoteCTRLServer.exe"

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

function Remove-StartupShortcut {
  if (Test-Path -LiteralPath $startupShortcut) {
    Remove-Item -LiteralPath $startupShortcut -Force
  }
}

function Protect-InstallDirectory {
  param([string]$Path)

  New-Item -ItemType Directory -Force -Path $Path | Out-Null

  $acl = Get-Acl -LiteralPath $Path
  $acl.SetAccessRuleProtection($true, $false)
  $acl.Access | ForEach-Object { $acl.RemoveAccessRule($_) | Out-Null }

  $rules = @(
    New-Object System.Security.AccessControl.FileSystemAccessRule("SYSTEM", "FullControl", "ContainerInherit,ObjectInherit", "None", "Allow"),
    New-Object System.Security.AccessControl.FileSystemAccessRule("Administrators", "FullControl", "ContainerInherit,ObjectInherit", "None", "Allow"),
    New-Object System.Security.AccessControl.FileSystemAccessRule("Users", "ReadAndExecute", "ContainerInherit,ObjectInherit", "None", "Allow")
  )
  foreach ($rule in $rules) { $acl.AddAccessRule($rule) }
  Set-Acl -LiteralPath $Path -AclObject $acl
}

if (-not (Test-Path -LiteralPath $sourceServerPath -PathType Leaf)) {
  throw "RemoteCTRLServer.exe was not found in $InstallRoot. Extract the complete release ZIP before installing startup."
}

if (-not (Test-Path -LiteralPath $configPath -PathType Leaf)) {
  throw "Configure RemoteCTRL by running RemoteCTRL.exe once before enabling boot startup."
}

try {
  Protect-InstallDirectory -Path $protectedRoot
  Copy-Item -LiteralPath $sourceServerPath -Destination $protectedServerPath -Force
  $cloudflaredSource = Join-Path $InstallRoot "cloudflared.exe"
  if (Test-Path -LiteralPath $cloudflaredSource -PathType Leaf) {
    Copy-Item -LiteralPath $cloudflaredSource -Destination (Join-Path $protectedRoot "cloudflared.exe") -Force
  }
  Copy-Item -LiteralPath (Join-Path $InstallRoot "data") -Destination (Join-Path $protectedRoot "data") -Recurse -Force

  try {
    & schtasks.exe /Create /TN $taskName /TR ('"{0}"' -f $protectedServerPath) /SC ONSTART /RU SYSTEM /RL HIGHEST /F
    if ($LASTEXITCODE -ne 0) {
      throw "Windows could not create the RemoteCTRL startup task (exit code $LASTEXITCODE)."
    }

    & schtasks.exe /Run /TN $taskName
    if ($LASTEXITCODE -ne 0) {
      throw "Windows created the startup task but could not start it (exit code $LASTEXITCODE)."
    }

    # A prior failed attempt may have left the per-user fallback in place; the
    # SYSTEM task now owns startup, so remove it to avoid running two copies.
    Remove-StartupShortcut
    Write-Host "RemoteCTRL will now start at Windows boot as '$taskName'."
  }
  catch {
    & schtasks.exe /Delete /TN $taskName /F 2>$null
    Install-StartupShortcut -TargetPath $protectedServerPath -WorkingDirectory $protectedRoot -ShortcutPath $startupShortcut
    Start-Process -FilePath $protectedServerPath -WorkingDirectory $protectedRoot -WindowStyle Hidden
    Write-Warning "Windows could not create the boot task, so RemoteCTRL was installed for the current user instead."
    Write-Host "RemoteCTRL will now start when you sign in as the current user."
  }
}
catch {
  throw "RemoteCTRL installation failed: $($_.Exception.Message)"
}
