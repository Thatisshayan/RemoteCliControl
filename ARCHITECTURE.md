# RemoteCTRL Architecture

## Overview

RemoteCTRL has three active layers:

1. `artifacts/api-server`
2. `lib/api-zod` and `lib/api-client-react`
3. `artifacts/mobile`

The current architecture treats the shared contract as authoritative, the server as the tunnel owner, and the mobile app as a runtime-configured client rather than an env-coupled one.

## Route Boundaries

### Public

- `/health`
- `/tunnel-url`
- `/version`
- `/api/setup/*`

### Authenticated

Everything else is mounted under `/api` behind bearer auth when `API_TOKEN` is set.

## Shared Contract

`lib/api-zod/src/schemas.ts` is the shared type layer used by:

- server request validation
- client response parsing
- mobile feature code

The current shared contract includes:

- auth-mode-aware connection input types
- redacted connection profile output types
- session rename input
- file path and rename payloads
- push preferences
- health and tunnel status responses

## Server Ownership Model

### HTTP server

`artifacts/api-server/src/index.ts` owns startup and shutdown order:

1. start Express
2. mount WebSocket handling
3. send startup push hook
4. start Cloudflare Tunnel if enabled

### Tunnel

`artifacts/api-server/src/lib/tunnel.ts` is the single tunnel owner.

`artifacts/api-server/src/tray.ts` does not spawn `cloudflared`. It only:

- starts/stops the server process
- polls `/health`
- polls `/tunnel-url`
- surfaces server state in the tray

### WebSocket auth

Terminal WebSocket auth uses `sec-websocket-protocol` only.

- accepted: subprotocol token
- rejected: query-string token transport

### Error shape

Server validation/auth/runtime failures now normalize to:

```json
{
  "error": "message",
  "code": "ERROR_CODE",
  "details": {}
}
```

## Connection Security

Connection persistence lives in `artifacts/api-server/src/lib/store.ts`.

There are two profile views:

- secret-bearing internal profile
- redacted safe profile for API responses

Connection endpoints never return plaintext:

- `password`
- `privateKey`
- `passphrase`

Instead they expose:

- `hasPassword`
- `hasPrivateKey`
- `hasPassphrase`

## Mobile Runtime Model

`artifacts/mobile/lib/runtime-config.tsx` now owns:

- current base URL
- API token
- hydration from local storage
- onboarding completion state
- propagation into the shared client

After onboarding, screens do not depend on `EXPO_PUBLIC_DOMAIN` for live routing. That env var is only a bootstrap fallback before stored runtime config exists.

### Feature routing

- terminal HTTP data uses shared client
- terminal WebSocket uses the saved runtime base URL
- files upload/download use the saved runtime base URL
- settings reads `/health` and `/tunnel-url` separately

## Current Product Truth

### Enabled

- onboarding
- connection profile management
- session create/rename/close
- live terminal
- files
- processes
- saved commands
- settings and server status

### Intentionally limited

- mobile push UI is marked unavailable during stabilization
- biometric toggle is stored as a preference only; full enforcement is not implemented

## Verification Baseline

Latest synced implementation verified on Friday, July 17, 2026:

- all edited TypeScript package configs compile
- API server Vitest suite passes (13 files, 55 tests), including an
  end-to-end happy-path smoke test that exercises the real Express app and
  WebSocket upgrade handler across connection, session, terminal, and files

See [docs/LATEST_IMPLEMENTATION_SYNC_2026-07-17.md](./docs/LATEST_IMPLEMENTATION_SYNC_2026-07-17.md) for the preservation record.
