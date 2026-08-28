# Changelog

## Unreleased

- **Windows desktop:** separate the headless boot-startup server from the interactive tray app.
- **Windows desktop:** replace the Node-dependent service installer with self-contained PowerShell Scheduled Task installers.
- **Windows desktop:** propagate the persisted port, API token, and tunnel setting consistently to tray and boot-startup server processes.

## 1.0.8 (2026-08-26) — Suppress the Crashing Native Report Path

### Fixed
- **The cold-start crash itself, not just its diagnostics.** Three separate TestFlight builds (1.0.4/build 11, 1.0.6/build 12 twice) crashed with an identical `EXC_CRASH`/`SIGABRT` signature: `objc_exception_rethrow` on `com.facebook.react.ExceptionsManagerQueue`, originating via `-[NSInvocation invoke]` — a native bridge call into `RCTExceptionsManager`, not a plain JS `throw`. That queue handles both fatal-JS-error reporting and `console.error(...)` reporting to native, and evidently something about what gets marshaled across that bridge crashes reliably on this build.
- Rather than trying to sanitize whatever data triggers it (no JS stack trace was ever recoverable to identify it precisely), `lib/debug-logger.ts` now stops forwarding to that native call in production, since the earlier diagnostics confirmed it's the actual abort site:
  - `installGlobalErrorTrap()` — for a **fatal** JS error in production, persists it (as before) but no longer calls RN's default handler (`prev`), which is what invokes the crashing native report. Non-fatal errors and all dev-mode behavior (redbox) are unaffected.
  - `installConsoleErrorTrap()` — `console.error(...)` still gets persisted, but in production no longer forwards to the original `console.error`, which is what reaches the same native path.
- Net effect: the app should now survive what used to be a hard crash, with the real error already recorded in Settings → Diagnostics instead of lost to an abort with no trace.

## 1.0.7 (2026-08-26) — Console-Error Crash Trap

### Fixed
- **1.0.6's crash trap didn't catch it either** — build 12 (`app_version 1.0.6`) crashed with the identical signature (`EXC_CRASH`/`SIGABRT`, `objc_exception_rethrow` on `com.facebook.react.ExceptionsManagerQueue`), and `installGlobalErrorTrap()` still recorded nothing. The `lastExceptionBacktrace` origin (`objc_exception_throw` via `-[NSInvocation invoke]`) shows the exception isn't a plain uncaught JS `throw` — `ErrorUtils.setGlobalHandler` never sees it. `RCTExceptionsManager`'s queue also carries `console.error(...)` reports to native, and that path can crash on malformed arguments without ever becoming a JS "error" object.
- `lib/debug-logger.ts` — added `installConsoleErrorTrap()`, which wraps `console.error` to persist its arguments to `AsyncStorage` before calling through to the original, independent of the fatal-JS-error trap.
- `app/_layout.tsx` — installs the console-error trap alongside the existing one, at module scope.
- `app/diagnostics.tsx` — added a "Last Console Error" section. Both this and "Last Fatal Error" are now always visible (showing "Loading..." / "None recorded" instead of disappearing entirely) — the previous conditional rendering made it impossible to tell "nothing captured" from "can't find the section."

## 1.0.6 (2026-08-26) — Cold-Start Crash Diagnostics

