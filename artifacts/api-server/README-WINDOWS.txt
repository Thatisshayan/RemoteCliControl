REMOTECTRL - WINDOWS QUICKSTART

Step 1: Double-click RemoteCTRL.exe
         -> First time: answer 3 quick questions (port, token, tunnel)
         -> A green icon appears in your system tray (bottom-right corner)

Step 2: Copy the tunnel URL shown on screen
         -> Paste it into the RemoteCTRL iOS app when prompted

Step 3: Done. The server runs in the background.
         Right-click the tray icon to restart, stop, or see the URL again.

OPTIONAL - Auto-start on Windows boot (even without logging in):
  1. Run RemoteCTRL.exe once and complete setup.
  2. Open PowerShell as Administrator in this extracted folder.
  3. Run:
     powershell -ExecutionPolicy Bypass -File .\installer\Install-RemoteCTRL.ps1
  RemoteCTRLServer.exe will now start automatically when Windows starts.
  The system-tray icon is available only when RemoteCTRL.exe is run in a user session.
  If Windows blocks the boot task, the installer falls back to the current user's
  Startup folder and starts the server after sign-in.

UNINSTALL:
  Open PowerShell as Administrator and run:
    powershell -ExecutionPolicy Bypass -File .\installer\Uninstall-RemoteCTRL.ps1
  Then delete this folder if it is no longer needed.

Release builds are Authenticode-signed. An unsigned local build may be blocked
by managed Windows Application Control policies; signing may also require the
publisher certificate to be allow-listed by the device administrator.
