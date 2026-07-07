# RemoteCTRL — June Completion Sprint
**Owner:** Builder Agent  
**Orchestrator:** Claude (Principal Engineer)  
**Created:** 25.06.2026  
**Branch strategy:** Each phase gets its own branch (`phase1branch`, `phase2branch`, ...). After ALL phases are done, the Orchestrator will audit each branch and manage merges to `main`.

---

## BUILDER INSTRUCTIONS

Take ownership of this project end-to-end. Execute tasks as this plan defines. Verify each result before moving on. Only stop for: destructive actions on shared infrastructure, secrets that must be provided by the user, paid external services, or irreversible production operations.

Keep going until the project is done or you hit a real blocker. Do not stop for small questions — make the reasonable call and proceed. **Token-saving mode ON.**

**After each phase:**
1. A subagent updates all documentation to match the current state of the code.
2. After docs are updated, commit all changes and push the phase branch.
3. Use parallel subagents wherever work is independent. If parallelism is not possible, you execute the task yourself.
4. Make no mistakes — there is no more time for rework.

**Subagent usage:** Spawn subagents when tasks can run in parallel. Always prefer parallel execution. If a subagent can handle documentation while you continue coding — do it.

---

## PHASE 1 — Security & Data Integrity
**Branch:** `phase1branch`  
**Goal:** Eliminate all P0 issues. No production deployment until this phase is complete.

### 1.1 — Input Validation & Sanitisation
- [ ] **T001** `artifacts/api-server/src/routes/processes.ts` — Validate `:pid` param strictly against `/^\d+$/` before passing to PowerShell. Return 400 if not a valid integer.
- [ ] **T002** `artifacts/api-server/src/routes/files.ts` — Add `sanitizePath(p: string): string` utility. Reject any path containing `..` segments. Return 400 if path traversal is detected.
- [ ] **T003** `artifacts/api-server/src/routes/connection.ts` — Validate `host` (non-empty string, max 255 chars), `port` (integer 1–65535), `username` (non-empty), `password` (non-empty) on POST /connection. Return 400 with field errors on failure.
- [ ] **T004** `artifacts/api-server/src/routes/files.ts` — Validate `path` query param on GET/DELETE /files: must start with `/`, max 4096 chars, no null bytes.
- [ ] **T005** `artifacts/api-server/src/app.ts` — Add global request body size limit: `express.json({ limit: '1mb' })`. File upload route should accept `multipart/form-data` up to 100 MB separately.

### 1.2 — API Authentication
- [ ] **T006** `artifacts/api-server/src/lib/` — Create `src/lib/auth.ts`. Implement a simple bearer-token middleware: reads `API_TOKEN` from environment variable. If `API_TOKEN` is not set, skip auth (local dev mode). If set, require `Authorization: Bearer <token>` header on all requests; return 401 otherwise.
- [ ] **T007** `artifacts/api-server/src/app.ts` — Register the auth middleware from T006 globally, before all routes.
- [ ] **T008** `artifacts/api-server/src/lib/wsHandler.ts` — Apply the same token check to WebSocket upgrade requests: read token from query param `?token=` in the WS URL and validate against `API_TOKEN`.
- [ ] **T009** `artifacts/mobile/app/_layout.tsx` — Pass `API_TOKEN` (from env var `EXPO_PUBLIC_API_TOKEN`) in all API requests: add it as a default header in the API client `setBaseUrl` call, or configure it via the `Authorization` header in the generated client's fetch wrapper.
- [ ] **T010** `.env.example` (root) — Create `.env.example` documenting required env vars: `PORT`, `API_TOKEN`. Create `artifacts/mobile/.env.example` documenting `EXPO_PUBLIC_DOMAIN`, `EXPO_PUBLIC_API_TOKEN`.

### 1.3 — Credential Security
- [ ] **T011** `artifacts/api-server/src/lib/store.ts` — Mask `password` and `privateKey` fields in `getConnection()` return value when used in API list responses. Add a `getConnectionSafe()` export that returns the config with `password: "***"` and `privateKey: "***"`. Use `getConnectionSafe()` in GET /connection response; use `getConnection()` (full) only in sshManager.
- [ ] **T012** `artifacts/api-server/src/routes/connection.ts` — Use `getConnectionSafe()` in the GET /connection handler response.
- [ ] **T013** `artifacts/api-server/src/lib/logger.ts` — Add a `redactPaths` config to pino: `['password', 'privateKey', 'passphrase']` so these fields are never logged.

