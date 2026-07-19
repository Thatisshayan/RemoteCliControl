# Deferred Work Register

This file is the mandatory landing place for deferred tasks, partial work, and known follow-ups that should survive the current session.

## How To Use This File

When deferring work, add:

- `Date`
- `Area`
- `Deferred item`
- `Reason deferred`
- `Resume hint`
- `Owner`, if known

## Current Deferred Items

### 2026-07-17

- Area: Mobile push
  Deferred item: Reintroduce push notifications only after a dedicated crash-safe milestone.
  Reason deferred: Push was intentionally gated during stabilization to keep the core app reliable.
  Resume hint: Revisit server push routes, device registration flow, mobile permission handling, and settings UI truthfulness together.
  Owner: Unassigned

- Area: Biometric enforcement
  Deferred item: Implement actual biometric session-lock enforcement instead of storing preference only.
  Reason deferred: Current mobile build persists the preference but does not enforce navigation or session locking.
  Resume hint: Add app-lock flow, resume behavior, and failure-path tests before presenting the feature as active.
  Owner: Unassigned

- Area: Expo and TestFlight distribution
  Status: RESOLVED 2026-07-17.
  Deferred item: Choose and implement the final iOS build/distribution path.
  Reason deferred: Core repo stabilization was prioritized before distribution work.
  Resolution: Implemented `.github/workflows/ios-testflight.yml` — a `macos-latest` GitHub Actions runner using `expo prebuild` (native project generated at build time, not committed) plus `fastlane` + `match` for signing and TestFlight upload, authenticated via an App Store Connect API key. Chosen over EAS Build because EAS usage was exhausted; chosen over a committed native project because `expo prebuild --clean` at build time avoids drift between the Expo config and a hand-maintained native project. Full manual: `docs/IOS_TESTFLIGHT_CI_MANUAL.md`. `.github/workflows/eas-build.yml` remains available unchanged for Android or if EAS usage is restored.
  Owner: Unassigned

- Area: Shared contract generation
  Deferred item: Build a real code generator so `lib/api-spec/openapi.yaml`, `lib/api-zod/src/schemas.ts`, and `lib/api-client-react/src/hooks.ts` are no longer three independently hand-maintained sources of truth, then enforce in CI that regenerating from the spec produces no diff against what's committed.
  Reason deferred: Roadmap Now-item 3 ("enforce spec regeneration and generated-output cleanliness in CI") assumed this generator already existed. It doesn't — all three files are hand-written today (see CONTRIBUTING.md "Contract Changes"). Building one is a real architecture change (pick a direction: generate zod+client from the OpenAPI spec, e.g. via `openapi-typescript`/`orval`, or generate the OpenAPI spec from the zod schemas via `zod-to-openapi`; migrate the hand-written files to generated output; verify nothing behavioral breaks) and was judged out of scope for a single roadmap-item pass. In the meantime, `artifacts/api-server/src/__tests__/contract-snapshot.test.ts` (added 2026-07-17) catches drift between the three files by comparison rather than by generation, and CI already runs it on every push/PR via the existing `test` job.
  Resume hint: Pick a generation direction (spec-first vs schema-first) before writing any code, since it changes which file becomes hand-authored and which two become generated. Whichever direction is chosen, add a CI step that regenerates and diffs against committed output, failing the build on any difference. Once real generation exists, contract-snapshot.test.ts's regex-based OpenAPI parsing can likely be deleted in favor of asserting against the generator's own output.
  Owner: Unassigned

### 2026-07-19 (Mobile Bug Fixes + iOS Crash)

- Status: RESOLVED 2026-07-19.
  Area: SSH key passphrase detection
  Deferred item: connection.tsx:52,77 used `privateKey.includes("passphrase")` to detect encrypted keys — rejected valid unencrypted keys and missed real encrypted PEM files.
  Resolution: Now checks for `ENCRYPTED` or `Proc-Type: 4,ENCRYPTED` markers.

- Status: RESOLVED 2026-07-19.
  Area: Font size useEffect
  Deferred item: session/[sessionId].tsx:84-86 overwrote user's saved font preference on every mount.
  Resolution: Added `didInitFont` ref guard so the effect only applies default size on first mount.

- Status: RESOLVED 2026-07-19.
  Area: KeepAwake cleanup
  Deferred item: session/[sessionId].tsx:88-98 had a dead `mounted` flag in KeepAwake cleanup.
  Resolution: Removed dead `mounted` flag.

- Status: RESOLVED 2026-07-19.
  Area: openWs dependency
  Deferred item: session/[sessionId].tsx:180 included `baseUrl` in `openWs` useCallback deps — caused unnecessary WebSocket reconnections.
  Resolution: Removed `baseUrl` from deps (not used in callback body).

- Status: RESOLVED 2026-07-19.
  Area: Files pull-to-refresh
  Deferred item: files.tsx:246 had hardcoded `refreshing={false}` — pull-to-refresh indicator never showed.
  Resolution: Changed to `refreshing={isLoading}`.

- Status: RESOLVED 2026-07-19.
  Area: Commands send-to-session
  Deferred item: commands.tsx:37 used raw session ID in navigation — vulnerable to injection via crafted IDs.
  Resolution: Session ID is now sanitized via `.replace(/[^a-zA-Z0-9_-]/g, "")` before navigation.

