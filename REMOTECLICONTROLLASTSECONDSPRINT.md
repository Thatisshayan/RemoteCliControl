# RemoteCTRL — Last Second Sprint
**Orchestrator:** Claude (Principal Engineer)
**Builder:** Kilo (Builder Agent)
**Created:** 2026-06-28
**Goal:** Take RemoteCTRL from 6.5/10 → 10/10. Production-shipped iOS app, remote access built-in, bulletproof reliability, approved design.

---

## BUILDER RULES

1. **Read before you build.** Read `RemoteCliControl.md`, `ARCHITECTURE.md`, and the current code before touching anything.
2. **UI/UX gate is absolute.** You do NOT write a single line of mobile UI code until the Orchestrator has approved your Figma mockups. No exceptions.
3. **Windows only.** The backend runs on Windows. The iOS build uses EAS Build (cloud). No Mac required. Never instruct the user to do anything that requires macOS locally.
4. **Remote access first.** Cloudflare Tunnel must work before any other phase begins — it unlocks testing from a real phone on a real network.
5. **Branch per phase.** `lastsprintphase1branch`, `lastsprintphase2branch`, etc. Do NOT merge to `main` yourself. The Orchestrator audits and merges.
6. **No code in design phases.** Phases 1 and 2 produce docs and Figma links — no source code changes.
7. **Token-saving mode ON.** Report results, not intentions.
8. **After each phase:** `pnpm -r tsc --noEmit` must pass → commit → push phase branch.

---

## CONTEXT: WHERE WE ARE

### What exists today (on `main`)
- Express 5 backend (Node.js 20, TypeScript, ssh2, ws, pino)
- React Native / Expo SDK 54 mobile app — **runs in Expo Go only** (not a compiled iOS app)
- SSH terminal, file browser, process manager, saved commands
- Multi-profile SSH, SSH key auth, ANSI colors, command history, auto-reconnect
- Bearer token auth, rate limiting, path/PID validation, persistent JSON store
- Docker, GitHub Actions CI, 18 backend unit tests

### Current score: 6.5 / 10

| Dimension | Score | Blockers |
|---|---|---|
| Security | 7.5 | No HTTPS enforcement, no brute-force lockout |
| Reliability | 7 | Sessions lost on server restart; no retry queue |
| Features | 8 | No push notifications, no remote access built-in |
| Performance | 6 | No pagination, no lazy loading, no caching layer |
| Testing | 3 | Zero mobile tests, zero E2E tests |
| Production readiness | 4 | No App Store, no remote access, no monitoring |
| UX polish | 6 | No onboarding, no error recovery flows |

### What 10 / 10 looks like
- Compiled native iOS app (TestFlight → App Store)
- Cloudflare Tunnel auto-starts with the server — phone reaches PC from anywhere
- HTTPS end-to-end (tunnel provides this automatically)
- Biometric unlock (Face ID / Touch ID) to open the app
- Beautiful, approved design (Figma-approved before any pixel is coded)
- E2E test suite (Maestro or Detox)
- Production monitoring and health alerts
- Onboarding flow for first-time users
- Push notifications for long-running commands

---

## PHASE EXECUTION ORDER

```
Phase 1  →  Remote Access (Cloudflare Tunnel — built-in, automatic)
Phase 2  →  UI/UX Design + Figma (GATE: Orchestrator must approve before Phase 3)
Phase 3  →  Mobile UI Rebuild (implement approved Figma designs)
Phase 4  →  iOS App Compilation (EAS Build → TestFlight)
Phase 5  →  Security Hardening II (HTTPS, biometric, brute-force protection)
Phase 6  →  Reliability II (session persistence, retry queue, push notifications)
Phase 7  →  Performance (pagination, lazy loading, file list caching)
Phase 8  →  E2E Testing (Maestro test suite)
Phase 9  →  Production Monitoring (health alerts, uptime, error tracking)
Phase 10 →  Final QA + App Store Prep
```

---

## PHASE 1 — Remote Access (Cloudflare Tunnel)
**Branch:** `lastsprintphase1branch`
**Goal:** Phone reaches the PC backend from any network, automatically, with HTTPS. Zero manual steps for the user after first setup.