### 1.4 — Rate Limiting
- [ ] **T014** `artifacts/api-server/package.json` — Add `express-rate-limit` as a dependency.
- [ ] **T015** `artifacts/api-server/src/app.ts` — Apply rate limiting: 100 req/15min for general routes, 10 req/15min for `/connection/test` specifically (it opens real SSH connections).

### 1.5 — Persistent Storage
- [ ] **T016** `artifacts/api-server/src/lib/store.ts` — Replace in-memory store with a file-backed implementation. On startup: read `./data/store.json` into memory (create the file with defaults if missing). On every mutation (`setConnection`, `addCommand`, `removeCommand`): call `persist()` which does `fs.writeFileSync`. Use `fs.mkdirSync('./data', { recursive: true })` on startup. Wrap file reads in try/catch.
- [ ] **T017** `artifacts/api-server/.gitignore` — Add `data/` to `.gitignore` so the store file is never committed.
- [ ] **T018** Verify: restart the server after saving a connection and a command. Confirm they survive the restart by hitting GET /connection and GET /commands.

**Phase 1 complete when:** All T001–T018 done, server starts, all endpoints return correct responses, credentials survive restart, API returns 401 without token.

---

## PHASE 2 — Reliability & WebSocket Hardening
**Branch:** `phase2branch`  
**Goal:** Eliminate all P1 reliability issues. Terminal must be production-stable.

### 2.1 — WebSocket Heartbeat (Server)
- [ ] **T019** `artifacts/api-server/src/lib/wsHandler.ts` — Implement ping/pong heartbeat. Every 30 s, send a `ws.ping()` to each connected client. Track `isAlive` flag per connection. On `pong`, set `isAlive = true`. If a client misses two pings in a row, terminate the connection. This cleans up dead sessions automatically.
- [ ] **T020** `artifacts/api-server/src/lib/wsHandler.ts` — On WebSocket `close` event, call `removeOutputListener()` cleanup to prevent memory leaks from orphaned listener sets.

### 2.2 — Auto-Reconnect WebSocket (Mobile)
- [ ] **T021** `artifacts/mobile/app/session/[sessionId].tsx` — Extract the WebSocket setup into a `openWs()` function. Add refs: `reconnectAttempts` (starts at 0), `shouldReconnect` (starts at true), `reconnectTimer`.
- [ ] **T022** `artifacts/mobile/app/session/[sessionId].tsx` — On `ws.onclose`: if `shouldReconnect.current && reconnectAttempts.current < 10`, schedule a reconnect with exponential backoff (`Math.min(1000 * 2 ** attempts, 30000)`). Update a `reconnectStatus` state string shown in the header: `"Reconnecting (N/10)..."`.
- [ ] **T023** `artifacts/mobile/app/session/[sessionId].tsx` — On `ws.onopen`: reset `reconnectAttempts.current` to 0, clear `reconnectStatus`. On component unmount: set `shouldReconnect.current = false`, cancel any pending timer, close the socket.

### 2.3 — Session Title Bug Fix
- [ ] **T024** `artifacts/api-server/src/lib/sshManager.ts` — Fix session title counter. Replace `sessions.size + 1` with a monotonically incrementing counter variable (`let sessionCounter = 0`) that is never decremented on session close.

### 2.4 — Graceful Shutdown
- [ ] **T025** `artifacts/api-server/src/index.ts` — Listen for `SIGTERM` and `SIGINT`. On receipt: close all active SSH sessions (iterate `listSessions()`, call `closeSession(id)` on each), then call `server.close()`. Log each step.

### 2.5 — Session Auto-Refresh (Mobile)
- [ ] **T026** `artifacts/mobile/app/(tabs)/terminal.tsx` — Add `refetchInterval: 5000` to the `useGetSessions` hook call so the sessions list auto-polls every 5 seconds without requiring a manual navigate-away.

### 2.6 — Offline Detection (Mobile)
- [ ] **T027** `artifacts/mobile/` — Install `@react-native-community/netinfo`. In `app/_layout.tsx`, subscribe to `NetInfo.addEventListener`. When `isConnected` becomes false, display a global banner: "No network connection" in `colors.destructive`. Dismiss when reconnected.

