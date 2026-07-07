# RemoteCTRL — Architecture

## System Overview

RemoteCTRL is a full-stack mobile SSH control application. A Node.js backend runs on the Windows machine being controlled; a React Native mobile app connects to it over HTTP/WebSocket. The backend relays commands to the Windows machine via SSH (localhost or loopback).

```
┌──────────────────────────────────────────────────────────────────┐
│  Phone (iOS App Store / EAS Build)                               │
│                                                                  │
│  ┌─────────┐  ┌─────────┐  ┌───────────┐  ┌────────┐  ┌──────┐│
│  │Terminal │  │  Files  │  │ Processes │  │Commands│  │Settings│
│  │  tab    │  │   tab   │  │    tab    │  │  tab   │  │  tab  ││
│  └────┬────┘  └────┬────┘  └─────┬─────┘  └───┬────┘  └──┬───┘│
│       │            │             │             │           │     │
│  ┌────▼────────────▼─────────────▼─────────────▼───────────▼───┐│
│  │         React Query hooks  (@remotectrl/api-client-react)   ││
│  └────────────────────────────┬────────────────────────────────┘│
│                               │                                  │
│  ┌────────────────────────────▼────────────────────────────┐    │
│  │  expo-notifications ← Expo Push API  (DISABLED — see note) │  │
│  │  Session disconnect / server health alerts              │    │
│  └────────────────────────────┬────────────────────────────┘    │
└───────────────────────────────│──────────────────────────────────┘
                                │ HTTP/REST + WebSocket
                                │ (EXPO_PUBLIC_DOMAIN via Cloudflare Tunnel)
┌───────────────────────────────▼──────────────────────────────────┐
│  Windows PC — api-server (Node.js 20, Express 5)                │
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │  app.ts — middleware stack                               │   │
│  │  cors → json(1mb) → pino-http → connectionLimiter →     │   │
│  │  generalLimiter → authMiddleware → routes                │   │
│  └──────────────────────┬───────────────────────────────────┘   │
│                         │                                        │
│  ┌──────────┐  ┌────────▼──────┐  ┌─────────────────────────┐  │
│  │ /health  │  │  REST routes  │  │  WebSocket (ws)         │  │
│  │ (no auth)│  │  /api/*       │  │  /api/ws/terminal/:id   │  │
│  └──────────┘  └───────┬───────┘  └──────────┬──────────────┘  │
│                         │                     │                  │
│  ┌──────────────────────▼─────────────────────▼──────────────┐  │
│  │                   sshManager.ts                           │  │
│  │  • ActiveSession map (shell streams)                      │  │
│  │  • utilityClient (pooled exec/SFTP connection)            │  │
│  │  • createSession / closeSession / sendToSession           │  │
│  │  • resizeSession (shell.setWindow)                        │  │
│  │  • execCommand / getSftp / testConnection                 │  │
│  │  • markUserInitiatedClose (for push notifications)        │  │
│  └──────────────────────────┬───────────────────────────────┘  │
│                              │ ssh2                              │
│  ┌───────────────────────────▼──────────────────────────────┐   │
│  │  Windows OpenSSH Server (localhost:22)                   │   │
│  └──────────────────────────────────────────────────────────┘   │
│                                                                  │
│  ┌─────────────────┐  ┌─────────────────────────────────────┐   │
│  │   store.ts      │  │   pushNotifications.ts              │   │
│  │   data/store.json│  │   expo-server-sdk                  │   │
│  │   connections[] │  │   sendPushToAllDevices()            │   │
│  │   commands[]    │  │   notifySessionDisconnected()       │   │
│  │   pushDevices[] │  │   notifyServerStarted()             │   │
│  │   prefs{}       │  └─────────────────────────────────────┘   │
│  └─────────────────┘                                            │
│                                                                  │
│  ┌─────────────────┐  ┌─────────────────────────────────────┐   │
│  │   tunnel.ts     │  │   tray.ts                           │   │
│  │   Cloudflare    │  │   systray2                          │   │
│  │   Tunnel mgmt   │  │   System tray icon + menu           │   │
│  └─────────────────┘  └─────────────────────────────────────┘   │
└──────────────────────────────────────────────────────────────────┘
```

