RemoteCTRL — Full Build Instructions
What It Is
A full-stack mobile app called RemoteCTRL that lets you control a Windows machine via SSH from your phone. Single-user, username+password SSH authentication. No database — in-memory state only.

Monorepo Structure (pnpm workspace)
/
├── artifacts/
│   ├── api-server/        ← Express backend (SSH relay)
│   └── mobile/            ← Expo React Native app
├── lib/
│   ├── api-spec/          ← OpenAPI spec (openapi.yaml)
│   ├── api-zod/           ← Zod types generated from spec
│   └── api-client-react/  ← React Query hooks generated from spec

Backend — artifacts/api-server
Stack: Express 5, TypeScript, ssh2 (SSH/SFTP), ws (WebSocket), pino (logging), built with esbuild via build.mjs.

Critical build note: ssh2 and ws are externalized in build.mjs because they use native modules. They must be imported using createRequire like this:

import { createRequire } from "module";
const req = createRequire(import.meta.url);
const { Client } = req("ssh2") as typeof import("ssh2");
const { WebSocketServer } = req("ws") as typeof import("ws");

Entry point: src/index.ts

Reads PORT env var (required, throws if missing)
Calls app.listen(port, ...) then immediately calls setupWebSocket(server) on the returned server instance
In-Memory Store — src/lib/store.ts
Holds two things:

connection: ConnectionConfig | null — the saved SSH credentials
commands: SavedCommand[] — saved command library
Functions exported: getConnection, setConnection, getCommands, addCommand(cmd), removeCommand(id)

IDs are generated as Date.now().toString() + Math.random().toString(36).substr(2, 9)

SSH Manager — src/lib/sshManager.ts
Manages an in-memory Map<string, ActiveSession> where each session has:

interface ActiveSession {
  id: string;
  title: string;           // "Session 1", "Session 2", etc.
  status: "connecting" | "connected" | "disconnected" | "error";
  createdAt: Date;
  client: SshClient;
  shell: NodeJS.ReadWriteStream | null;
  listeners: Set<(data: string) => void>;  // WebSocket output broadcast
}

Exported functions:

listSessions() — returns array of Session (serialized, no internals)
createSession() — connects SSH using stored config, opens a shell with { term: "xterm-256color", rows: 24, cols: 80 }, resolves on ready, rejects on error. `readyTimeout

Documenting current system design
Here is everything that was built, written out completely so you can hand it to another agent:

RemoteCTRL — Full Build Specification
What It Is
A full-stack mobile app called RemoteCTRL that lets a user control a Windows machine via SSH from their phone. Single-user, no auth system, username+password SSH login.

Tech Stack
Layer	Technology
Mobile	Expo SDK 54, Expo Router (file-based routing), React Native
Backend	Express 5, Node.js, TypeScript, esbuild bundler
SSH	ssh2 npm package (native, externalized in esbuild)
WebSocket	ws npm package (externalized in esbuild)
State	In-memory only (no database)
API Client	Auto-generated from OpenAPI spec using orval (React Query hooks)
Fonts	@expo-google-fonts/inter (400, 500, 600, 700)
Icons	@expo/vector-icons (Feather set)
Monorepo Structure (pnpm workspaces)
/
├── artifacts/
│   ├── api-server/          ← Express backend
│   │   ├── src/
│   │   │   ├── index.ts
│   │   │   ├── app.ts
│   │   │   ├── lib/
│   │   │   │   ├── sshManager.ts
│   │   │   │   ├── wsHandler.ts
│   │   │   │   ├── store.ts
│   │   │   │   └── logger.ts
│   │   │   └── routes/
│   │   │       ├── index.ts
│   │   │       ├── connection.ts
│   │   │       ├── sessions.ts
│   │   │       ├── files.ts
│   │   │       ├── processes.ts
│   │   │       ├── commands.ts
│   │   │       └── health.ts
│   │   └── build.mjs        ← esbuild bundler config
│   └── mobile/              ← Expo app
│       ├── app/
│       │   ├── _layout.tsx          ← root layout
│       │   ├── index.tsx            ← redirects to /terminal
│       │   ├── connection.tsx       ← SSH settings screen
│       │   ├── session/
│       │   │   └── [sessionId].tsx  ← full-screen terminal
│       │   └── (tabs)/
│       │       ├── _layout.tsx      ← tab bar layout
│       │       ├── terminal.tsx     ← session list
│       │       ├── files.tsx        ← file browser
│       │       ├── processes.tsx    ← process manager
│       │       └── commands.tsx     ← saved commands
│       ├── constants/
│       │   └── colors.ts
│       ├── hooks/
│       │   └── useColors.ts
│       └── components/
│           └── ErrorBoundary.tsx
└── lib/
    ├── api-spec/
    │   └── openapi.yaml     ← OpenAPI spec (source of truth)
    ├── api-zod/             ← Zod schemas + TypeScript types (generated)
    └── api-client-react/    ← React Query hooks (generated via orval)

Design System / Colors
All colors are forced dark (no light mode):

background:       "#0d0d0d"   // near-black
foreground:       "#e0e0e0"   // light grey text
card:             "#1a1a1a"   // card backgrounds
border:           "#2a2a2a"   // dividers
surface:          "#111111"   // slightly elevated bg
surfaceElevated:  "#1e1e1e"
primary:          "#00ff88"   // electric green (main accent)
primaryForeground:"#0d0d0d"   // dark text on green
mutedForeground:  "#666666"   // secondary text
destructive:      "#ff4444"   // red for kill/delete
warning:          "#ffaa00"   // amber for CPU warnings

Font: Inter (from @expo-google-fonts/inter), weights 400/500/600/700.

Backend — artifacts/api-server
Entry Point (src/index.ts)
Reads PORT from environment (required, throws if missing)
Calls app.listen(port) then setupWebSocket(server) on the returned HTTP server
Logger: pino
In-Memory Store (src/lib/store.ts)
Holds two things in memory (resets on server restart):

connection: ConnectionConfig | null — the saved SSH credentials
commands: SavedCommand[] — the saved command library
Exports: getConnection, setConnection, getCommands, addCommand(label, command, description), removeCommand(id)

IDs are generated as Date.now() + random base36.

SSH Manager (src/lib/sshManager.ts)
Uses ssh2 loaded via createRequire (because it's a native module externalized from the esbuild bundle).

Key exports:

createSession() — reads connection from store, opens an interactive shell (xterm-256color, 24 rows, 80 cols), stores it in a Map<string, ActiveSession>, resolves with { id, title, status, createdAt }
closeSession(id) — calls client.end(), deletes from map
sendToSession(id, data) — writes raw string to the shell stream
addOutputListener(id, fn) — registers a callback for shell output, returns a cleanup function
listSessions() — returns array of { id, title, status, createdAt }
getSession(id) — returns full internal session object
execCommand(command) — opens a one-shot SSH exec (not a shell), returns combined stdout+stderr as a string. Used for processes and kill commands.
getSftp() — opens a one-shot SFTP connection, returns { sftp, client }. Caller is responsible for calling client.end().
testConnection(cfg) — connects and immediately disconnects, returns latency in ms
Session lifecycle: connecting → connected → disconnected. On shell close the session is automatically removed from the map.

WebSocket Handler (src/lib/wsHandler.ts)
Uses ws loaded via createRequire.

Mounts a WebSocketServer at path /api/ws/terminal on the HTTP server
On connection: parses session ID from URL path (last segment of /api/ws/terminal/:sessionId)
If session not found → closes with code 4004
Registers an output listener that forwards SSH output to the WebSocket client
On WS message → forwards raw string to the SSH shell via sendToSession
On close/error → removes the output listener
REST Routes (src/routes/)
GET /connection
Returns saved ConnectionConfig or 404.

POST /connection body: { host, port, username, password }
Saves connection to store. Returns saved config.

POST /connection/test body: { host, port, username, password }
Attempts real SSH connection, returns { success, message, latencyMs }.

GET /sessions
Returns array of Session[] from sshManager.

POST /sessions
Creates a new SSH session. Returns 400 if no connection configured, 500 on SSH error. Returns Session on success (201).

DELETE /sessions/:id
Closes and removes session. 404 if not found.

GET /files?path=/some/path
SFTP readdir of the given path. Returns { path, items: FileItem[] } where each item has { name, path, type ("file"|"directory"|"symlink"), size, modifiedAt, permissions }.

DELETE /files?path=/some/path
SFTP unlink (file) or rmdir (directory, fallback if unlink fails).

POST /files/mkdir body: { path }
SFTP mkdir.

GET /processes
Runs PowerShell:

powershell.exe -NoProfile -Command "Get-Process | Select-Object -Property Name,Id,CPU,WorkingSet,Responding | ConvertTo-Csv -NoTypeInformation"

Parses CSV output. Returns array of { pid, name, cpu (float %), memory (float MB), status ("running"|"not responding"), user }.

DELETE /processes/:pid
Runs powershell.exe -NoProfile -Command "Stop-Process -Id <pid> -Force".

GET /commands
Returns SavedCommand[] from store.

POST /commands body: { label, command, description? }
Adds to store. Returns saved command (201).

DELETE /commands/:id
Removes from store.

GET /health
Returns { status: "ok" }.

Build System (build.mjs)
Uses esbuild. Key settings:

Entry: src/index.ts
Platform: node, format: esm, bundles to dist/index.mjs
Externalized packages (loaded at runtime via createRequire): ssh2, ws, cpu-features, bufferutil, utf-8-validate, and all native/heavy packages
Banner injects globalThis.require, globalThis.__filename, globalThis.__dirname for CJS compat inside ESM bundle
Plugin: esbuild-plugin-pino for pino logger workers
Mobile — artifacts/mobile
Root Layout (app/_layout.tsx)
Loads Inter fonts (400/500/600/700) via useFonts
Hides splash screen once fonts are loaded
Wraps entire app in: SafeAreaProvider → ErrorBoundary → QueryClientProvider → GestureHandlerRootView → KeyboardProvider
Calls setBaseUrl(https://${process.env.EXPO_PUBLIC_DOMAIN}) at module level to point the API client at the backend
Stack screens: (tabs), session/[sessionId], connection
Root Index (app/index.tsx)
Immediately redirects to /terminal (the first tab).

Tab Layout (app/(tabs)/_layout.tsx)
Two implementations, switched at runtime:

iOS 26+ (isLiquidGlassAvailable() → true): Uses NativeTabs + NativeTabs.Trigger with SF Symbol icons (terminal, folder, cpu, list.bullet)
All others: Uses classic Tabs from expo-router with Feather icons, blur tab bar on iOS, solid on Android/web
Tabs in order: Terminal, Files, Processes, Commands

Terminal Tab (app/(tabs)/terminal.tsx)
Lists all active SSH sessions. Each session shows as a card with:

Colored status dot (green=connected, amber=connecting, red=error, grey=disconnected)
Session title + status text
X button to close session
FAB (floating action button, green, bottom-right) creates a new session via POST /sessions and immediately navigates to session/[id].

Gear icon (top-right) navigates to /connection.

Session Screen (app/session/[sessionId].tsx)
Full-screen terminal for a single SSH session.

WebSocket connection:

const wsUrl = `wss://${process.env.EXPO_PUBLIC_DOMAIN}/api/ws/terminal/${sessionId}`

