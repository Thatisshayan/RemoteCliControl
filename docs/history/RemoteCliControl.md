# RemoteCTRL — System Specification

**Version:** 2.0 (post-June 2026 sprint)
**Status:** Production-ready

---

## What It Is

RemoteCTRL is a full-stack mobile app that lets a user control a Windows machine via SSH from their phone. The backend runs as a Node.js process on the Windows machine; the mobile app connects to it over the local network (or via tunnel).

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Mobile | Expo SDK 54, Expo Router (file-based), React Native |
| Backend | Express 5, Node.js 20+, TypeScript, esbuild |
| SSH | ssh2 (native, externalized from esbuild bundle) |
| WebSocket | ws (native, externalized from esbuild bundle) |
| Logging | pino + pino-http |
| API Contract | OpenAPI spec → Zod types → React Query hooks (orval) |
| Package Manager | pnpm workspaces (monorepo) |
| State | File-backed JSON (`data/store.json`) |
| Auth | Bearer token (`API_TOKEN` env var) |

---

## Critical Build Constraint

`ssh2` and `ws` are externalized from the esbuild bundle. They **must** be loaded via `createRequire`:

```typescript
import { createRequire } from "module";
const require = createRequire(import.meta.url);
const { Client } = require("ssh2") as typeof import("ssh2");
const { WebSocketServer } = require("ws") as typeof import("ws");
```

Never import them with a plain `import` statement.

---

## Backend — `artifacts/api-server`

### Entry Point (`src/index.ts`)

- Reads `PORT` from env (throws if missing)
- Logs a warning if `API_TOKEN` is not set
- Calls `app.listen(PORT)` then `setupWebSocket(server)`
- Registers `SIGTERM` / `SIGINT` handlers: close all SSH sessions → `server.close()`

### Middleware Stack (`src/app.ts`)

```
cors()
express.json({ limit: '1mb' })
pino-http({ logger })
/health  → healthRoutes  (no auth, no rate limit)
/api/connection/test → connectionLimiter (10 req/15min)
/api → generalLimiter (100 req/15min) → authMiddleware → routes
global error handler (4-arg)
```

### Auth Middleware (`src/lib/auth.ts`)

- `API_TOKEN` unset → `next()` (open dev mode, logs warning on startup)
- `API_TOKEN` set → requires `Authorization: Bearer <token>` → 401 on mismatch
- WebSocket: token validated from `?token=` on the HTTP upgrade request

### Persistent Store (`src/lib/store.ts`)

File path: `./data/store.json` (created on first write; `data/` is gitignored).

```typescript
interface StoreState {
  connections: ConnectionProfile[];
  activeConnectionId: string | null;
  commands: SavedCommand[];
}

interface ConnectionProfile {
  id: string;
  name: string;
  host: string;
  port: number;
  username: string;
  password: string;
  privateKey?: string;
  passphrase?: string;
}

interface SavedCommand {
  id: string;
  label: string;
  command: string;
  description: string;
}
```

**Exports (safe — for API responses):**
- `getActiveConnectionSafe()` — returns active profile with `password: "***"`
- `getConnectionsSafe()` — all profiles, passwords masked

**Exports (internal — sshManager only):**
- `getActiveConnection()` — returns full credentials
- `getConnectionById(id)` — returns full profile by id

**Mutation exports:** `addConnection`, `removeConnection`, `setActiveConnection`, `getCommands`, `addCommand`, `removeCommand` — all call `persist()` after writing.

### SSH Manager (`src/lib/sshManager.ts`)

#### Session Map

```typescript
interface ActiveSession {
  id: string;
  title: string;           // "Session 1", "Session 2", ... (monotonic counter, never decremented)
  status: "connecting" | "connected" | "disconnected" | "error";
  createdAt: Date;
  client: any;             // ssh2 Client
  shell: NodeJS.ReadWriteStream | null;
  listeners: Set<(data: string) => void>;
}
```

Shell opened with `{ term: "xterm-256color", rows: 24, cols: 80 }`.

