# Changelog

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