### Fixed
- **iOS TestFlight cold-start crash still unresolved after 1.0.5** — build 11 (`app_version 1.0.4`) crashed on real devices with `EXC_CRASH`/`SIGABRT` on the `com.facebook.react.ExceptionsManagerQueue` thread (uncaught fatal JS exception, no custom handler installed, RN's default production behavior aborts the process). The privacy-manifest fix from 1.0.5 was not sufficient on its own.
- **`installGlobalErrorTrap()` was dead code** — defined in `lib/debug-logger.ts` but never called anywhere, and even if called, was gated off (`if (!__DEV__) return`) in production builds — the one thing built to diagnose this exact crash class could not run in the build type where the crash happens.
- `lib/debug-logger.ts` — `installGlobalErrorTrap()` now installs in every build. On a fatal JS error or unhandled rejection it now persists the error to `AsyncStorage` (awaited before handing off to RN's default handler, to beat the abort() race) instead of only firing a `__DEV__`-only LAN network probe.
- `app/_layout.tsx` — calls `installGlobalErrorTrap()` at module scope, before any other user code runs.
- `app/diagnostics.tsx` — surfaces "Last Fatal Error" (persisted across the crash/relaunch) with a Clear action, and includes it in the "Copy Diagnostics to Clipboard" snapshot.

This does not fix the underlying crash — it makes the next occurrence diagnosable via Settings → Diagnostics instead of leaving zero trace.

## 1.0.5 (2026-07-19) — Mobile Bug Fixes + iOS Crash Resolution

### Fixed
- **SSH key passphrase detection** — connection.tsx now checks for `ENCRYPTED` / `Proc-Type: 4,ENCRYPTED` markers instead of the substring `passphrase`, fixing encrypted key detection for real PEM files
- **Font size useEffect** — session/[sessionId].tsx:84-86 now uses a `didInitFont` ref guard to prevent the effect from overwriting the user's saved font preference on mount
- **KeepAwake cleanup** — removed dead `mounted` flag from the KeepAwake useEffect in session/[sessionId].tsx:88-98
- **openWs dependency** — removed `baseUrl` from the `openWs` useCallback dependency array (session/[sessionId].tsx:180); it was not used in the callback body and caused unnecessary WebSocket reconnections on every render
- **Files pull-to-refresh** — `files.tsx:246` now passes `isLoading` to the `refreshing` prop instead of hardcoded `false`
- **Commands send-to-session** — `commands.tsx:37` now sanitizes the session ID before navigation to prevent injection via crafted IDs
- **Debug logger fetch loop** — `debug-logger.ts:46` now breaks after the first fetch instead of firing to all LAN candidates simultaneously
- **Debug logger localhost filter** — `debug-logger.ts:38` now skips `localhost` as a candidate (the phone cannot reach itself)
- **Session history sanitization** — `session/[sessionId].tsx:209` now stores `sanitizedCmd` instead of raw `cmd` in command history
- **iOS startup crash** — added `privacyManifests` to `app.json` under `expo.ios` with required API categories (UserDefaults, FileTimestamp, DiskSpace, SystemBootTime); iOS 17+ kills apps at launch without `PrivacyInfo.xcprivacy`
- **React Native Web in production** — removed `react-native-web` from production dependencies; it is web-only and caused unnecessary bundle bloat on iOS

## 1.0.4 (2026-07-17) — Stabilization Release

### Fixed
- **Terminal command sanitizer** — rewrote `sanitizeCommand` to only strip ANSI escapes and enforce length/null-byte constraints; previously blocked most real shell commands (cd, npm, git, echo, globs)
- **Terminal 4004 session-lost UX** — `onclose` is now the sole owner of session-lost/reconnect logic; `onerror` no longer interferes with the clean 4004 close path
- **Tunnel failure reporting** — removed dead logic in `tunnel.ts` exit handler; `startTunnel` now rejects on failure instead of resolving empty string; startup summary now surfaces WHY the tunnel failed
- **Setup-token auth bypass** — server now loads `API_TOKEN` from `config.json` (written by setup) as fallback when `process.env.API_TOKEN` is unset; direct launch after setup no longer runs unauthenticated
- **commands.ts validation** — now uses `SavedCommandSchema` via `parseBody`, returns 200 (matching openapi), uses `sendError` with proper error codes
- **Error message leakage** — global error handler no longer returns raw `err.message` for non-HttpError; SSH/SFTP error strings are logged server-side only
- **Store atomic write** — `persist()` now writes to temp file then renames; one-time migration backs up existing file first
- **Server-status Promise.all collapse** — `useServerStatus` now uses `Promise.allSettled` so a `/tunnel-url` failure no longer falsely marks the server unreachable
- **Mobile index.tsx onboarding race** — now uses `RuntimeConfigProvider` context instead of direct AsyncStorage read
- **Health integration test** — replaced no-op mock-only test with real supertest of `GET /health`
- **Bidirectional contract guard** — `contract-snapshot.test.ts` now asserts every real route is documented in openapi.yaml (not just the reverse)
- **OpenAPI completeness** — added `/api/setup/*`, `POST /api/push/register`, `GET /api/push/devices`, `DELETE /api/push/device/:id` to spec
- **SanitizeCommand extracted** — moved to `lib/sanitize-command.ts` with dedicated test file (8 tests)

### Added
- `lib/sanitize-command.ts` — extracted command sanitizer utility
- `lib/__tests__/sanitize-command.test.ts` — 8 tests covering ANSI stripping, length, null bytes, real commands
- `lib/__tests__/server-status.test.ts` — updated for Promise.allSettled behavior
- `PushDevice` schema added to openapi.yaml components

### Changed
- API server suite: 18 test files, 141 tests (was 18 files, ~134 tests)
- Mobile suite: 8 test files, 72 tests (was 7 files, 64 tests)
- Total: 26 test files, 213 tests

## 1.0.0 (2026-06-28)

### Features
- **Cloudflare Tunnel** — automatic tunnel creation for remote access without port forwarding
- **System Tray** — Windows system tray app with server management
- **Windows Installer** — NSIS installer for Windows Service setup
- **Onboarding Flow** — 3-step setup wizard (Welcome → Backend URL → API Token)
- **Settings Screen** — Connection, Security, Terminal, Server Status, About
- **Component Library** — Card, Badge, ActionSheet, SearchBar, EmptyState, LoadingState
- **App Icon** — Prompt cursor (>_ ) on dark background, splash screen, adaptive icons
- **CI/CD Pipeline** — Node 18/20/22 matrix, mobile type checking, Slack notifications
- **App Store Metadata** — Listing content, privacy policy, support page

### Server
- Express 5 backend with SSH session management
- WebSocket relay for real-time terminal I/O
- SFTP file browser (upload, download, preview, mkdir, delete, rename)
- Process manager (list, search, kill)
- Saved commands library
- Push notification routes (register, preferences, devices)
- Rate limiting and bearer token authentication

### Mobile
- Expo SDK 52 React Native app
- Full SSH terminal with xterm-256color support
- File browser with upload/download
- Process manager with CPU/memory monitoring
- Command library with send-to-session
- Dark mode throughout

### Security
- Bearer token auth on all /api/* routes
- Rate limiting (100 req/15 min general, 10 req/15 min for connection test)
- Path traversal protection on SFTP operations
- PID validation regex before process kill
- Credential masking in all API responses
- Pino log redaction for passwords and keys

### CI/CD
- GitHub Actions with Node 18/20/22 matrix
- Mobile TypeScript checking
- EAS Build on v* tags (available as fallback; primary iOS pipeline uses fastlane+match)
- Slack notifications to #obsidian-media

### Testing
- Vitest test suite (API server)
- Jest test suite (mobile, jest-expo + @testing-library/react-native)
- Store tests (connections, commands, push devices, preferences)
- Push notification tests (utility, routes)
- Auth middleware tests
- Validation tests