### 2.7 — Output Ring Buffer
- [ ] **T028** `artifacts/mobile/app/session/[sessionId].tsx` — Replace the unbounded `output: string` state with a ring buffer. Keep the last 5 000 lines maximum. When new data arrives: split by `\n`, append to a `lines: string[]` array, trim to the last 5 000 entries, re-join for display.

**Phase 2 complete when:** WebSocket auto-reconnects after a network drop, sessions list auto-refreshes, server cleans up dead connections, server shuts down gracefully.

---

## PHASE 3 — Feature Completion (Improvement Spec)
**Branch:** `phase3branch`  
**Goal:** Implement all 14 features from the Improvement & Feature Specifications.

### 3.1 — ANSI Color Rendering (Spec #12)
- [ ] **T029** `artifacts/mobile/` — Create `components/AnsiText.tsx`. Implement `parseAnsi(raw: string)` that splits on ANSI SGR sequences (`/\x1b\[[0-9;]*m/g`) and maps color codes to hex values (30-37 standard, 90-97 bright, 1=bold, 0=reset). Return `{ text, color?, bold? }[]`.
- [ ] **T030** `artifacts/mobile/components/AnsiText.tsx` — Use the color map defined in the spec: `30=#4d4d4d 31=#ff4444 32=#00ff88 33=#ffaa00 34=#5599ff 35=#cc44ff 36=#00ccff 37=#e0e0e0 90=#999999 91=#ff6666 92=#33ff99 93=#ffcc44 94=#77bbff 95=#dd77ff 97=#ffffff`. Reset (0) returns to `colors.primary` (`#00ff88`).
- [ ] **T031** `artifacts/mobile/app/session/[sessionId].tsx` — Replace the raw `<Text>{output}</Text>` with `<AnsiText lines={lines} fontSize={fontSize} />` that renders each segment with its parsed color and bold style.

### 3.2 — Terminal Font Size (Spec #13)
- [ ] **T032** `artifacts/mobile/` — Install `@react-native-async-storage/async-storage` if not already installed.
- [ ] **T033** `artifacts/mobile/app/session/[sessionId].tsx` — Add `fontSize` state (default 12). On mount, read from AsyncStorage key `terminal:fontSize`. Persist to AsyncStorage on every change.
- [ ] **T034** `artifacts/mobile/app/session/[sessionId].tsx` — Add A− and A+ buttons to the header row. Each press changes `fontSize` by ±1, clamped to [8, 20]. `lineHeight` should be `fontSize * 1.5`.

### 3.3 — Command History (Spec #2)
- [ ] **T035** `artifacts/mobile/app/session/[sessionId].tsx` — Add state: `history: string[]` (max 100 entries), `historyIndex: number` (−1 = not browsing). On send, push command to history and reset index to −1.
- [ ] **T036** `artifacts/mobile/app/session/[sessionId].tsx` — Add ▲ and ▼ buttons in the quick key bar. ▲ decrements `historyIndex` (or starts at `history.length − 1`), sets input to `history[historyIndex]`. ▼ increments index; if past the end, resets to −1 and clears input.

### 3.4 — Keep Screen Awake (Spec #4)
- [ ] **T037** `artifacts/mobile/` — Install `expo-keep-awake`.
- [ ] **T038** `artifacts/mobile/app/session/[sessionId].tsx` — Call `useKeepAwake()` at the top of the component. No other changes needed.

### 3.5 — Session Renaming (Spec #14)
- [ ] **T039** `artifacts/api-server/src/routes/sessions.ts` — Add `PATCH /sessions/:id` route. Body: `{ title: string }`. Find session by ID via `getSession(id)`. If not found, return 404. Update `session.title`. Return updated session `{ id, title, status, createdAt }`.
- [ ] **T040** `lib/api-spec/openapi.yaml` — Add `PATCH /sessions/{id}` operation with `requestBody: { title: string }` and `200` response schema matching `Session`.
- [ ] **T041** `lib/api-zod/src/schemas.ts` — Add `PatchSessionBody` Zod schema: `z.object({ title: z.string().min(1).max(100) })`.
- [ ] **T042** `lib/api-client-react/src/hooks.ts` — Add `usePatchSession()` mutation hook calling `PATCH /sessions/:id`.
- [ ] **T043** `artifacts/mobile/app/(tabs)/terminal.tsx` — Add `onLongPress` to each session card. On iOS, use `Alert.prompt` pre-filled with current title. On Android, show a modal with a `TextInput`. On confirm, call `usePatchSession` mutation, then invalidate sessions query.