#### Connection Pool (utility client)

A single `utilityClient` SSH connection is maintained for all `execCommand` and `getSftp` calls. On disconnect/error it resets to `null` and reconnects on next call. Callers during reconnection are queued in `utilityQueue`.

#### Key Exports

| Function | Purpose |
|----------|---------|
| `createSession()` | Connect SSH, open shell, return `{ id, title, status, createdAt }` |
| `closeSession(id)` | `client.end()`, remove from map |
| `sendToSession(id, data)` | `shell.write(data)` |
| `resizeSession(id, rows, cols)` | `shell.setWindow(rows, cols, 0, 0)` |
| `addOutputListener(id, fn)` | Subscribe to shell output; returns cleanup fn |
| `listSessions()` | Serialized session list (no internals) |
| `getSession(id)` | Full internal session |
| `execCommand(cmd)` | One-shot exec via utility client; returns stdout+stderr string |
| `getSftp()` | Opens SFTP subsystem via utility client |
| `testConnection(cfg)` | Connect + immediate disconnect; returns `{ success, message, latencyMs }` |
| `resetUtilityClient()` | Force-close utility client and drain queue with errors |

Constant: `READY_TIMEOUT = 15000` ms (single definition, used everywhere).

### WebSocket Handler (`src/lib/wsHandler.ts`)

Mounted via `server.on('upgrade')` — shares the HTTP server port.

**Message dispatch (per connection):**
```
ws.on("message", data)
  → JSON.parse(data)
      → { type: "resize", rows: number, cols: number } → resizeSession()
  → else (parse fails or not resize)
      → sendToSession(sessionId, data.toString())
```

**Heartbeat:**
```
setInterval(30s):
  for each connection:
    if !alive → ws.close() (stale connection)
    else → entry.alive = false; ws.ping()
ws.on("pong") → entry.alive = true
```

**Output buffering:** SSH output is buffered (up to 64 KB) when `ws.readyState !== OPEN` and flushed when the client reconnects.

**Cleanup on `close` / `error`:** removes from `connections` map, removes from `buffers`, calls `removeListener()`.

### Logger (`src/lib/logger.ts`)

Pino with `redact: { paths: ['password', 'privateKey', 'passphrase'], remove: true }`. `pino-http` middleware logs every HTTP request.

---

## REST API

All `/api/*` routes require `Authorization: Bearer <API_TOKEN>` when `API_TOKEN` is set. `/health` is always public.

### Health

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/health` | None | `{ status, activeSessions, connectionConfigured, uptimeSeconds }` |

### Connection Profiles

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/connection` | ✅ | Active profile (safe) |
| POST | `/api/connection` | ✅ | Save/replace active connection (legacy single-profile) |
| POST | `/api/connection/test` | ✅ | Test credentials; rate-limited 10/15min |
| GET | `/api/connections` | ✅ | All profiles (passwords masked) |
| POST | `/api/connections` | ✅ | Create profile → 201 |
| DELETE | `/api/connections/:id` | ✅ | Delete profile |
| POST | `/api/connections/:id/activate` | ✅ | Set active profile |
| GET | `/api/connections/active` | ✅ | Active profile (full — internal use) |

**POST /api/connection body validation:**
- `host`: non-empty string, max 255 chars
- `port`: integer 1–65535
- `username`: non-empty string
- `password`: non-empty string (or omit when using `privateKey`)
- `privateKey?`: PEM string
- `passphrase?`: string