- Status: RESOLVED 2026-07-19.
  Area: Debug logger fetch loop
  Deferred item: debug-logger.ts:40-46 fired fetches to ALL LAN candidates simultaneously — wasted network and created noise.
  Resolution: Added `break` after first fetch; also skips `localhost` (phone can't reach itself).

- Status: RESOLVED 2026-07-19.
  Area: Session history sanitization
  Deferred item: session/[sessionId].tsx:209 stored raw `cmd` in history — unsanitized input persisted.
  Resolution: Now stores `sanitizedCmd` in command history.

- Status: RESOLVED 2026-07-19.
  Area: iOS startup crash
  Deferred item: Missing `privacyManifests` in app.json — iOS 17+ kills apps at launch without `PrivacyInfo.xcprivacy`.
  Resolution: Added `privacyManifests` with required API categories (UserDefaults CA92.1, FileTimestamp C617.1, DiskSpace E174.1, SystemBootTime 35F9.1).

- Status: RESOLVED 2026-07-19.
  Area: React Native Web bloat
  Deferred item: `react-native-web` in production dependencies — web-only package caused unnecessary bundle bloat on iOS.
  Resolution: Removed from `dependencies` in `package.json`.

### 2026-07-18 (from OpenCode General Audit)

- Area: Mobile terminal command sanitization
  Status: RESOLVED 2026-07-17.
  Deferred item: Fix `sanitizeCommand` in `session/[sessionId].tsx:57-69` — currently blocks most real shell commands (cd, npm, git, echo, globs).
  Resolution: Rewrote to strip ANSI + null bytes + enforce length only. Extracted to `lib/sanitize-command.ts` with 8 dedicated tests. The server SSH layer is the real security boundary; client-side no longer blocks legitimate command input.

- Area: Terminal WebSocket 4004 UX
  Status: RESOLVED 2026-07-17.
  Deferred item: Fix `onerror` handler in `session/[sessionId].tsx:186-191` — it fires alongside the clean 4004 close, overwrites the session-lost status with "Connection error" text, and calls `ws.close()` redundantly.
  Resolution: `onclose` is now the sole owner of session-lost/reconnect logic; `onerror` no longer interferes with the clean 4004 close path.

- Area: Tunnel failure reporting
  Status: RESOLVED 2026-07-17.
  Deferred item: Fix `tunnel.ts:72-73` dead logic and `startTunnel` resolving "" on failure.
  Resolution: Removed dead if-guard; `startTunnel` now rejects on failure instead of resolving ""; startup summary surfaces WHY the tunnel failed.

- Area: Setup-token auth bypass
  Status: RESOLVED 2026-07-17.
  Deferred item: Fix server reading only `process.env.API_TOKEN` after setup writes to config.json.
  Resolution: `index.ts` now loads `API_TOKEN` from `config.json` via `loadConfig()` as fallback when `process.env.API_TOKEN` is unset.

- Area: commands.ts hardening
  Status: RESOLVED 2026-07-17.
  Deferred item: commands.ts uses manual validation, returns 201 (openapi says 200), error body lacks code field.
  Resolution: Now uses `SavedCommandSchema` via `parseBody`, returns 200, uses `sendError` with proper error codes.

- Area: OpenAPI completeness
  Status: RESOLVED 2026-07-17.
  Deferred item: Add undocumented routes to openapi.yaml and make contract guard bidirectional.
  Resolution: Added `/api/setup/*`, `POST /api/push/register`, `GET /api/push/devices`, `DELETE /api/push/device/:id` to spec with `PushDevice` schema. `contract-snapshot.test.ts` is now bidirectional (every real route must be documented).

- Area: Health integration test
  Status: RESOLVED 2026-07-17.
  Deferred item: Replace no-op health.integration.test.ts with real supertest of /health.
  Resolution: `health.integration.test.ts` now uses real supertest against `GET /health` with store/sshManager mocked at the boundary.

- Area: Error message leakage
  Status: RESOLVED 2026-07-17.
  Deferred item: `app.ts:55` returns raw `err.message` for non-HttpError, leaking SSH/SFTP error strings.
  Resolution: Global error handler now returns a generic "Internal server error" message for non-HttpError; detailed message logged server-side only via `req.log`.

- Area: Store atomic write
  Status: RESOLVED 2026-07-17.
  Deferred item: `store.ts persist()` uses `writeFileSync` directly — crash mid-write corrupts store.json.
  Resolution: `persist()` now writes to temp file then `fs.renameSync`; one-time migration backs up existing file first.

- Area: Server-status Promise.all collapse
  Status: RESOLVED 2026-07-17.
  Deferred item: `server-status.ts` uses `Promise.all` which collapses any `/tunnel-url` failure into false "server unreachable."
  Resolution: Now uses `Promise.allSettled`; only marks server unreachable when `/health` itself fails.

- Area: Mobile screen tests
  Deferred item: Add screen/component tests for session/[sessionId].tsx and server-status.ts.
  Reason deferred: No existing screen test convention; needs jest-expo component test setup.
  Resume hint: Start with unit tests for sanitizeCommand (import and test directly). For 4004 UX, test the onclose handler logic in isolation. For server-status, test useServerStatus with mocked publicApi.
  Owner: Unassigned

- Area: Document reconciliation
  Status: RESOLVED 2026-07-19.
  Deferred item: Reconcile test counts, mark stale docs as historical/superseded, update CHANGELOG, fix app-store/README.md, move audit reports to audits/ per Rule 6/7.
  Resolution: README.md updated to 18 server + 8 mobile test files (141 + 72 = 213 tests). Stale docs (MUSTDONOW, 14.07.2026CurrentStateofRepo, HAVETOBELOOKEDAT) marked historical. CHANGELOG updated. Audit reports moved to `audits/` with correct DD.MM.YYYY naming. docs/README.md index updated.