### Why Cloudflare Tunnel
The phone and PC are not always on the same Wi-Fi. The PC is on Windows, so a VPN or port-forwarding setup is too complex for most users. Cloudflare Tunnel (`cloudflared`) creates a secure HTTPS tunnel from the internet to the local server — no router config, no static IP, no firewall rules needed. The tunnel URL is stable as long as the tunnel is authenticated.

`cloudflared.exe` is already in the repo root (currently gitignored). The goal is to make it **start automatically** with the backend and **expose the tunnel URL** to the mobile app without any manual copy-paste.

### Tasks

#### T-R01 — Cloudflare Tunnel integration in `artifacts/api-server/src/index.ts`
On server startup, after `app.listen()` succeeds:
1. Check if `CLOUDFLARE_TUNNEL` env var is set to `"true"` or `"1"`. If not set, skip tunnel (local dev mode).
2. Spawn `cloudflared.exe tunnel --url http://localhost:<PORT>` as a child process using Node.js `child_process.spawn`.
3. Parse the tunnel URL from cloudflared's stderr output. The URL appears in a line like: `INF | Your quick Tunnel has been created! Visit it at (it's yours!): https://xxxx.trycloudflare.com`.
4. Once the URL is captured, log it prominently: `logger.info({ tunnelUrl }, "Cloudflare Tunnel active")`.
5. Write the tunnel URL to `data/tunnel-url.txt` so the mobile app and admin can read it without re-parsing logs.
6. On server shutdown (SIGTERM/SIGINT), kill the cloudflared child process before `server.close()`.

Do NOT commit `cloudflared.exe` to git. It must stay in `.gitignore`. The README will instruct the user to download it.

#### T-R02 — Tunnel URL API endpoint
Add `GET /tunnel-url` (no auth required, same as `/health`) that returns:
```json
{ "tunnelUrl": "https://xxxx.trycloudflare.com", "active": true }
```
If tunnel is not running, return `{ "tunnelUrl": null, "active": false }`.

This endpoint lets the mobile app's onboarding screen auto-discover the tunnel URL — the user just needs to scan a QR code or share the URL once.

#### T-R03 — Environment variable documentation
Add `CLOUDFLARE_TUNNEL=true` to `.env.example` with a comment explaining it. Add `TUNNEL_URL_PATH` (optional, defaults to `./data/tunnel-url.txt`) so advanced users can configure the path.

#### T-R04 — `cloudflared.exe` download instruction in README
Add a "Remote Access Setup" section to `README.md`:
1. Download `cloudflared.exe` from `https://github.com/cloudflare/cloudflared/releases` and place it in the repo root.
2. Set `CLOUDFLARE_TUNNEL=true` in `.env`.
3. Start the server — the tunnel URL appears in the console and in `data/tunnel-url.txt`.
4. Set `EXPO_PUBLIC_DOMAIN=<tunnel URL>` in `artifacts/mobile/.env`.
5. Rebuild the mobile app with the new domain.

#### T-R05 — Update `.gitignore`
Ensure `data/tunnel-url.txt` is gitignored (add it if not already covered by `data/`).

#### T-R06 — Update `ARCHITECTURE.md`
Add a "Remote Access" section explaining the Cloudflare Tunnel integration architecture: how the process is spawned, how the URL is captured, how it is surfaced to the mobile app.

**Phase 1 complete when:** Server starts with `CLOUDFLARE_TUNNEL=true`, tunnel URL is logged and written to file, `GET /tunnel-url` returns the URL, TypeScript compiles clean.

---

## PHASE 2 — UI/UX Design + Figma
**Branch:** `lastsprintphase2branch`
**⛔ HARD GATE: No mobile code until the Orchestrator approves the Figma file.**

### Goal
Design a polished, production-quality iOS UI for RemoteCTRL in Figma. The design must be approved by the Orchestrator before a single component is touched in Phase 3.

### Design Constraints
- **Platform:** iOS-first (iPhone). iPad layout in a later sprint.
- **Dark mode only** — existing color system must be respected:
  - Background: `#0d0d0d` · Card: `#1a1a1a` · Primary accent: `#00ff88` · Destructive: `#ff4444` · Warning: `#ffaa00`
  - Font: Inter (400/500/600/700)