### 3.6 — Multiple SSH Connection Profiles (Spec #9)
- [ ] **T044** `artifacts/api-server/src/lib/store.ts` — Change data model: `connection: ConnectionConfig | null` → `connections: ConnectionProfile[]`, `activeConnectionId: string | null`. Add `ConnectionProfile = ConnectionConfig & { id: string; name: string }`. Update `getActiveConnection()` to return the profile matching `activeConnectionId`.
- [ ] **T045** `artifacts/api-server/src/routes/connection.ts` — Add new routes: `GET /connections` (returns all profiles, passwords masked), `POST /connections` (creates profile, returns 201), `DELETE /connections/:id`, `POST /connections/:id/activate` (sets activeConnectionId), `GET /connections/active`.
- [ ] **T046** `lib/api-spec/openapi.yaml` — Add all new `/connections` endpoints and `ConnectionProfile` schema.
- [ ] **T047** `lib/api-zod/src/schemas.ts` — Add `ConnectionProfile` Zod schema.
- [ ] **T048** `lib/api-client-react/src/hooks.ts` — Add hooks: `useGetConnections`, `useCreateConnectionProfile`, `useDeleteConnectionProfile`, `useActivateConnectionProfile`, `useGetActiveConnection`.
- [ ] **T049** `artifacts/mobile/app/connection.tsx` — Replace single-profile form with a Connection Profiles list screen. Show all profiles with name, host, active badge. FAB opens Add Profile form (Name + Host + Port + Username + Password/Key). Tap to activate. Long-press to delete.

### 3.7 — SSH Key Authentication (Spec #10)
- [ ] **T050** `artifacts/mobile/app/connection.tsx` — Add auth mode toggle: "Password" / "SSH Key". When SSH Key is selected, show a tall multiline TextInput for PEM key (placeholder: `-----BEGIN OPENSSH PRIVATE KEY-----`) and an optional "Passphrase" field.
- [ ] **T051** `artifacts/api-server/src/lib/store.ts` — Add `privateKey?: string` and `passphrase?: string` to `ConnectionConfig` type. Persist them to `store.json`.
- [ ] **T052** Verify `sshManager.ts` already handles `privateKey`/`passphrase` (it does per the audit). If any code path is missing the conditional, add it.

### 3.8 — Process Search/Filter (Spec #11)
- [ ] **T053** `artifacts/mobile/app/(tabs)/processes.tsx` — Add `search: string` state. Add a search bar below the header: `TextInput` with Feather search icon left and X button right. Filter `processes` array to those where `name.toLowerCase().includes(search.toLowerCase())`. Pass filtered array to `FlatList`.
- [ ] **T054** `artifacts/mobile/app/(tabs)/processes.tsx` — Update count bar: when search is active, show "Showing N of M processes". When empty, show "N processes".

### 3.9 — Send Command to Session (Spec #8)
- [ ] **T055** `artifacts/mobile/app/(tabs)/commands.tsx` — Replace single onPress (copy) with an action sheet (use `Alert.alert` with multiple options or a bottom sheet modal). Options: "Copy to clipboard", "Send to session" (only shown if sessions exist).
- [ ] **T056** `artifacts/mobile/app/(tabs)/commands.tsx` — "Send to session": if one active session, navigate immediately to `session/[id]?prefill=<encoded command>`. If multiple sessions, show a second modal listing all sessions; on selection, navigate to that session.
- [ ] **T057** `artifacts/mobile/app/session/[sessionId].tsx` — On mount, read `prefill` query param. If present, put it in `input` state. If auto-send is desired, call `sendInput()` automatically.

### 3.10 — File Upload Streaming Fix (Spec #6)
- [ ] **T058** `artifacts/api-server/src/routes/files.ts` — Verify file upload uses `multer` with a memory storage limit of 100 MB. Add `multer({ storage: multer.memoryStorage(), limits: { fileSize: 100 * 1024 * 1024 } })`. If current implementation reads the entire body at once, confirm it won't OOM on large files (use streaming if needed).

