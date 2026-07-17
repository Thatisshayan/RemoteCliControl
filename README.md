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

## Tunnel Ownership

- `artifacts/api-server/src/index.ts` starts/stops the tunnel.
- `artifacts/api-server/src/tray.ts` supervises the server process and displays status only.
- The tray no longer spawns `cloudflared` directly.

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

As of this pass: 15 test files, 109 tests, all passing.

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

As of this pass: 4 test files, 38 tests, all passing.

CI's `windows-workspace` job runs `pnpm typecheck`, `pnpm test`, and
`pnpm build:server` on `windows-latest` on every push/PR — not just on
tagged releases — so the actual workspace script layer (not only the
`ubuntu-latest` jobs) is proven on Windows continuously.

## Key Docs

- [ARCHITECTURE.md](./ARCHITECTURE.md)
- [CONTRIBUTING.md](./CONTRIBUTING.md)
- [AGENTS.md](./AGENTS.md)
- [docs/README.md](./docs/README.md)
- [docs/governance/REPO_RULES.md](./docs/governance/REPO_RULES.md)
- [docs/ROADMAP_NOW_NEXT_LATER_2026-07-17.md](./docs/ROADMAP_NOW_NEXT_LATER_2026-07-17.md)
- [artifacts/mobile/BUILDING.md](./artifacts/mobile/BUILDING.md)
- [docs/LATEST_IMPLEMENTATION_SYNC_2026-07-17.md](./docs/LATEST_IMPLEMENTATION_SYNC_2026-07-17.md)