- **No light mode.** Do not design light mode variants.
- **No web conventions.** This is a native mobile app — use iOS patterns (swipe-to-delete, sheets, native alerts, safe area insets).
- **Accessibility first.** All interactive elements must have a minimum tap target of 44×44pt. All icons must have `accessibilityLabel`.

### Screens to Design

The builder must produce Figma frames for every screen listed below. Each frame must include:
- The exact layout at iPhone 15 Pro dimensions (393×852pt)
- All states: empty state, loading state, error state, populated state
- All modals and bottom sheets
- Transition annotations (what gesture or tap triggers what)

#### Screen 1 — Onboarding (NEW)
First-launch experience. Three steps:
1. Welcome screen — app name, tagline, "Get Started" button
2. Backend setup — explains what the server is, shows the command to run it, has a "Server URL" text field for the user to paste the domain or tunnel URL, and a "Test Connection" button
3. API token setup — explains what API_TOKEN is, has a field for the token, "Skip for now" option

#### Screen 2 — Connection Profiles (redesign)
The existing connection screen needs to be redesigned as a proper profile manager:
- List of saved SSH profiles (name, host, active badge)
- Swipe-to-delete on each row
- FAB to add new profile
- Add Profile sheet: Name, Host, Port, Username, auth mode toggle (Password / SSH Key), password or PEM key field, Test Connection button with latency result, Save button

#### Screen 3 — Terminal Tab (redesign)
Session list:
- Each session card: session name (large), status pill (Connected / Connecting / Error / Disconnected), created-at time, close button
- Empty state: illustration + "No active sessions" + "New Session" button
- FAB to create session

#### Screen 4 — Terminal Session (redesign)
Full-screen terminal — the most important screen:
- Output area: full screen, scrollable, monospace, ANSI colors
- Header: back button, session name, status dot, A−/A+ font buttons, Clear button
- Quick key bar (fixed above keyboard): Tab · Ctrl+C · Ctrl+D · ▲ history · ▼ history
- Input bar (above keyboard): text field + Send button
- Reconnect banner (appears at top when reconnecting): amber background, "Reconnecting (N/10)..."
- Resize annotation: document that the screen sends resize on rotation

#### Screen 5 — File Browser (redesign)
- Breadcrumb bar at top (horizontal scroll if deep path)
- File/folder rows: icon (green folder / file type icon), name, size, date
- Swipe-to-delete on rows
- Long-press action sheet: Preview / Download / Rename / Delete
- Header: path label, new-folder button, upload button
- Empty state: "Empty directory" with folder illustration
- Preview modal (pageSheet): file name, scrollable monospace content, close button

#### Screen 6 — Process Manager (redesign)
- Search bar (sticky, below header)
- Process card: name (bold), PID, CPU bar with color coding, memory (MB), status badge
- Count bar: "N processes" or "Showing N of M"
- Kill confirmation: action sheet, not Alert (iOS native destructive action)
- Empty/loading state

#### Screen 7 — Commands (redesign)
- Command cards: label, command text (green monospace), description
- Long-press or swipe to delete
- Tap: bottom action sheet — Copy / Send to Session / Cancel
- Send to Session picker (if multiple sessions): session list sheet
- FAB → Add Command sheet: Label, Command (multiline), Description

#### Screen 8 — Settings (NEW)
Currently there is no settings screen. Design one accessible from a gear icon in the navigation:
- Backend URL (editable, with "Test" button)
- API Token (editable, masked, with eye toggle)
- Cloudflare Tunnel status (shows tunnel URL if active, or "Inactive")
- Biometric lock toggle (Face ID / Touch ID)
- Terminal defaults: font size slider, line height
- App version and "Clear local data" option

### Figma Deliverables
1. One Figma file with all 8 screens × all states
2. A components page: color styles, text styles, common components (cards, badges, buttons, inputs, action sheets)
3. Prototype connections for primary user flows: Onboarding → Connection Profile → New Session → Terminal → Send Command
4. Share the Figma link with the Orchestrator

**Phase 2 complete when:** Figma link is shared with the Orchestrator and all 8 screens × all states are present. The Orchestrator reviews and approves (or sends revision requests). No code is written in this phase.