### Sessions

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/sessions` | ✅ | List all sessions |
| POST | `/api/sessions` | ✅ | Create SSH session → 201 |
| DELETE | `/api/sessions/:id` | ✅ | Close session |
| PATCH | `/api/sessions/:id` | ✅ | Rename `{ title: string }` |

### Files (SFTP)

All path params validated: must start with `/`, max 4096 chars, no null bytes, no `..` segments.

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/files?path=` | ✅ | List directory → `{ path, items: FileItem[] }` |
| GET | `/api/files/read?path=` | ✅ | Read text file (≤ 100 KB) → `{ content }` |
| GET | `/api/files/download?path=` | ✅ | Stream file (Content-Disposition: attachment) |
| POST | `/api/files/upload?path=` | ✅ | Multipart upload (≤ 100 MB, multer memoryStorage) |
| POST | `/api/files/mkdir` | ✅ | `{ path }` → SFTP mkdir |
| DELETE | `/api/files?path=` | ✅ | unlink (file) or rmdir (directory) |
| PATCH | `/api/files/rename` | ✅ | `{ from, to }` → SFTP rename |

`FileItem`:
```typescript
{ name: string, path: string, type: "file"|"directory"|"symlink", size: number, modifiedAt: string, permissions: string }
```

### Processes

PID validated against `/^\d+$/` before any PowerShell call.

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/processes` | ✅ | PowerShell `Get-Process` → `RemoteProcess[]` |
| DELETE | `/api/processes/:pid` | ✅ | PowerShell `Stop-Process -Id <pid> -Force` |

`RemoteProcess`:
```typescript
{ pid: number, name: string, cpu: number, memory: number, status: "running"|"not responding", user: string }
```

### Commands

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/commands` | ✅ | Saved command list |
| POST | `/api/commands` | ✅ | `{ label, command, description? }` → 201 |
| DELETE | `/api/commands/:id` | ✅ | Delete |

---

## Mobile — `artifacts/mobile`

### Root Layout (`app/_layout.tsx`)

- Loads Inter fonts (400/500/600/700)
- Calls `setBaseUrl(process.env.EXPO_PUBLIC_DOMAIN)` and `setApiToken(process.env.EXPO_PUBLIC_API_TOKEN)` at module level
- `QueryClient` with global `onError` → `Alert.alert` for both queries and mutations
- Wraps app in: `GestureHandlerRootView → SafeAreaProvider → KeyboardProvider → ErrorBoundary → QueryClientProvider`
- Stack screens: `(tabs)`, `session/[sessionId]` (fullscreen modal), `connection` (modal)

### Design System (`constants/colors.ts`)

Always use `colors.*` — never hardcode hex values.

```
background:        "#0d0d0d"    primary:           "#00ff88"
foreground:        "#e0e0e0"    primaryForeground: "#0d0d0d"
card:              "#1a1a1a"    mutedForeground:   "#666666"
border:            "#2a2a2a"    destructive:       "#ff4444"
surface:           "#111111"    warning:           "#ffaa00"
surfaceElevated:   "#1e1e1e"
```

Font: Inter (400/500/600/700).

### Terminal Tab (`app/(tabs)/terminal.tsx`)

- `useGetSessions({ refetchInterval: 5000 })` — auto-polls every 5 s
- Each session card: status dot, title, X to close, long-press to rename
- `useRenameSession` mutation with inline TextInput on long-press
- FAB creates session → navigates to `session/[id]`

### Session Screen (`app/session/[sessionId].tsx`)

WebSocket connection URL:
```
ws[s]://<EXPO_PUBLIC_DOMAIN stripped of protocol>/api/ws/terminal/<sessionId>?token=<EXPO_PUBLIC_API_TOKEN>
```

**State:**
- `lines: string[]` — ring buffer, max 5,000 lines
- `fontSize: number` — default 12, persisted to AsyncStorage key `"terminal-font-size"`, clamped [8, 20]
- `history: string[]` — max 100 entries, resets on screen unmount
- `historyIndex: number` — `-1` = not browsing
- `reconnectStatus: string` — displayed in header during reconnect
- `connected: boolean`

**Auto-reconnect:** exponential backoff (`min(1000 * 2^n, 30000)` ms), up to 10 attempts. `shouldReconnect` ref set to `false` on unmount.