**Phase 3 complete when:** All 14 improvement spec features are implemented, testable via the mobile app.

---

## PHASE 4 — Performance & Connection Pooling
**Branch:** `phase4branch`  
**Goal:** Eliminate redundant SSH connections. Reduce latency for file and process operations.

### 4.1 — Persistent SSH Connection for exec/SFTP
- [ ] **T059** `artifacts/api-server/src/lib/sshManager.ts` — Add a persistent "utility" SSH connection: `let utilityClient: SshClient | null = null`. Implement `getUtilityClient(): Promise<SshClient>` that returns the existing connected client if healthy, or creates a new one.
- [ ] **T060** `artifacts/api-server/src/lib/sshManager.ts` — Update `execCommand()` to use `getUtilityClient()` instead of opening a new client each call.
- [ ] **T061** `artifacts/api-server/src/lib/sshManager.ts` — Update `getSftp()` to use `getUtilityClient()` for the SFTP subsystem. Caller must not call `client.end()` anymore — refactor `getSftp` to return just `sftp` and handle cleanup internally.
- [ ] **T062** `artifacts/api-server/src/lib/sshManager.ts` — Handle utility client disconnect: on `utilityClient.on('error')` or `'end'`, set `utilityClient = null` so the next call reconnects.
- [ ] **T063** `artifacts/api-server/src/lib/sshManager.ts` — Extract `readyTimeout` into a module-level constant `READY_TIMEOUT = 15000` instead of repeating it in every connect options object.

### 4.2 — Session Output Buffering
- [ ] **T064** `artifacts/api-server/src/lib/wsHandler.ts` — Add output buffering: if the WebSocket is not ready (`ws.readyState !== WebSocket.OPEN`), buffer up to 64 KB of output. Flush the buffer on reconnect.

### 4.3 — File Listing Cache
- [ ] **T065** `lib/api-client-react/src/hooks.ts` — Set `staleTime: 10_000` (10 s) on `useListFiles` hook to reduce redundant SFTP directory reads when navigating back to a directory.

**Phase 4 complete when:** Listing processes and browsing files no longer open new SSH connections on each request (verify via server logs).

---

## PHASE 5 — DevOps & Deployment
**Branch:** `phase5branch`  
**Goal:** One-command start. CI passes. No binaries or secrets in the repo.

### 5.1 — Clean Repository
- [ ] **T066** Root `.gitignore` — Add `cloudflared.exe`, `*.log`, `ngrok.log`, `data/`, `node_modules/`, `dist/`, `.env`.
- [ ] **T067** Root — Remove `cloudflared.exe` from tracking: `git rm --cached cloudflared.exe`. Add `cloudflared.exe` to `.gitignore`.
- [ ] **T068** Root — Remove `ngrok.log` from tracking: `git rm --cached ngrok.log`.
- [ ] **T069** Root — Remove `package-lock.json` (npm lockfile conflicts with pnpm). Only `pnpm-lock.yaml` should exist.

### 5.2 — Environment Variables
- [ ] **T070** Root — Create `.env.example`:
  ```
  PORT=3000
  API_TOKEN=change_me
  ```
- [ ] **T071** `artifacts/mobile/` — Create `.env.example`:
  ```
  EXPO_PUBLIC_DOMAIN=http://localhost:3000
  EXPO_PUBLIC_API_TOKEN=change_me
  ```
- [ ] **T072** `artifacts/api-server/` — In `src/index.ts`, validate both `PORT` and `API_TOKEN` on startup. If `API_TOKEN` is not set, log a warning: `"API_TOKEN not set — running in unauthenticated mode"`.

### 5.3 — Docker
- [ ] **T073** `artifacts/api-server/Dockerfile` — Create a multi-stage Dockerfile: Stage 1 (`build`): Node 20-alpine, `pnpm install`, `pnpm build`. Stage 2 (`runtime`): Node 20-alpine, copy `dist/`, copy `node_modules/` for externalized packages (ssh2, ws), set `CMD ["node", "dist/index.mjs"]`.
- [ ] **T074** Root `docker-compose.yml` — Create a `docker-compose.yml` with the `api-server` service. Map port from `PORT` env var. Mount `./data` volume for persistence.
- [ ] **T075** Root `README.md` — Add "Docker" section with `docker compose up` quickstart.

