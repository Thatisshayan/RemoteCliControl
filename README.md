# RemoteCTRL

A Windows-hosted remote control stack with an Express API server and an Expo mobile client for terminal, files, processes, commands, and connection management.

## Current State

- Authenticated business routes live under `/api/*`.
- Public status/setup routes are `/health`, `/tunnel-url`, `/version`, and `/api/setup/*`.
- The server is the only Cloudflare Tunnel owner.
- The mobile app uses a saved runtime base URL and token after onboarding.
- Push notification UI is intentionally disabled in the mobile app during stabilization.

## Quickstart

```bash
git clone https://github.com/Thatisshayan/RemoteCliControl.git
cd RemoteCliControl
pnpm install
cp .env.example .env
pnpm build:server
PORT=3000 node artifacts/api-server/dist/index.mjs
pnpm dev:mobile
```

On first launch, the mobile app asks for:
- the backend URL
- the API token, if your server uses one

## Environment

### Backend

| Variable | Required | Description |
|---|---|---|
| `PORT` | Yes | HTTP port for the API server |
| `API_TOKEN` | No | Enables bearer auth for `/api/*` and WebSocket terminal auth |
| `CLOUDFLARE_TUNNEL` | No | When `true`, the server starts and owns the tunnel |
| `TUNNEL_URL_PATH` | No | Override where the current tunnel URL is written |
| `MOBILE_MIN_VERSION` | No | Oldest mobile app version (semver) this server supports; surfaced via `GET /version` for Settings' compatibility banner |

### Mobile

| Variable | Required | Description |
|---|---|---|
| `EXPO_PUBLIC_DOMAIN` | No | Build-time fallback base URL before onboarding/runtime config exists |

`EXPO_PUBLIC_DOMAIN` is not the operational source of truth after onboarding. The saved runtime URL is.

## Scripts

```bash
pnpm dev:server
pnpm build:server
pnpm dev:mobile
pnpm typecheck
pnpm test
pnpm lint
pnpm build
```

## API Summary

### Public routes

- `GET /health`
- `GET /tunnel-url`
- `GET /version`
- `GET|POST /api/setup/*`

### Authenticated routes

- `GET|POST /api/connection`
- `POST /api/connection/test`
- `GET|POST /api/connections`
- `GET /api/connections/active`
- `DELETE /api/connections/:id`
- `POST /api/connections/:id/activate`
- `GET|POST /api/sessions`
- `PATCH|DELETE /api/sessions/:id`
- `GET|DELETE /api/files`
- `GET /api/files/read`
- `GET /api/files/download`
- `POST /api/files/upload`
- `POST /api/files/mkdir`
- `PATCH /api/files/rename`
- `GET /api/processes`
- `DELETE /api/processes/:pid`
- `GET|POST /api/commands`
- `DELETE /api/commands/:id`
- `POST /api/push/register`
- `GET /api/push/devices`
- `DELETE /api/push/device/:id`
- `GET|PUT /api/push/preferences`

### Connection contract

Saved/returned connection profiles are redacted. They expose:
- `id`
- `name`
- `host`
- `port`
- `username`
- `authMode`
- `hasPassword`
- `hasPrivateKey`
- `hasPassphrase`

They do not expose plaintext secrets.

## WebSocket Terminal

Terminal connections use:

```text
ws[s]://<host>/api/ws/terminal/<sessionId>
```

If `API_TOKEN` is set, the token must be sent in `sec-websocket-protocol`. Query-string token auth is no longer supported.

## Mobile Runtime Behavior

- Onboarding stores backend URL and token locally.
- Settings edits that same runtime config.
- Terminal, files, and shared HTTP client all read the same saved base URL.
- Tunnel status comes from `/tunnel-url`.
- Server health/version come from `/health` and `/version`.
- When enabled in Settings, biometric authentication locks the app on launch and after it returns from the background.
- The native splash remains visible while bundled fonts load; if font loading fails, the app continues with system font fallbacks instead of showing a blank screen.

## Tunnel Ownership

- `artifacts/api-server/src/index.ts` starts/stops the tunnel.
- `artifacts/api-server/src/tray.ts` supervises the server process and displays status only.
- The tray no longer spawns `cloudflared` directly.

### Persistent tunnel (optional)

By default `CLOUDFLARE_TUNNEL=true` starts an anonymous Cloudflare **quick tunnel** — free,
zero-config, but the `*.trycloudflare.com` URL is random and changes every server restart, so a
paired mobile client has to be manually re-pointed each time.

To get a stable hostname instead:

1. Create a tunnel in the [Cloudflare Zero Trust dashboard](https://one.dash.cloudflare.com/)
   (Networks → Tunnels → Create a tunnel). This requires a domain in your Cloudflare account.
2. Add a Public Hostname route pointing at `http://localhost:<PORT>`.
3. Copy the tunnel token from the dashboard.
4. Set `CLOUDFLARE_TUNNEL_TOKEN` and `CLOUDFLARE_TUNNEL_HOSTNAME` (the hostname from step 2) —
   either in the "Advanced" section of the first-run setup wizard (`RemoteCTRL.exe` → setup
   page), or directly in `data/config.json`.

When both are set, `startTunnel()` (`src/lib/tunnel.ts`) runs `cloudflared tunnel run --token
<token>` and reports the fixed hostname instead of parsing a random URL from `cloudflared`'s
output. If only one of the two is set, it logs a warning and falls back to the quick tunnel.

## Windows Desktop App

The Windows release contains two executables:

- `RemoteCTRL.exe` is the interactive tray app and first-run setup experience.
- `RemoteCTRLServer.exe` is the headless server used for Windows boot startup.

Run `RemoteCTRL.exe` once and complete setup before enabling startup. To start the
headless server at Windows boot, open an elevated PowerShell window in the
extracted release folder and run:

```powershell
powershell -ExecutionPolicy Bypass -File .\installer\Install-RemoteCTRL.ps1
```

If Windows blocks the system task, the installer falls back to a per-user Startup
shortcut and starts the server after sign-in.

To remove boot startup, run `Uninstall-RemoteCTRL.ps1` from the same directory.
No Node.js installation is required on the Windows machine.

Tagged Windows releases are Authenticode-signed in CI. The release workflow
requires the `WINDOWS_SIGNING_PFX_BASE64` and `WINDOWS_SIGNING_PFX_PASSWORD`
secrets; the certificate publisher must also be trusted by managed Windows
Application Control policies. Local builds can run unsigned when no certificate
is configured.

For local dev/test signing without a purchased certificate, run
`scripts/create-dev-signing-cert.ps1` to generate and locally trust a
self-signed code-signing certificate (current user only), then sign a build
with `scripts/sign-windows.ps1 -CertificateThumbprint <thumbprint> -RequireSignature`.
This validates the sign/verify pipeline and removes local "unknown publisher"
warnings on that machine, but a self-signed cert carries no public trust or
reputation — it must never be used to sign a real release.

## Verification

As of Friday, July 17, 2026, the latest stabilization pass was verified with:

```bash
node artifacts/mobile/node_modules/typescript/bin/tsc -p lib/api-zod/tsconfig.json --noEmit
node artifacts/mobile/node_modules/typescript/bin/tsc -p lib/api-client-react/tsconfig.json --noEmit
node artifacts/mobile/node_modules/typescript/bin/tsc -p artifacts/api-server/tsconfig.json --noEmit
node artifacts/mobile/node_modules/typescript/bin/tsc -p artifacts/mobile/tsconfig.json --noEmit
artifacts/api-server/node_modules/.bin/vitest.CMD run
```

The API server suite includes an end-to-end happy-path smoke test
(`artifacts/api-server/src/__tests__/smoke.e2e.test.ts`) that drives the real
Express app and WebSocket upgrade handler across connection setup, session
create/list/close, terminal WebSocket round-trip, and file listing, with
SSH/SFTP mocked only at the `sshManager` boundary.

The suite also includes a contract-drift guard
(`artifacts/api-server/src/__tests__/contract-snapshot.test.ts`) that checks
`lib/api-spec/openapi.yaml` against the shared zod schemas and against the
live route table, since nothing generates one from the other.

`sshManager.ts`'s `execCommand` keeps PowerShell's stdout and stderr
separate (`{ stdout, stderr, exitCode }`) rather than merging them, so
`GET /api/processes`'s `ConvertTo-Json` parsing can't be broken by unrelated
warnings on stderr, and `DELETE /api/processes/:pid` checks the exit code
instead of always reporting success. See
`artifacts/api-server/src/routes/__tests__/processes.test.ts`.

Every request gets a stable id: `app.ts` reuses an incoming `x-request-id`
header or mints a UUID, echoes it back as a response header, and every log
line for that request — including the global unhandled-error handler and
manual logs in `files.ts`/`processes.ts`/`push.ts` — goes through `req.log`
(a pino child logger bound with that id) instead of the bare logger. See
`artifacts/api-server/src/__tests__/request-id.test.ts`.

`GET /version` optionally includes `mobileMinVersion`, sourced from a
`MOBILE_MIN_VERSION` server env var (unset by default). See
`artifacts/api-server/src/routes/__tests__/version.test.ts`.

As of this pass: 19 test files, 142 tests, all passing.

The mobile app has its own Jest suite (`pnpm --filter @remotectrl/mobile test`,
included in `pnpm test` and CI's `test-mobile` job) using `jest-expo` and
`@testing-library/react-native`:

- `lib/__tests__/runtime-config.test.tsx` — config hydration from
  `AsyncStorage`/`expo-secure-store` and live backend URL/token switching,
  asserting the shared HTTP client (`@remotectrl/api-client-react`) is
  actually repointed, not just local component state.
- `lib/__tests__/terminal-ws.test.ts` — terminal WebSocket URL/subprotocol
  construction (`lib/terminal-ws.ts`); the API token is carried as the sole
  WebSocket subprotocol only when present.
- `lib/__tests__/connection-check.test.ts` — `checkConnection`, which
  onboarding and Settings both use to validate a server URL and API token
  together: `/health` for reachability, then a real authenticated route
  (`/api/connection`) so a rejected token is caught immediately instead of
  on the first live screen that needs it.
- `lib/__tests__/auth-expired.test.ts` — the pub/sub that detects
  `AUTH_REQUIRED`/`AUTH_INVALID` from any react-query call and notifies
  `RuntimeConfigProvider`, which flips an `authExpired` flag the root layout
  uses to redirect to Settings.
- `lib/__tests__/version-compat.test.ts` — `compareVersions`/
  `getVersionCompatibility` (`lib/version-compat.ts`), the lenient
  dotted-version comparison behind Settings' version-compatibility banner.
- `lib/__tests__/error-message.test.ts` — `getErrorMessage`/
  `isServerUnreachable` (`lib/error-message.ts`), which every screen now
  uses instead of showing a raw caught error's `.message` directly.
- `lib/__tests__/server-status.test.ts` — `useServerStatus`
  (`lib/server-status.ts`), the shared `/health` + `/tunnel-url` +
  `/version` polling hook behind Settings' server status card and
  unreachable-state detection.
- `lib/__tests__/sanitize-command.test.ts` — `sanitizeCommand`
  (`lib/sanitize-command.ts`), the terminal command sanitizer that strips
  ANSI escapes and enforces length/null-byte constraints without blocking
  legitimate shell input.

As of this pass: 9 test files, 75 tests, all passing.

CI's `windows-workspace` job runs `pnpm typecheck`, `pnpm test`, and
`pnpm build:server` on `windows-latest` on every push/PR — not just on
tagged releases — so the actual workspace script layer (not only the
`ubuntu-latest` jobs) is proven on Windows continuously.

## iOS Release Pipeline (No EAS)

iOS builds ship to TestFlight via a `macos-latest` GitHub Actions workflow
using `fastlane` + `match`, not EAS Build — EAS usage was exhausted, and this
path needs no local Mac. See
[docs/IOS_TESTFLIGHT_CI_MANUAL.md](./docs/IOS_TESTFLIGHT_CI_MANUAL.md) for
the full step-by-step manual. Quick version:

```bash
git tag ios-v1 && git push origin ios-v1
```

or run **Actions → iOS TestFlight → Run workflow** with `lane: beta`
manually. The Android/legacy iOS EAS workflow (`.github/workflows/eas-build.yml`)
is unchanged and still available if EAS usage is restored.

## Key Docs

- [ARCHITECTURE.md](./ARCHITECTURE.md)
- [CONTRIBUTING.md](./CONTRIBUTING.md)
- [AGENTS.md](./AGENTS.md)
- [docs/README.md](./docs/README.md)
- [docs/governance/REPO_RULES.md](./docs/governance/REPO_RULES.md)
- [docs/ROADMAP_NOW_NEXT_LATER_2026-07-17.md](./docs/ROADMAP_NOW_NEXT_LATER_2026-07-17.md)
- [artifacts/mobile/BUILDING.md](./artifacts/mobile/BUILDING.md)
- [docs/IOS_TESTFLIGHT_CI_MANUAL.md](./docs/IOS_TESTFLIGHT_CI_MANUAL.md)
- [docs/LATEST_IMPLEMENTATION_SYNC_2026-07-17.md](./docs/LATEST_IMPLEMENTATION_SYNC_2026-07-17.md)
- [docs/LATEST_IMPLEMENTATION_SYNC_2026-07-21.md](./docs/LATEST_IMPLEMENTATION_SYNC_2026-07-21.md)
