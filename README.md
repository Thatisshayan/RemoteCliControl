# RemoteCTRL

A full-stack mobile app that lets you control a Windows machine via SSH from your phone.

> **Stack:** Express 5 + TypeScript + ssh2 + ws (backend) · Expo SDK 54 + React Native (mobile) · pnpm workspaces monorepo

---

## Prerequisites

### On your Windows PC (the machine you want to control)

1. **OpenSSH Server** must be installed and running:
   ```powershell
   # Install (Settings → Apps → Optional Features → OpenSSH Server, or via PowerShell):
   Add-WindowsCapability -Online -Name OpenSSH.Server~~~~0.0.1.0
   Start-Service sshd
   Set-Service -Name sshd -StartupType Automatic
   # Verify:
   Get-Service sshd
   ```

2. **Node.js** v20+ — https://nodejs.org

3. **pnpm** v9+:
   ```bash
   npm install -g pnpm
   ```

### On your phone

- **iOS**: App Store → **Expo Go**
- **Android**: Play Store → **Expo Go**

---

## Quickstart

```bash
# 1. Clone
git clone https://github.com/Thatisshayan/RemoteCliControl.git
cd RemoteCliControl

# 2. Install all dependencies
pnpm install

# 3. Configure environment
cp .env.example .env
# Edit .env: set PORT and optionally API_TOKEN

# 4. Build & start backend
pnpm build:server
PORT=3000 node artifacts/api-server/dist/index.mjs

# 5. Start mobile (in a second terminal)
pnpm dev:mobile
# Scan the QR code with Expo Go on your phone
```

---

## Docker

```bash
# Production
docker compose up

# Development (hot reload)
docker compose -f docker-compose.dev.yml up
```

The server reads `PORT` and `API_TOKEN` from environment. Mount `./data` for persistent storage.

---

## Environment Variables

### Backend (`.env` in repo root or `artifacts/api-server/`)

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `PORT` | ✅ | — | Port to listen on (e.g. `3000`) |
| `API_TOKEN` | — | unset | Bearer token for API auth. When unset, auth is bypassed (local dev). |

### Mobile (`artifacts/mobile/.env`)

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `EXPO_PUBLIC_DOMAIN` | ✅ | `http://localhost:3000` | Full URL of the backend (including `http://` or `https://`) |
| `EXPO_PUBLIC_API_TOKEN` | — | unset | Must match the server's `API_TOKEN` when auth is enabled |

---

## Development Scripts

```bash
pnpm dev:server        # Backend with hot reload (tsx watch)
pnpm build:server      # Build backend → artifacts/api-server/dist/index.mjs
pnpm dev:mobile        # Start Expo dev server
pnpm test              # Run backend vitest suite
pnpm typecheck         # tsc --noEmit across all packages
```

---

## Features

### Terminal
- Full interactive SSH shell (xterm-256color)
- **ANSI color rendering** — git, npm, PowerShell colors display correctly
- **Command history** — ▲/▼ buttons cycle through the last 100 commands
- **Font size** — A− / A+ buttons, persisted to AsyncStorage, clamped 8–20px
- **Auto-reconnect** — exponential backoff, up to 10 attempts, status shown in header
- **Terminal resize** — sends `{ type:"resize", rows, cols }` to backend on layout change
- **Keep awake** — screen does not dim during active sessions
- **Output ring buffer** — last 5,000 lines kept; older output dropped to prevent memory pressure
- Quick keys: Tab · Ctrl+C · Ctrl+D

### SSH Connection Profiles
- **Multiple profiles** — save as many SSH targets as you like (home PC, work server, etc.)
- **Password or SSH key auth** — paste a PEM private key; optional passphrase support
- **Connection test** — verifies credentials and shows round-trip latency (ms)
- **Active profile** — tap any saved profile to make it the active connection
- **Persistent** — all profiles survive server restarts (`data/store.json`)

### File Browser
- Navigate directories; breadcrumb bar for quick jump to parent
- **Upload** from phone (up to 100 MB)
- **Download** to phone (via native share sheet)
- **Preview** text files in-app (up to 100 KB)
- **Create folder** · **Delete** · **Rename** (SFTP rename)
- Directories listed first, then files — both alphabetically
- File sizes shown in human-readable form (KB / MB / GB)

### Process Manager
- Lists all running Windows processes with CPU %, memory (MB), and status
- **Search / filter** by process name (live, client-side)
- Kill any process (with confirmation)
- CPU bar color: green < 50 % · amber 50–80 % · red > 80 %

### Saved Commands
- Library of frequently-used commands (label + command + description)
- **Copy to clipboard** or **Send directly to a terminal session**
- If multiple sessions are open, a picker lets you choose which one

### Security
- **Bearer token auth** on all `/api/*` routes (when `API_TOKEN` is set)
- **Rate limiting**: 100 req / 15 min general; 10 req / 15 min for `/connection/test`
- **Path sanitization**: `..` traversal blocked on all SFTP operations
- **PID validation**: regex `/^\d+$/` before any PowerShell `Stop-Process` call
- **Credential masking**: passwords/keys are never returned in API responses or logs
- **pino redact**: `password`, `privateKey`, `passphrase` stripped from all log output