**ANSI rendering:** `parseAnsi(text)` splits on `/\x1b\[[0-9;]*m/g`, maps SGR codes to hex:
```
30=#4d4d4d  31=#ff4444  32=#00ff88  33=#ffaa00  34=#5599ff  35=#cc44ff  36=#00ccff  37=#e0e0e0
90=#999999  91=#ff6666  92=#33ff99  93=#ffcc44  94=#77bbff  95=#dd77ff  97=#ffffff
0=reset → colors.primary (#00ff88)   1=bold
```

**Resize:** On component layout change, sends `{ type: "resize", rows, cols }` via WebSocket.

**Prefill:** Reads `prefill` query param on mount (set by Commands tab "Send to session"). Pre-fills input field.

**Quick keys:** Tab (`\t`), Ctrl+C (`\x03`), Ctrl+D (`\x04`), ▲ history, ▼ history, A−, A+.

**Keep awake:** `KeepAwake.activateKeepAwakeAsync()` on mount; deactivated on unmount.

### Files Tab (`app/(tabs)/files.tsx`)

- Starts at `/`; breadcrumb nav; back button when inside subdirectory
- Each item: icon (green folder / grey file), name, size (formatted KB/MB/GB), modified date
- Directories listed first, then files — both alphabetically
- Long-press action sheet: Preview / Download / Rename / Delete
- Header buttons: new folder, upload file
- File preview modal (text files ≤ 100 KB)

### Processes Tab (`app/(tabs)/processes.tsx`)

- `useGetProcesses()` with manual refresh button
- Search bar (TextInput + Feather icon + clear X) — live client-side filter by name
- Count bar: "Showing N of M processes" when search active; "N processes" when not
- CPU color: green < 50 % · amber 50–80 % · red > 80 %
- X button to kill (with confirmation alert)

### Connection Screen (`app/connection.tsx`)

- Lists all saved profiles; active profile highlighted
- FAB opens Add Profile form: Name, Host, Port, Username, auth mode toggle
- Auth modes: **Password** (password field) / **SSH Key** (multiline PEM TextInput + optional passphrase)
- Test Connection → shows latency or error banner; Save connects and returns to tabs
- Long-press profile to delete

### Commands Tab (`app/(tabs)/commands.tsx`)

- Lists saved commands (label, command text, description)
- Tap → action sheet: Copy to clipboard / Send to Session / Cancel
- "Send to Session": if 1 session → navigate directly; if multiple → session picker alert
- FAB opens modal: Label + Command + Description → POST /api/commands
- Long-press → delete confirmation

### Error Boundary (`components/ErrorBoundary.tsx`)

Class component wrapping the entire app root. On error: renders fallback UI with retry button that calls `setState({ hasError: false })`.

---

## API Client Codegen

```
lib/api-spec/openapi.yaml  ←  source of truth (18 paths)
  │
  ├─ pnpm --filter @remotectrl/api-zod generate
  │    → lib/api-zod/src/schemas.ts  (Zod schemas + TS types)
  │
  └─ pnpm --filter @remotectrl/api-client-react generate
       → lib/api-client-react/src/hooks.ts  (React Query hooks)
```

Run both after any OpenAPI change. Never hand-edit the generated files.

---

## CI Pipeline

`.github/workflows/ci.yml` — triggers on every push:

1. **lint** — `tsc --noEmit` + `build` (verifies TypeScript compiles and esbuild succeeds)
2. **test** — `pnpm --filter api-server test` (18 vitest tests)
3. **build-server** — full build + verify `dist/index.mjs` exists

---

## Known Limitations / Post-Sprint Backlog

| Item | Notes |
|------|-------|
| No E2E mobile tests | Detox / Maestro not set up; all mobile testing is manual |
| No offline banner | `@react-native-community/netinfo` not wired (T027 deferred) |
| Process sort options | Sort by CPU/memory/name UI not implemented (T099 deferred) |
| Process loading skeleton | Placeholder cards on first load not implemented (T100 deferred) |
| `redocly lint` not in CI | OpenAPI linting step was specified in T076 but not added to CI |
| `cloudflared.exe` in history | Binary was committed on phase7branch (now deleted); it remains in git object history but is gitignored |