---

## PHASE 3 — Mobile UI Rebuild
**Branch:** `lastsprintphase3branch`
**⛔ PREREQUISITE: Orchestrator must have approved Phase 2 Figma before this phase begins.**

### Goal
Implement every approved Figma screen pixel-for-pixel in the React Native / Expo codebase. This is a visual rebuild — no new backend routes in this phase.

### Tasks

#### T-U01 — Onboarding flow
Create `artifacts/mobile/app/onboarding/` with three step screens. Use `AsyncStorage` to track whether onboarding has been completed. If completed, skip directly to tabs. If not, show onboarding first.

Step 1 — Welcome: static screen.
Step 2 — Backend setup: `TextInput` for backend URL, "Test Connection" button (calls existing `/health` endpoint), shows latency on success. On success, save URL to `AsyncStorage` key `"server-url"` and call `setBaseUrl()`.
Step 3 — API Token: `TextInput` for token (masked), "Skip" option. Save to `AsyncStorage` key `"api-token"` and call `setApiToken()`.

Do NOT hard-code `EXPO_PUBLIC_DOMAIN` as the only source of backend URL. After onboarding, the user-entered URL takes priority.

#### T-U02 — Settings screen
Create `artifacts/mobile/app/settings.tsx`. Wire to gear icon in tab bar header. Implement all fields from Figma Screen 8:
- Backend URL field (read from/write to AsyncStorage, calls `setBaseUrl()` on save)
- API Token field
- Biometric lock toggle (placeholder for Phase 5 implementation)
- Cloudflare Tunnel status (calls `GET /tunnel-url`)
- Terminal font size slider (reads/writes AsyncStorage `"terminal-font-size"`)
- App version (from `expo-constants`)
- Clear local data (clears AsyncStorage, navigates to onboarding)

#### T-U03 — Redesign all 6 existing screens
Implement every approved Figma frame exactly. The screens are:
- `app/connection.tsx` → Connection Profiles (Screen 2)
- `app/(tabs)/terminal.tsx` → Session list (Screen 3)
- `app/session/[sessionId].tsx` → Terminal (Screen 4)
- `app/(tabs)/files.tsx` → File Browser (Screen 5)
- `app/(tabs)/processes.tsx` → Process Manager (Screen 6)
- `app/(tabs)/commands.tsx` → Commands (Screen 7)

#### T-U04 — Component library
Create `artifacts/mobile/components/ui/`:
- `Card.tsx` — standard card container
- `Badge.tsx` — status badge (color + label)
- `ActionSheet.tsx` — bottom action sheet component (do not use `Alert.alert` for destructive actions — use a proper bottom sheet)
- `SearchBar.tsx` — search input with icon and clear button
- `EmptyState.tsx` — illustration + message + optional CTA button
- `LoadingState.tsx` — skeleton placeholder cards

#### T-U05 — Navigation update
Add a fifth tab: **Settings** (gear icon). Update `app/(tabs)/_layout.tsx`.

#### T-U06 — TypeScript + visual verification
After every screen is rebuilt:
1. `pnpm -r tsc --noEmit` must pass
2. Test each screen in Expo Go — verify it matches the approved Figma design
3. Test on both iPhone SE (small) and iPhone 15 Pro (large) viewport sizes

**Phase 3 complete when:** All 8 screens rebuilt and matching Figma. TypeScript clean. No regressions in existing functionality.

---

## PHASE 4 — iOS App Compilation (EAS Build → TestFlight)
**Branch:** `lastsprintphase4branch`
**Platform note:** This entire phase runs on Windows. No Mac required. EAS Build compiles in Expo's cloud infrastructure.

### Goal
Produce a real compiled iOS `.ipa` file distributed via TestFlight. The user should be able to install RemoteCTRL as a standalone app — no Expo Go needed.

### Prerequisites (builder must verify before starting)
- Expo account exists (free) at `expo.dev`
- Apple Developer Program membership ($99/year) — **ask the Orchestrator if this exists before proceeding**
- `eas-cli` installed: `npm install -g eas-cli`

### Tasks

#### T-I01 — EAS project setup
```bash
cd artifacts/mobile
eas login
eas build:configure
```
This generates `eas.json` in `artifacts/mobile/`. Add it to git.

