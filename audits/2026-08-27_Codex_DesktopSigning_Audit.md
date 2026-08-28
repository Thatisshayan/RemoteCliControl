# Windows Desktop Signing Audit

Date: 2026-08-27
Agent: Codex
Scope: Windows desktop packaging, signing, startup, and tray launch

## Findings

- The desktop bundle produces separate tray and headless server executables.
- The server executable starts successfully and responds to `/health` on port 3000.
- The tray executable is unsigned on this workstation and is blocked by the local Windows Application Control policy.
- No local code-signing certificate or `signtool.exe` is available.
- The release workflow now imports a protected PFX secret, signs all release executables with SHA-256 and a timestamp, and verifies each signature.

## Verification

- `pnpm --filter @remotectrl/api-server typecheck` passed.
- `pnpm --filter @remotectrl/api-server test` passed: 143 tests.
- `pnpm --filter @remotectrl/api-server bundle:windows` passed after stopping the running server process.
- The rebuilt `RemoteCTRLServer.exe` returned a healthy `/health` response.
- Local signing correctly reported that no certificate was configured and left the build unsigned.

## Residual Risk

Signing is necessary but may not be sufficient for a managed device. The publisher certificate must be trusted or allow-listed by the device's Application Control policy. A launcher cannot safely bypass that policy.