### 5.4 — CI/CD (GitHub Actions)
- [ ] **T076** `.github/workflows/ci.yml` — Create CI pipeline triggered on `push` and `pull_request` to all branches. Jobs:
  - `lint`: Run `pnpm -r tsc --noEmit` to type-check all packages
  - `build-server`: Run `pnpm --filter api-server build` and verify `dist/index.mjs` exists
  - `validate-openapi`: Install `@redocly/cli`, run `redocly lint lib/api-spec/openapi.yaml`
- [ ] **T077** `.github/workflows/ci.yml` — Cache `node_modules` between runs using `actions/cache` keyed on `pnpm-lock.yaml` hash.

### 5.5 — Start Scripts
- [ ] **T078** Root `package.json` — Add workspace-level scripts: `"dev:server"`, `"build:server"`, `"dev:mobile"`. These should be aliases to the respective package scripts via `pnpm --filter`.
- [ ] **T079** `artifacts/api-server/package.json` — Ensure `"start"` script runs the built bundle: `"node dist/index.mjs"`. Ensure `"dev"` script runs `ts-node` or `tsx` for local development without a build step.
- [ ] **T080** Root `README.md` — Update quickstart to be a clean "clone → install → run" flow with 3 commands.

**Phase 5 complete when:** `docker compose up` starts the server. CI passes on push. No binaries or secrets committed.

---

## PHASE 6 — Observability & Error Handling
**Branch:** `phase6branch`  
**Goal:** Every failure is observable. No silent errors.

### 6.1 — Structured Error Responses
- [ ] **T081** `artifacts/api-server/src/app.ts` — Add a global Express error handler middleware (4-arg: `err, req, res, next`). Log the error with `logger.error`. Return `{ error: err.message, code: err.code || 'INTERNAL_ERROR' }` with status 500 (or `err.status` if set).
- [ ] **T082** `artifacts/api-server/src/routes/` — Replace all bare `res.status(500).json({ error: e.message })` patterns with `next(e)` to route to the global error handler.

### 6.2 — Request Logging
- [ ] **T083** `artifacts/api-server/src/app.ts` — Add `pino-http` middleware to log every request: method, url, status, response time. This replaces manual `logger.info` calls in each route.

### 6.3 — Health / Metrics Endpoint
- [ ] **T084** `artifacts/api-server/src/routes/health.ts` — Extend the health endpoint to return useful diagnostics: `{ status, activeSessions, connectionConfigured, uptimeSeconds }`. Keep response JSON only — no external metrics library needed.
- [ ] **T085** `artifacts/api-server/src/routes/health.ts` — If `API_TOKEN` is set, exempt `/health` from auth middleware so Docker health checks work without a token.

### 6.4 — Mobile Error Boundaries
- [ ] **T086** `artifacts/mobile/components/ErrorBoundary.tsx` — Verify the existing `ErrorBoundary` component renders a useful fallback UI (not just a blank screen). Add retry button that calls `this.setState({ hasError: false })`.
- [ ] **T087** `artifacts/mobile/app/(tabs)/` — Wrap each tab's root `View` with the `ErrorBoundary` so a crash in one tab does not take down the entire app.

### 6.5 — API Error Toasts (Mobile)
- [ ] **T088** `artifacts/mobile/app/_layout.tsx` — Add a global React Query `onError` default option: `queryClient.setDefaultOptions({ queries: { onError: (e) => showToast(e.message) } })`. Use `Alert.alert` as the toast for now.
- [ ] **T089** `artifacts/mobile/app/_layout.tsx` — Same for mutations: `mutations: { onError: (e) => showToast(e.message) }`.

**Phase 6 complete when:** Every API error returns structured JSON. Every request is logged. Mobile displays errors to the user rather than silently failing.

---

## PHASE 7 — Polish & UX Completion
**Branch:** `phase7branch`  
**Goal:** Every UX detail from the spec is implemented. App feels production-quality.