---

## Monorepo Layout

```
/
├── artifacts/
│   ├── api-server/               ← Express 5 backend
│   │   ├── src/
│   │   │   ├── index.ts          ← Entry: requires PORT, starts HTTP + WS
│   │   │   ├── tray.ts           ← System tray (systray2, spawns server)
│   │   │   ├── app.ts            ← Express app factory
│   │   │   ├── lib/
│   │   │   │   ├── sshManager.ts ← SSH lifecycle + connection pool
│   │   │   │   ├── wsHandler.ts  ← WebSocket relay + heartbeat
│   │   │   │   ├── store.ts      ← JSON file persistence (connections, commands, push devices)
│   │   │   │   ├── auth.ts       ← Bearer token middleware
│   │   │   │   ├── tunnel.ts     ← Cloudflare Tunnel lifecycle
│   │   │   │   ├── config.ts     ← data/config.json schema
│   │   │   │   ├── logger.ts     ← Pino with credential redaction
│   │   │   │   └── pushNotifications.ts ← Expo push send utility
│   │   │   └── routes/
│   │   │       ├── health.ts     ← GET /health (auth-exempt)
│   │   │       ├── connection.ts ← Single-profile + multi-profile endpoints
│   │   │       ├── sessions.ts   ← SSH session CRUD + rename
│   │   │       ├── files.ts      ← SFTP operations (18 ops)
│   │   │       ├── processes.ts  ← PowerShell process manager
│   │   │       ├── commands.ts   ← Saved command library
│   │   │       └── push.ts       ← Push token registration + preferences
│   │   ├── src/__tests__/        ← Integration tests
│   │   ├── src/lib/__tests__/    ← Unit tests (store, auth, push)
│   │   ├── src/routes/__tests__/ ← Route validation tests
│   │   ├── installer/            ← Windows Service scripts
│   │   ├── Dockerfile            ← Multi-stage build
│   │   ├── build.mjs             ← esbuild config (index.mjs + tray.mjs)
│   │   └── vitest.config.ts
│   └── mobile/                   ← Expo SDK 52 React Native
│       ├── app/
│       │   ├── _layout.tsx       ← Root: QueryClient, ErrorBoundary, push notifications
│       │   ├── connection.tsx    ← SSH profile manager (list + form)
│       │   ├── session/
│       │   │   └── [sessionId].tsx ← Full-screen terminal
│       │   ├── onboarding/       ← 3-step setup wizard
│       │   │   ├── index.tsx     ← Welcome
│       │   │   ├── step2.tsx     ← Backend URL
│       │   │   └── step3.tsx     ← API Token
│       │   └── (tabs)/
│       │       ├── _layout.tsx   ← 5-tab bar
│       │       ├── terminal.tsx  ← Session list (5s auto-refresh)
│       │       ├── files.tsx     ← SFTP file browser
│       │       ├── processes.tsx ← Process manager + search
│       │       ├── commands.tsx  ← Saved commands + send-to-session
│       │       └── settings.tsx  ← Connection, security, push, terminal, server status
│       ├── components/ui/        ← Shared component library
│       │   ├── Card.tsx
│       │   ├── Badge.tsx
│       │   ├── ActionSheet.tsx
│       │   ├── SearchBar.tsx
│       │   ├── EmptyState.tsx
│       │   └── LoadingState.tsx
│       ├── lib/
│       │   └── notifications.ts  ← Push token registration + handler
│       ├── scripts/
│       │   └── generate-icons.mjs ← Icon generation from SVG
│       └── components/
│           └── ErrorBoundary.tsx ← Per-tab crash recovery
├── app-store/
│   ├── metadata.json            ← App Store listing content
│   └── README.md                ← Submission guide
├── docs/
│   ├── privacy-policy.html      ← Privacy policy page
│   └── support.html             ← Support page
├── lib/
│   ├── api-spec/openapi.yaml    ← Source of truth (21 REST paths)
│   ├── api-zod/                 ← Zod schemas + TypeScript types (generated)
│   └── api-client-react/        ← React Query hooks (orval-generated)
├── .github/workflows/ci.yml     ← CI: matrix + EAS + Slack
├── docker-compose.yml           ← Production
├── docker-compose.dev.yml       ← Development (volume mounts)
├── .env.example                 ← Backend env template
└── artifacts/mobile/.env.example← Mobile env template
```