On web: respects location.protocol to choose wss: vs ws:
ws.onmessage → appends to output string state, auto-scrolls
Text input → sends input + "\n" on submit or send button press
UI elements:

Header: back chevron, session ID (last 6 chars), connection status dot, trash (clear output)
Output area: scrollable Text (selectable), green monospace font, "Waiting for output..." placeholder
Quick key bar: Tab (sends \t), Ctrl+C (sends \x03), Ctrl+D (sends \x04)
Input row: text input + send button (disabled when disconnected)
KeyboardAvoidingView with behavior="padding" on iOS
Files Tab (app/(tabs)/files.tsx)
SFTP file browser.

Starts at path /
Navigation history stack (back button appears when inside subdirectory)
Breadcrumb bar at top (each segment is tappable)
Folder icon button → shows inline "New folder" input with Create button
File rows: icon (folder=green, file=grey, symlink=link), name, size/date, chevron for dirs
Tap directory → navigate into it
Long-press any item → confirm delete alert → DELETE /files?path=...
Pull-to-refresh
Processes Tab (app/(tabs)/processes.tsx)
Shows all running Windows processes.

Count bar: "N processes · Long-press or tap X to kill"
Each process card shows:
Process name + PID
CPU bar (color: green <50%, amber 50-80%, red >80%) + CPU %
Memory in MB
Status badge (green "running" / red "not responding")
X button (tap) or long-press → confirm kill alert → DELETE /processes/:pid
Refresh button in header
Pull-to-refresh
Commands Tab (app/(tabs)/commands.tsx)
Saved command library.

Lists saved commands. Each card shows: label, command text (green), optional description
Tap card or copy icon → copies command to clipboard (via expo-clipboard)
Long-press or trash icon → confirm delete alert → DELETE /commands/:id
FAB opens a modal sheet with three fields: Label (required), Command (required, multiline, green text), Description (optional)
Modal has Cancel / Save buttons; Save calls POST /commands
Connection Screen (app/connection.tsx)
Full-screen SSH settings form (pushed modally from terminal tab gear icon).

Form fields: HOST, PORT (default 22), USERNAME, PASSWORD (with show/hide toggle)
Pre-fills from GET /connection if a connection is already saved
"Test Connection" button → calls POST /connection/test, shows result banner (green on success with latency, red on failure)
"Save & Connect" button → calls POST /connection, navigates back
Info note at bottom reminding user to enable OpenSSH Server on Windows
API Client Generation
The shared library lib/api-spec/openapi.yaml is the source of truth.

Two packages are generated from it:

lib/api-zod — Zod schemas and TypeScript types (all models: ConnectionConfig, Session, FileItem, RemoteProcess, SavedCommand, TestResult, SuccessResponse, ErrorResponse)
lib/api-client-react — React Query hooks generated by orval. Exports hooks like useGetSessions, useCreateSession, useCloseSession, useListFiles, useDeleteFile, useMakeDirectory, useGetProcesses, useKillProcess, useGetCommands, useCreateCommand, useDeleteCommand, useGetConnection, useSaveConnection, useTestConnection, plus their query key getters. Also exports setBaseUrl(url) to configure the base URL at runtime.
Key Wiring Details
ssh2 and ws are not bundled by esbuild — they are externalized and loaded via createRequire(import.meta.url) at runtime inside sshManager.ts and wsHandler.ts
WebSocket server shares the same HTTP server as Express (not a separate port)
The WebSocket URL pattern is: wss://<domain>/api/ws/terminal/<sessionId>
EXPO_PUBLIC_DOMAIN env var is set automatically by Replit and used by the mobile app to point at the backend
The app uses process.env.EXPO_PUBLIC_DOMAIN (exposed to Expo at build time via the EXPO_PUBLIC_ prefix)
No authentication on the API — it is a single-user personal tool
Connection credentials are stored in memory only — they reset if the server restarts