### 7.1 — Terminal UX
- [ ] **T090** `artifacts/mobile/app/session/[sessionId].tsx` — Add a "Clear" button (trash icon in the header already exists) that resets `lines` to `[]` and `output` to `""`.
- [ ] **T091** `artifacts/mobile/app/session/[sessionId].tsx` — Add horizontal scroll to the output area. Wrap the Text in a `ScrollView` with `horizontal` + `showsHorizontalScrollIndicator`. This allows wide terminal output (e.g., `ls -la`) to be readable.
- [ ] **T092** `artifacts/mobile/app/session/[sessionId].tsx` — Send terminal resize event (`{ cols, rows }`) to the backend when the device rotates. Backend should call `stream.setWindow(rows, cols)` via a new `resizeSession(id, rows, cols)` function in sshManager.
- [ ] **T093** `artifacts/api-server/src/lib/sshManager.ts` — Add `resizeSession(id: string, rows: number, cols: number): boolean` that calls `session.shell.setWindow(rows, cols, 0, 0)`.
- [ ] **T094** `artifacts/api-server/src/lib/wsHandler.ts` — Handle resize messages from the WebSocket client. When `ws.onmessage` receives a JSON string `{ type: 'resize', rows, cols }`, call `resizeSession(sessionId, rows, cols)`. Otherwise treat raw string as terminal input.

### 7.2 — Files UX
- [ ] **T095** `artifacts/mobile/app/(tabs)/files.tsx` — Add a "Rename" option to the long-press file action sheet (alongside Preview, Download, Delete). Call a new backend route `PATCH /files/rename` with `{ from, to }` paths.
- [ ] **T096** `artifacts/api-server/src/routes/files.ts` — Add `PATCH /files/rename`. Body: `{ from: string, to: string }`. Use SFTP `rename(from, to, callback)`. Return `{ success: true }`.
- [ ] **T097** `artifacts/mobile/app/(tabs)/files.tsx` — Show file size in human-readable form (KB, MB, GB) using a utility `formatBytes(n)` function.
- [ ] **T098** `artifacts/mobile/app/(tabs)/files.tsx` — Sort file listing: directories first, then files, both alphabetically. Apply this sort to the `data.items` array before passing to FlatList.

### 7.3 — Process UX
- [ ] **T099** `artifacts/mobile/app/(tabs)/processes.tsx` — Add sort options: by Name (A-Z), by CPU (desc), by Memory (desc). A segmented control or dropdown in the header.
- [ ] **T100** `artifacts/mobile/app/(tabs)/processes.tsx` — Show a loading skeleton (grey placeholder cards) while processes are fetching on first load.

### 7.4 — Connection UX
- [ ] **T101** `artifacts/mobile/app/connection.tsx` — After a successful "Test Connection", highlight the Save button with `colors.primary` background. Only enable Save if test has passed (optional — can also allow save without test).
- [ ] **T102** `artifacts/mobile/app/connection.tsx` — Show connection latency prominently (large number, e.g., "14 ms") in the test result banner.

### 7.5 — Accessibility
- [ ] **T103** `artifacts/mobile/` — Add `accessibilityLabel` props to all icon buttons (trash, copy, kill, gear icon). These are invisible to sighted users but required for screen readers.
- [ ] **T104** `artifacts/mobile/` — Add `accessibilityRole="button"` to all `TouchableOpacity` elements that act as buttons.

**Phase 7 complete when:** All UX polish items are done. App navigated end-to-end without any rough edges.

---

## PHASE 8 — Testing
**Branch:** `phase8branch`  
**Goal:** Core logic has test coverage. CI runs tests.

### 8.1 — Backend Unit Tests
- [ ] **T105** `artifacts/api-server/` — Install `vitest` and `@vitest/coverage-v8` as dev dependencies.
- [ ] **T106** `artifacts/api-server/src/lib/__tests__/store.test.ts` — Write tests for `store.ts`: `setConnection/getConnection` persist and return values, `addCommand/removeCommand` maintain array correctly, IDs are unique.
- [ ] **T107** `artifacts/api-server/src/lib/__tests__/auth.test.ts` — Write tests for `auth.ts` middleware: blocks requests without token, allows requests with correct token, skips auth when `API_TOKEN` env var is unset.
- [ ] **T108** `artifacts/api-server/src/routes/__tests__/processes.test.ts` — Write test: invalid PID returns 400. Valid PID format passes validation.
- [ ] **T109** `artifacts/api-server/src/routes/__tests__/files.test.ts` — Write test: path with `..` returns 400. Valid paths pass.