---

## Key Module Responsibilities

### `sshManager.ts`

Central hub for all SSH activity.

| Export | Purpose |
|--------|---------|
| `createSession()` | Connects SSH, opens xterm-256color shell, adds to session map |
| `closeSession(id)` | Calls `client.end()`, removes from map |
| `sendToSession(id, data)` | Writes raw string to shell stream |
| `resizeSession(id, rows, cols)` | Calls `shell.setWindow(rows, cols, 0, 0)` |
| `addOutputListener(id, fn)` | Subscribes to shell output; returns cleanup fn |
| `getUtilityClient()` | Returns/creates pooled SSH client for exec/SFTP (avoids a new handshake per call) |
| `execCommand(cmd)` | Runs one-shot exec via utility client |
| `getSftp()` | Opens SFTP subsystem via utility client |
| `testConnection(cfg)` | Connect + immediate disconnect, returns latency ms |
| `markUserInitiatedClose(id)` | Marks a session close as user-initiated (prevents push notification) |

**Connection pooling:** `utilityClient` is a single persistent SSH connection reused across all `exec` and SFTP calls. On disconnect/error it sets itself to `null` and reconnects on next call. A `utilityQueue` holds pending callers during reconnection.

**Push notifications:** When a session closes unexpectedly (shell close or SSH error), `notifySessionDisconnected()` is called. User-initiated closes (via `closeSession()`) are tracked in a `Set<string>` and skip notification.

### `wsHandler.ts`

Bridges HTTP upgrade → WebSocket → SSH shell.

**Heartbeat:** `setInterval` every 30 s sends `ws.ping()`. Connections that don't respond with a `pong` within one interval are terminated. Alive flag is set on `ws.on("pong")`.

**Message dispatch:**
```
Client message received
  → try JSON.parse
      → { type: "resize", rows, cols } → resizeSession()
  → else: raw string → sendToSession()
```

**Output buffering:** While the WebSocket is not `OPEN`, up to 64 KB of SSH output is buffered per connection and flushed on reconnect.

### `store.ts`

File-backed persistence. State is loaded from `data/store.json` on startup. Every mutation calls `persist()` which does a synchronous `writeFileSync`. Structure:

```json
{
  "connections": [{ "id", "name", "host", "port", "username", "password", "privateKey?", "passphrase?" }],
  "activeConnectionId": "string | null",
  "commands": [{ "id", "label", "command", "description" }],
  "pushDevices": [{ "id", "pushToken", "platform", "deviceName?", "createdAt", "updatedAt" }],
  "notificationPreferences": { "sessionDisconnected": true, "serverHealthChange": true }
}
```

Safe exports (`getActiveConnectionSafe`, `getConnectionsSafe`) return `password: "***"` for API responses. Full credentials are only accessed internally by `sshManager.ts`. `password`/`privateKey`/`passphrase` are encrypted at rest in `data/store.json` via `credentialCrypto.ts` (AES-256-GCM, key in `data/store.key`) — in-memory state stays plaintext for `sshManager.ts`, only the on-disk copy is encrypted.

### `pushNotifications.ts`

