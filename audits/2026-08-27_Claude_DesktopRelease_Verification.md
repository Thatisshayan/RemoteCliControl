# Desktop Release Verification & Follow-up Fixes

Date: 2026-08-27
Agent: Claude (Sonnet 5)
Scope: Follow-up to `audits/2026-08-27_Codex_DesktopSigning_Audit.md`. Verifies the desktop
release actually works end-to-end on this workstation, fixes two CI-breaking bugs and two
security findings surfaced during PR review, and confirms mobile pairing over SSH key auth.

## What was verified true, on this machine

- Unsigned `RemoteCTRL.exe` / `RemoteCTRLServer.exe` launch and run without any Windows block
  on this workstation (Windows 11 Home, workgroup-joined, not domain-managed — the earlier
  "Application Control blocks it" finding did not reproduce here; there was no Mark-of-the-Web
  on the built exe).
- `scripts/create-dev-signing-cert.ps1` + `scripts/sign-windows.ps1` sign and `signtool verify`
  both executables successfully end-to-end with a locally-trusted, free self-signed cert.
- `cloudflared.exe` auto-download in `build.mjs` downloads, SHA-256-verifies, and skips
  re-download on a second build.
- `RemoteCTRLServer.exe` started with the downloaded `cloudflared.exe` present produced a live
  tunnel; `GET /health` returned `200 {"status":"ok",...}` through the public
  `*.trycloudflare.com` URL.
- SSH key-based auth to this machine's admin account was set up (RSA 4096, PEM format,
  installed into `%ProgramData%\ssh\administrators_authorized_keys` with a locked-down ACL as
  required by this account's `Match Group administrators` sshd_config rule) and confirmed
  working with a real `ssh -i <key> agentdev@localhost "whoami"` connection.
- PR #3 (`fix/desktop-service-release` → `main`, merged as `3dd5fcc`) has all native CI green:
  build, lint, typecheck, 143 tests, CodeQL, Windows workspace check.

## Bugs found and fixed during this pass

- `build.mjs` called `powershell.exe` unconditionally to generate the tray icon, crashing the
  build on Linux CI runners (`ENOENT`) and on a fresh Windows runner (`DirectoryNotFoundException`,
  `release/` didn't exist yet). Now gated on `process.platform === "win32"` with the target
  directory created first.
- `Install-RemoteCTRL.ps1` registered a SYSTEM-run scheduled task pointing directly at the
  extracted release folder's exe — a normal user-writable location. Any local user or malware
  able to write there could replace the exe and have it run as SYSTEM on next boot. Fixed by
  copying the runtime into an ACL-locked `%ProgramData%\RemoteCTRL` directory (SYSTEM +
  Administrators: full control, Users: read/execute only) before registering the task.
- `ci.yml`'s Windows release job interpolated `${{ github.ref_name }}` directly into a
  PowerShell `run:` block — GitHub's documented script-injection pattern for
  attacker-influenced ref names. Passed through `env:` instead.
- `tray.ts` resolved the packaged tray icon path via `process.cwd()`, which is not guaranteed
  to equal the exe's own directory depending on how it's launched. Now uses
  `path.dirname(process.execPath)`.

## What is NOT verified and should not be assumed true

- No purchased, publicly-trusted code-signing certificate exists. Tagging a `v*` release today
  will make the `windows-release` CI job **fail outright** (it calls `sign-windows.ps1
  -RequireSignature` unconditionally; with no cert secrets configured, that throws rather than
  falling back to unsigned). This is a change from the pre-existing assumption that local builds
  "gracefully" run unsigned — that's true locally, not true for the tagged-release CI path.
- No genuinely clean, non-developer Windows machine has been used for install/uninstall or
  boot-startup validation — everything above ran on the author's own dev workstation, which
  already has Node, pnpm, PowerShell 7, and OpenSSH Server present.
- The iOS app itself was not built or run on a device/simulator this session. The Connection
  screen's expected inputs were confirmed by reading `ConnectionView.swift`, and the SSH
  credentials were proven to work via a raw `ssh` command from this machine — but the actual
  in-app "Test Connection" tap and the Terminal/Files/Processes tabs have not been exercised.
- The Cloudflare tunnel used is an anonymous "quick tunnel" — its URL is random and changes on
  every server restart, with no mechanism to notify already-paired devices of the new URL.

## Verification commands run

```
pnpm --filter @remotectrl/api-server typecheck   # pass
pnpm --filter @remotectrl/api-server test         # 143 passed
node build.mjs                                     # cloudflared downloaded + verified
scripts/sign-windows.ps1 -RequireSignature          # both exes signed + verified (dev cert)
curl https://<tunnel>.trycloudflare.com/health      # 200 ok
ssh -i <key> agentdev@localhost whoami              # shayan\agentdev
```