### Observability
- `pino-http` structured HTTP request logging on every request
- Global Express error handler — all errors return `{ error, code }` JSON
- `/health` endpoint: `{ status, activeSessions, connectionConfigured, uptimeSeconds }`
- Mobile `ErrorBoundary` with retry button per tab

---

## Architecture

```
/
├── artifacts/
│   ├── api-server/          ← Express 5 backend
│   │   ├── src/
│   │   │   ├── index.ts         ← Entry point (PORT required, WS setup)
│   │   │   ├── app.ts           ← Express: cors, json, pino-http, rate limit, auth, routes
│   │   │   ├── lib/
│   │   │   │   ├── sshManager.ts  ← SSH sessions + utility connection pool
│   │   │   │   ├── wsHandler.ts   ← WebSocket relay (input → SSH, output → client)
│   │   │   │   ├── store.ts       ← JSON file-backed store (connections, commands)
│   │   │   │   ├── auth.ts        ← Bearer token middleware
│   │   │   │   └── logger.ts      ← Pino with redact
│   │   │   └── routes/
│   │   │       ├── health.ts      ← GET /health
│   │   │       ├── connection.ts  ← Legacy single-profile + multi-profile endpoints
│   │   │       ├── sessions.ts    ← SSH session CRUD + PATCH rename
│   │   │       ├── files.ts       ← SFTP browse/read/upload/download/mkdir/delete/rename
│   │   │       ├── processes.ts   ← PowerShell Get-Process + Stop-Process
│   │   │       └── commands.ts    ← Saved command library CRUD
│   │   ├── Dockerfile
│   │   └── build.mjs            ← esbuild (ESM, ssh2/ws externalized)
│   └── mobile/                ← Expo SDK 54 React Native app
│       ├── app/
│       │   ├── _layout.tsx        ← QueryClient, ErrorBoundary, auth headers
│       │   ├── connection.tsx     ← SSH profile manager
│       │   ├── session/[sessionId].tsx  ← Full-screen terminal
│       │   └── (tabs)/
│       │       ├── terminal.tsx   ← Session list (auto-refresh 5s)
│       │       ├── files.tsx      ← File browser
│       │       ├── processes.tsx  ← Process manager + search
│       │       └── commands.tsx   ← Saved commands + send-to-session
│       └── components/
│           └── ErrorBoundary.tsx
├── lib/
│   ├── api-spec/openapi.yaml    ← Source of truth (18 paths)
│   ├── api-zod/                 ← Generated Zod schemas + TS types
│   └── api-client-react/        ← Generated React Query hooks (orval)
├── .github/workflows/ci.yml    ← CI: lint → test → build
├── docker-compose.yml
└── docker-compose.dev.yml
```

### WebSocket Protocol

```
Client → Server:  { "type": "resize", "rows": 30, "cols": 120 }   ← terminal resize
Client → Server:  "raw shell input string\n"                        ← keystrokes
Server → Client:  "shell output data stream"                        ← SSH output
```

Connection URL: `ws[s]://<host>/api/ws/terminal/<sessionId>?token=<API_TOKEN>`

---

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/health` | Health check (no auth required) |
| GET | `/api/connection` | Active connection (safe — password masked) |
| POST | `/api/connection` | Save / update active connection |
| POST | `/api/connection/test` | Test SSH credentials (rate-limited: 10/15min) |
| GET | `/api/connections` | All saved profiles (passwords masked) |
| POST | `/api/connections` | Create a new profile |
| DELETE | `/api/connections/:id` | Delete a profile |
| POST | `/api/connections/:id/activate` | Set active profile |
| GET | `/api/connections/active` | Get active profile |
| GET | `/api/sessions` | List SSH sessions |
| POST | `/api/sessions` | Create SSH session |
| DELETE | `/api/sessions/:id` | Close SSH session |
| PATCH | `/api/sessions/:id` | Rename session `{ title }` |
| GET | `/api/files?path=` | List directory |
| GET | `/api/files/read?path=` | Preview file (≤ 100 KB) |
| GET | `/api/files/download?path=` | Stream file download |
| POST | `/api/files/upload?path=` | Upload file (≤ 100 MB) |
| POST | `/api/files/mkdir` | Create directory |
| DELETE | `/api/files?path=` | Delete file or directory |
| PATCH | `/api/files/rename` | Rename `{ from, to }` |
| GET | `/api/processes` | List Windows processes |
| DELETE | `/api/processes/:pid` | Kill process |
| GET | `/api/commands` | List saved commands |
| POST | `/api/commands` | Create saved command |
| DELETE | `/api/commands/:id` | Delete saved command |

---

## Troubleshooting

| Symptom | Fix |
|---------|-----|
| "No connection configured" | Open Connection screen (gear icon), save SSH credentials |
| Connection test fails | Check OpenSSH is running on Windows, firewall allows port 22, phone and PC on same network |
| Terminal shows no output | WebSocket may not have connected — go back and reopen the session |
| 401 Unauthorized | Set `EXPO_PUBLIC_API_TOKEN` in `artifacts/mobile/.env` to match server's `API_TOKEN` |
| File browser empty | Navigate to a directory you have read permission for |
| App crashes on startup | Run `pnpm install` again; check Node.js ≥ 20 |