#### T-I02 — `app.json` / `app.config.js` update
Verify `artifacts/mobile/app.json` has:
- `expo.ios.bundleIdentifier`: set to `com.remotectrl.app` (or the user's preferred bundle ID — ask Orchestrator)
- `expo.name`: `RemoteCTRL`
- `expo.version`: `1.0.0`
- `expo.ios.supportsTablet`: `false` (iPhone only for now)
- `expo.ios.infoPlist.NSFaceIDUsageDescription`: `"RemoteCTRL uses Face ID to protect your SSH credentials"`

#### T-I03 — EAS build profiles in `eas.json`
Configure three profiles:
- `development`: `developmentClient: true`, simulator build for local testing
- `preview`: TestFlight distribution, `distribution: "internal"`
- `production`: App Store distribution, `distribution: "store"`

#### T-I04 — Environment variable strategy for production
In Expo Go, `EXPO_PUBLIC_DOMAIN` can be set at runtime via `.env`. In a compiled app it is baked in at build time. The onboarding flow (T-U01) solves this — the user enters the backend URL on first launch. Verify that the compiled app uses the AsyncStorage URL, not the build-time env var.

#### T-I05 — TestFlight build
```bash
cd artifacts/mobile
eas build --platform ios --profile preview
```
This submits a cloud build. Monitor via `eas build:list`. When complete, download the `.ipa` or submit directly to TestFlight:
```bash
eas submit --platform ios --profile preview
```

#### T-I06 — TestFlight distribution
In App Store Connect:
1. Add the `.ipa` to TestFlight
2. Add the Orchestrator (and any testers) as internal testers
3. Verify the app installs and the onboarding flow works end-to-end

#### T-I07 — Document the build process
Add a `BUILDING.md` to the repo root with the exact commands to produce a new build. This must be reproducible on Windows from a fresh clone.

**Phase 4 complete when:** App installs from TestFlight on an iPhone, connects to the backend via Cloudflare Tunnel URL entered in onboarding, and all features work without Expo Go.

---

## PHASE 5 — Security Hardening II
**Branch:** `lastsprintphase5branch`

### Goal
Close the remaining security gaps to make the app safe for real-world use.

### Tasks

#### T-S01 — HTTPS enforcement
The Cloudflare Tunnel already provides HTTPS. Add a check in `src/index.ts`: if `NODE_ENV=production` and `CLOUDFLARE_TUNNEL` is not set, log a prominent warning: `"Running without HTTPS in production mode — connections are not encrypted"`. Do not block startup, but make the warning impossible to miss.

#### T-S02 — Brute-force lockout on API token
In `src/lib/auth.ts`: track failed auth attempts per IP address. After 5 failed attempts within 15 minutes, return 429 and lock out that IP for 15 minutes. Use an in-memory Map (no external dependency needed). Reset counter on successful auth.

#### T-S03 — Biometric unlock on iOS (Face ID / Touch ID)
In the mobile app, after Phase 4 is compiled, add `expo-local-authentication`:
- On app foreground (AppState change from `background` → `active`), if biometric lock is enabled in settings, show an authentication prompt before revealing any content
- On auth failure: show locked screen with retry option
- Biometric lock setting: stored in AsyncStorage, toggled from Settings screen (T-U02)

#### T-S04 — Session token rotation
Currently `API_TOKEN` is static and never rotates. Add an optional `GET /api/admin/rotate-token` endpoint that generates a new token, updates the environment (writes to `.env` file), and returns the new token. Protected by the current token. Document this endpoint in `ARCHITECTURE.md`.

#### T-S05 — Content Security Policy header
Add `helmet` middleware to `app.ts`: `app.use(helmet())`. This adds standard security headers (X-Content-Type-Options, X-Frame-Options, etc.) with zero configuration.

#### T-S06 — Input length limits on all endpoints
Audit every `router.post` and `router.patch` — ensure every string field has a max-length check. Specifically:
- `label` (commands): max 100 chars
- `command` (commands): max 2000 chars
- `title` (sessions): max 100 chars
- `name` (connection profiles): max 100 chars

**Phase 5 complete when:** Brute-force lockout tested (5 bad tokens → 429), helmet headers present in response, all input limits enforced, TypeScript clean.

---

## PHASE 6 — Reliability II
**Branch:** `lastsprintphase6branch`

### Goal
Sessions survive server restarts. Long-running operations notify the user even when the app is in the background.

### Tasks

#### T-RL01 — Command output push notifications
This is the most-requested reliability feature: "I ran `npm install` and put my phone down — how do I know when it's done?"

Add an optional push notification when a command completes. Use **Expo Push Notifications** (`expo-notifications`):
1. Request notification permission in the onboarding flow (Step 3 or a new Step 4)
2. Store the Expo Push Token on the backend via a new `POST /api/push-token` endpoint (saved in store)
3. In `wsHandler.ts`, detect when output contains a shell prompt pattern (e.g., `>` at the end of a line for PowerShell, or `$` for bash) after a period of activity — this heuristic signals command completion
4. Send a push notification: "Command completed on <profile name>"
5. Keep this opt-in. If no push token is registered, skip silently.

#### T-RL02 — Command queue / retry
In the mobile terminal, if `sendToSession` is called while `ws.readyState !== OPEN` (i.e., during reconnect), buffer the input locally and replay it when the connection is re-established.

#### T-RL03 — Server uptime display
In the Settings screen's "Tunnel Status" section, also show `uptimeSeconds` from `GET /health`, formatted as "Server up: 2h 34m".

#### T-RL04 — Graceful session restoration hint
After a server restart, the SSH sessions are gone (they are in-memory). When the mobile app loads and finds zero sessions but there were sessions before (detected from the session list going from N > 0 to 0), show a non-blocking toast: "Server was restarted — your sessions were closed." This prevents user confusion.

**Phase 6 complete when:** Push notifications received on a real iPhone after a command completes, reconnect input buffering works through a simulated network drop.

---

## PHASE 7 — Performance
**Branch:** `lastsprintphase7branch`

### Goal
App feels instant even with large file trees and many processes.

### Tasks

#### T-P01 — File list pagination
`GET /api/files` currently returns the entire directory contents in one response. Add optional `?limit=100&offset=0` query params. On the mobile side, implement infinite scroll in the files tab: load the first 100 items, append more as the user scrolls to the bottom.

#### T-P02 — Process list virtualization
The process list can have 200+ items. Ensure `FlatList` has `windowSize={5}`, `maxToRenderPerBatch={20}`, `initialNumToRender={15}`, and `removeClippedSubviews={true}`. Do not use `ScrollView` + `map()` for long lists.

#### T-P03 — File stat batching
Currently `GET /api/files` calls `sftp.stat()` individually for each item in a directory to get its type. Change to a single `sftp.readdir()` with the `attrs` option (ssh2 supports this via `OPENDIR` + `READDIR` with attributes) so stat data comes back in one SFTP round-trip instead of N.

#### T-P04 — Increase file listing cache duration
In `lib/api-client-react/src/hooks.ts`, the `useListFiles` hook has `staleTime: 10_000`. Increase to `staleTime: 30_000` (30 s). Add `cacheTime: 60_000` (1 min). This reduces redundant SFTP reads when navigating between directories.

#### T-P05 — Image / binary file detection
Before calling `GET /api/files/read` for a preview, check the file extension. If the extension is `.png`, `.jpg`, `.jpeg`, `.gif`, `.webp`, `.mp4`, `.zip`, `.exe`, `.pdf`, or any other known binary type — show "Binary file — download to view" instead of attempting a text read.

**Phase 7 complete when:** Files tab with a directory of 500 items loads in under 2 seconds on a real device. Process list of 200+ processes scrolls at 60fps.

---

## PHASE 8 — E2E Testing (Maestro)
**Branch:** `lastsprintphase8branch`

### Goal
Automated end-to-end tests that run on a real or simulated iOS device and verify the golden paths.

### Why Maestro
Maestro is the simplest E2E test framework for React Native. Tests are written in YAML (no code), it runs on Windows, and it supports both Simulator and real device. It does not require macOS for running the test suite against a connected device.

### Tasks

#### T-T01 — Maestro setup
Install Maestro CLI: follow https://maestro.mobile.dev/getting-started/installing-maestro. Document the Windows installation steps in `CONTRIBUTING.md`. Create `.maestro/` directory in repo root.

#### T-T02 — Flow: Onboarding
```
.maestro/flows/onboarding.yaml
```
Steps: launch app → verify "Welcome to RemoteCTRL" visible → enter backend URL → tap "Test Connection" → verify success banner → enter API token → tap "Continue" → verify tabs are visible.

#### T-T03 — Flow: Create SSH session
```
.maestro/flows/create-session.yaml
```
Steps: tap Terminal tab → tap "+" FAB → verify session card appears with "connecting" status → wait for "connected" status → tap session → verify terminal screen opens.

#### T-T04 — Flow: Send command
```
.maestro/flows/send-command.yaml
```
Steps: (starting from terminal screen) → type "dir" in input → tap Send → verify output is non-empty.

#### T-T05 — Flow: File browser
```
.maestro/flows/file-browser.yaml
```
Steps: tap Files tab → verify file list loads → tap a folder → verify navigation updates breadcrumb → tap back → verify return to parent.

#### T-T06 — Flow: Process search
```
.maestro/flows/process-search.yaml
```
Steps: tap Processes tab → verify list loads → type "node" in search bar → verify list filters.

#### T-T07 — CI integration
Add a Maestro test job to `.github/workflows/ci.yml` that runs on a macOS GitHub Actions runner (required for iOS Simulator). This job:
1. Starts the backend server
2. Builds the Expo app for Simulator
3. Launches the Simulator
4. Runs `maestro test .maestro/flows/`

**Phase 8 complete when:** All 6 Maestro flows pass on iOS Simulator in CI.

---

## PHASE 9 — Production Monitoring
**Branch:** `lastsprintphase9branch`

### Goal
Know when the server goes down before the user notices. Get error alerts automatically.

### Tasks

#### T-M01 — Uptime monitoring endpoint hardening
`GET /health` currently returns basic info. Extend it to also return:
- `tunnelUrl`: from the tunnel state (null if not running)
- `memoryUsageMb`: `process.memoryUsage().rss / 1024 / 1024`
- `nodeVersion`: `process.version`
- `buildVersion`: read from `package.json` version field

#### T-M02 — Error rate tracking
In the global error handler (`app.ts`), increment an in-memory counter per error type. Add `GET /api/admin/stats` (bearer token protected) that returns:
- `errorCounts`: `{ [errorCode]: count }` since last restart
- `requestCount`: total requests handled
- `uptimeSeconds`
Reset counters never — they are per-process lifetime.

#### T-M03 — Betteruptime / UptimeRobot integration doc
Add a section to `README.md` — "Monitoring Setup":
Instructions for setting up a free external uptime monitor pointing at `GET /health` (via the Cloudflare Tunnel URL). If the server goes down, the user gets an email/SMS alert. Do not integrate a specific service in code — just document the setup for UptimeRobot (free tier) and Betteruptime.

#### T-M04 — Mobile Settings: server status widget
In the Settings screen, add a "Server Status" card that calls `GET /health` every 30 seconds and displays:
- Online / Offline indicator (green/red)
- Uptime formatted: "Up 2h 34m"
- Active sessions count
- Memory usage in MB
- Tunnel URL (tappable — copies to clipboard)

**Phase 9 complete when:** `GET /health` returns all new fields, `GET /api/admin/stats` returns error counts, Settings shows live server status.

---

## PHASE 10 — Final QA + App Store Prep
**Branch:** `lastsprintphase10branch`

### Goal
Ship it. App Store submission ready. All documentation updated. Clean repo.

### Tasks

#### T-Q01 — App Store metadata
Create `artifacts/mobile/store/` containing:
- `description.txt`: App Store description (max 4000 chars)
- `keywords.txt`: App Store keywords (max 100 chars)
- `privacy-policy-url.txt`: URL to a privacy policy (required for App Store) — even a simple one hosted on GitHub Pages
- `support-url.txt`: Support URL (GitHub Issues link is fine)

#### T-Q02 — App Store screenshots
Using the approved Figma designs, export App Store screenshots at iPhone 15 Pro dimensions (1179×2556px) for the required App Store sizes:
- 6.7" display (iPhone 15 Pro Max)
- 6.1" display (iPhone 15 Pro)
Place them in `artifacts/mobile/store/screenshots/`.

#### T-Q03 — App icon
Create a 1024×1024px app icon following Apple Human Interface Guidelines:
- No rounded corners (App Store adds them)
- No transparency
- Must look good at all sizes (1024px down to 20px)
Design in Figma. Export as `artifacts/mobile/store/icon-1024.png`.

#### T-Q04 — Production EAS build
```bash
cd artifacts/mobile
eas build --platform ios --profile production
eas submit --platform ios --profile production
```

#### T-Q05 — Final documentation sync
Update every doc file to reflect the final shipped state:
- `README.md`: update quickstart to reference the TestFlight link, add monitoring section
- `ARCHITECTURE.md`: add Phase 4–9 additions
- `CONTRIBUTING.md`: add Maestro test instructions, EAS build steps
- `RemoteCliControl.md`: full spec update
- Mark this sprint file as COMPLETE

#### T-Q06 — Final verification checklist
- [ ] `pnpm -r tsc --noEmit` — zero errors
- [ ] `pnpm test` — 18 + new tests pass
- [ ] Maestro flows pass on Simulator
- [ ] App installed from TestFlight on iPhone — full golden path works
- [ ] Cloudflare Tunnel auto-starts and phone reaches server from 4G (not Wi-Fi)
- [ ] Face ID locks and unlocks the app
- [ ] Push notification received after running `npm install` in terminal
- [ ] `.gitignore` covers: `node_modules/`, `dist/`, `data/`, `*.log`, `*.exe`, `.env`, `.maestro/screenshots/`
- [ ] No secrets committed (run `git log --all --oneline | head -20` and scan)

**Phase 10 complete when:** All checklist items pass. Signal to Orchestrator: "Last Second Sprint complete. Ready for final audit."

---

## TASK SUMMARY

| Phase | Tasks | Focus |
|---|---|---|
| Phase 1 | T-R01 – T-R06 | Cloudflare Tunnel auto-start, tunnel URL API |
| Phase 2 | Design only | Figma: 8 screens × all states (GATE) |
| Phase 3 | T-U01 – T-U06 | Mobile UI rebuild, onboarding, settings, component library |
| Phase 4 | T-I01 – T-I07 | EAS Build → TestFlight → real iPhone install |
| Phase 5 | T-S01 – T-S06 | Brute-force lockout, biometric, helmet, input limits |
| Phase 6 | T-RL01 – T-RL04 | Push notifications, input buffering, restart hint |
| Phase 7 | T-P01 – T-P05 | Pagination, virtualization, SFTP batching, binary detection |
| Phase 8 | T-T01 – T-T07 | Maestro E2E flows, CI integration |
| Phase 9 | T-M01 – T-M04 | Health endpoint, error stats, monitoring, Settings widget |
| Phase 10 | T-Q01 – T-Q06 | App Store submission, screenshots, icon, final QA |

---

## DONE STATE

This sprint reaches DONE STATE when:
- [ ] App is live on TestFlight (or App Store)
- [ ] Phone connects to PC from 4G / any network via Cloudflare Tunnel
- [ ] UI matches Orchestrator-approved Figma designs
- [ ] Biometric lock protects the app
- [ ] Push notifications fire on command completion
- [ ] Maestro E2E tests pass in CI
- [ ] Score reaches 9.5 / 10 or higher

---

## SCORING TARGET

| Dimension | Current | Target |
|---|---|---|
| Security | 7.5 | 9.5 — brute-force lockout, biometric, helmet, HTTPS |
| Reliability | 7 | 9.5 — push notifications, input buffering, restart hints |
| Features | 8 | 9.5 — onboarding, settings screen, tunnel built-in |
| Performance | 6 | 9 — pagination, virtualization, SFTP batching |
| Testing | 3 | 9 — Maestro E2E suite in CI |
| Production readiness | 4 | 10 — App Store, TestFlight, monitoring, real device |
| UX polish | 6 | 10 — Figma-approved, onboarding, biometric, empty states |
| **Overall** | **6.5** | **9.5** |