### 8.2 — Backend Integration Tests
- [ ] **T110** `artifacts/api-server/src/__tests__/health.integration.test.ts` — Spin up the Express app in-process (no real SSH needed) and test: GET /health returns 200 with correct shape, GET /sessions returns 200 with `[]`, GET /commands returns 200 with `[]`.

### 8.3 — CI Integration
- [ ] **T111** `.github/workflows/ci.yml` — Add a `test` job: runs `pnpm --filter api-server test` and reports coverage.
- [ ] **T112** `.github/workflows/ci.yml` — Set `continue-on-error: false` so test failures block the build.

**Phase 8 complete when:** `pnpm --filter api-server test` passes. All test jobs pass in CI.

---

## PHASE 9 — Documentation Sync
**Branch:** `phase9branch`  
**Goal:** All docs reflect the current state of the code. Nothing is stale.

- [ ] **T113** `README.md` — Full rewrite to reflect: project description, architecture diagram (text), prerequisites, quickstart (3 steps), env vars table, Docker instructions, development workflow.
- [ ] **T114** `RemoteCliControl.md` — Update with all new routes added in phases 1–7 (PATCH /sessions/:id, PATCH /files/rename, GET /connections, POST /connections, etc.).
- [ ] **T115** `lib/api-spec/openapi.yaml` — Final audit: ensure every route in the codebase has a corresponding OpenAPI operation. Remove any spec operations that no longer exist in code.
- [ ] **T116** Root — Create `ARCHITECTURE.md`: one-page system diagram (text art), data flow (mobile → API → SSH → Windows), component responsibilities, key design decisions.
- [ ] **T117** Root — Create `CONTRIBUTING.md`: branch naming convention, how to run locally, how to regenerate API client, how to run tests.
- [ ] **T118** `RemoteCTRL — Improvement & Feature Specifications.md` — Mark each of the 14 improvements as [x] DONE (or note any intentional deviations).

---

## PHASE 10 — Final QA & Audit Prep
**Branch:** `phase10branch`  
**Goal:** Every task is done. System is ready for Orchestrator audit.

- [ ] **T119** End-to-end manual test: start server, connect to a real Windows machine via SSH, open a terminal session, type commands, verify ANSI colors, resize terminal, check command history.
- [ ] **T120** End-to-end manual test: browse files, preview a text file, download a file, upload a file, create a folder, rename a file, delete a file.
- [ ] **T121** End-to-end manual test: create two SSH profiles, switch between them, verify active session uses the correct profile.
- [ ] **T122** End-to-end manual test: use SSH key auth — paste a PEM key, connect, verify it works.
- [ ] **T123** Restart the server mid-session. Verify: credentials survive, saved commands survive, mobile auto-reconnects the WebSocket.
- [ ] **T124** `pnpm -r tsc --noEmit` — must pass with zero errors across all packages.
- [ ] **T125** `pnpm --filter api-server test` — all tests pass.
- [ ] **T126** CI green on the `phase10branch` push.
- [ ] **T127** Run `redocly lint lib/api-spec/openapi.yaml` — must pass with zero errors.
- [ ] **T128** Verify `.gitignore` excludes: `node_modules/`, `dist/`, `data/`, `*.log`, `*.exe`, `.env`.
- [ ] **T129** Run `git status` — working tree must be clean (all changes committed).

---

## TASK SUMMARY

| Phase | Tasks | Focus |
|---|---|---|
| Phase 1 | T001–T018 | Security + Persistent Storage |
| Phase 2 | T019–T028 | Reliability + WebSocket |
| Phase 3 | T029–T058 | All 14 Improvement Spec Features |
| Phase 4 | T059–T065 | Performance + Connection Pooling |
| Phase 5 | T066–T080 | DevOps + CI/CD + Docker |
| Phase 6 | T081–T089 | Observability + Error Handling |
| Phase 7 | T090–T104 | UX Polish |
| Phase 8 | T105–T112 | Testing |
| Phase 9 | T113–T118 | Documentation |
| Phase 10 | T119–T129 | Final QA |
| **TOTAL** | **129 tasks** | |

---

## DONE STATE

The system reaches DONE STATE when:
- All 129 tasks are marked [x]
- TypeScript compiles clean
- All tests pass
- CI is green
- No P0 or P1 issues remain (see audit)
- Server starts from a clean clone in one command
- Docs match the code