Expo Push API integration. Uses `expo-server-sdk` to send push notifications to registered devices. **Mobile-side `expo-notifications` is currently disabled** (see `3f71496` — isolating a cold-start crash), so this backend code path has no live receiver until the mobile app re-enables it; the server-side send logic still works and is exercised by tests.

| Export | Purpose |
|--------|---------|
| `sendPushToAllDevices(title, body, data?)` | Sends push to all registered devices via Expo Push API |
| `notifySessionDisconnected(sessionTitle, sessionId)` | Sends "Session Disconnected" notification (if preference enabled) |
| `notifyServerStarted()` | Sends "Server Online" notification (if preference enabled) |

### `tunnel.ts`

Cloudflare Tunnel lifecycle manager. Creates and manages a secure tunnel to expose the local server to the internet.

### `config.ts`

Reads/writes `data/config.json` for persistent settings like tunnel URL and tray preferences.

### `tray.ts`

System tray entry point using `systray2`. Spawns the server as a child process and provides a system tray icon with menu options.

### `auth.ts`

```
API_TOKEN unset  → next()          (open dev mode)
API_TOKEN set    → require "Authorization: Bearer <token>" → 401 on mismatch
```

WebSocket auth: token checked from `?token=` query parameter on the upgrade request.

`/health` is mounted outside the `/api` router and is always unauthenticated (Docker health checks).

---

## Security Model

| Layer | Mechanism |
|-------|-----------|
| API auth | Bearer token middleware on all `/api/*` routes |
| WS auth | `?token=` query param validated on HTTP upgrade |
| Rate limiting | 100 req/15 min general; 10 req/15 min on `/connection/test` |
| Path traversal | `sanitizePath()` rejects any path containing `..` |
| PID injection | `/^\d+$/` regex enforced before `Stop-Process -Id <pid>` |
| Credential leakage | `getActiveConnectionSafe()` masks password/key in all API responses |
| Log redaction | `pino redact: ['password', 'privateKey', 'passphrase']` |
| Body size | `express.json({ limit: '1mb' })` — upload route separately allows 100 MB multipart |

---

## API Contract

Source of truth: `lib/api-spec/openapi.yaml` (18 paths).

Codegen pipeline:
```
openapi.yaml
  → pnpm --filter @remotectrl/api-zod generate     → lib/api-zod/src/schemas.ts
  → pnpm --filter @remotectrl/api-client-react generate → lib/api-client-react/src/hooks.ts
```

Run both codegen commands after any change to `openapi.yaml`.

---

## CI Pipeline

`.github/workflows/ci.yml` — triggers on every push to every branch:

```
lint job (Node 18/20/22)  → pnpm --filter api-server tsc --noEmit
                           → pnpm --filter api-server build
test job (Node 18/20/22)  → pnpm --filter api-server test
build-server (Node 18/20/22) → pnpm build:server + verify dist/index.mjs
typecheck-mobile (Node 20)  → pnpm --filter @remotectrl/mobile tsc --noEmit
eas-build (v* tags only)    → npx eas build --platform ios --profile preview
eas-submit (v* tags only)   → npx eas submit --platform ios --profile preview
slack-notify (always)       → Posts compact summary to #obsidian-media
```

---

## Design Decisions

| Decision | Rationale |
|----------|-----------|
| ssh2/ws externalized from esbuild | Both use native modules incompatible with bundling; loaded via `createRequire(import.meta.url)` at runtime |
| WebSocket shares HTTP server | Avoids a second port; WS upgrade is intercepted via `server.on('upgrade')` |
| Synchronous `writeFileSync` for persistence | Store mutations are infrequent; async writes risk data loss on crash without a queue |
| In-memory session map | SSH sessions are inherently stateful and tied to a process lifetime; no benefit in persisting them |
| `utilityClient` pool for exec/SFTP | Eliminates one full SSH handshake per file or process operation |
