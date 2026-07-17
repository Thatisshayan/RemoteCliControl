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
live route table, since nothing generates one from the other. As of this
pass: 14 test files, 102 tests, all passing.

The mobile app has its own Jest suite (`pnpm --filter @remotectrl/mobile test`,
included in `pnpm test` and CI's `test-mobile` job) using `jest-expo` and
`@testing-library/react-native`. `artifacts/mobile/lib/__tests__/runtime-config.test.tsx`
covers config hydration from `AsyncStorage`/`expo-secure-store` and live
backend URL/token switching, asserting the shared HTTP client
(`@remotectrl/api-client-react`) is actually repointed, not just local
component state. As of this pass: 1 test file, 9 tests, all passing.

## Key Docs

- [ARCHITECTURE.md](./ARCHITECTURE.md)
- [CONTRIBUTING.md](./CONTRIBUTING.md)
- [AGENTS.md](./AGENTS.md)
- [docs/README.md](./docs/README.md)
- [docs/governance/REPO_RULES.md](./docs/governance/REPO_RULES.md)
- [docs/ROADMAP_NOW_NEXT_LATER_2026-07-17.md](./docs/ROADMAP_NOW_NEXT_LATER_2026-07-17.md)
- [artifacts/mobile/BUILDING.md](./artifacts/mobile/BUILDING.md)
- [docs/LATEST_IMPLEMENTATION_SYNC_2026-07-17.md](./docs/LATEST_IMPLEMENTATION_SYNC_2026-07-17.md)
