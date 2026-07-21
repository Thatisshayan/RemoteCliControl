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

### 2026-07-21 (Mobile release-readiness audit)

- Area: iOS startup / splash lifecycle
  Deferred item: Correct the root splash/font readiness lifecycle before the next iOS build.
  Reason deferred: The root layout calls `SplashScreen.preventAutoHideAsync()` only after `useFonts` reports success, then renders `null` whenever font loading fails. Expo documents that preventing auto-hide must happen at module scope and that the error state must also release the loading gate. The current ordering can leave a user on an empty/black surface, which can be reported as an app crash. The audit was read-only and the user explicitly requested no build.
  Resume hint: Move `preventAutoHideAsync()` to module scope, consume the `useFonts` error result, hide the splash for either success or failure, and add a root-layout test for both paths before building.
  Owner: Unassigned

- Area: TestFlight release provenance
  Deferred item: Produce a new, uniquely numbered TestFlight candidate only after the startup fixes have been reviewed and verified.
  Reason deferred: The latest successful TestFlight workflow run (2026-07-17, commit `66332a0`) predates commit `16a668f`, which added the current privacy-manifest configuration. `app.json` still has iOS build number `6`, so the pipeline cannot upload a replacement build with the same number. No build was requested during this audit.
  Resume hint: Increment `expo.ios.buildNumber`, verify the generated iOS configuration and archive, then smoke-test the exact IPA on a physical iPhone before TestFlight submission.
  Owner: Unassigned

- Area: Mobile startup observability and test coverage
  Deferred item: Add production crash reporting plus root-layout and screen/lifecycle tests.
  Reason deferred: All current mobile tests exercise utilities/hooks; none renders the root layout, font failure path, splash lifecycle, navigation startup, or an iOS-native launch. The imported global error trap is not installed and its debug transport is disabled in production, leaving a TestFlight-native crash without application-side evidence.
  Resume hint: Add a maintained crash-reporting integration, call its initialization before the React tree mounts, and add root/screen tests with native module mocks. Obtain and attach the Apple crash report for the existing build before declaring a root cause.
  Owner: Unassigned

- Area: Mobile documentation accuracy
  Deferred item: Reconcile the claimed iOS startup-crash resolution with the released artifact and Apple/Expo privacy-manifest behavior.
  Reason deferred: The deferred-work register says the absence of a privacy manifest causes an iOS launch kill, but Expo documents manifests as App Store privacy declarations; the actual TestFlight build predates the manifest change. The asserted launch-crash root cause is therefore unproven.
  Resume hint: Replace the unsupported causal claim with the crash-log-backed cause once an Apple crash report is available; keep privacy-manifest compliance as a separate release requirement.
  Owner: Unassigned

### 2026-07-21

- Status: RESOLVED 2026-07-21.
  Area: Shared workspace TypeScript toolchain
  Deferred item: Make the root `pnpm typecheck` script runnable from a clean workspace.
  Resolution: Added TypeScript as a dev dependency to both shared packages and restored their workspace links. Root `pnpm typecheck` and `pnpm lint` now pass.
  Owner: Unassigned

- Status: RESOLVED 2026-07-21.
  Area: API request-log credential redaction
  Deferred item: Prevent `Authorization` (and other sensitive request headers) from being written to pino-http request logs.
  Resolution: The shared pino configuration now removes bearer/proxy authorization, cookies, `x-api-key`, and `x-auth-token` beneath pino-http's serialized request object. `logger.test.ts` verifies sentinel bearer/API-key values never reach a log line.
  Owner: Unassigned

- Status: RESOLVED 2026-07-21.
  Area: Mobile Jest verification
  Deferred item: Restore a bounded, reproducible mobile Jest run and prove all mobile suites execute.
  Resolution: Added the SDK-compatible `babel-preset-expo` as an explicit mobile dev dependency and refreshed the offline workspace linkage. `jest --runInBand` now passes all 9 suites and 75 tests.
  Owner: Unassigned

### 2026-07-17

- Area: Mobile push
  Deferred item: Reintroduce push notifications only after a dedicated crash-safe milestone.
  Reason deferred: Push was intentionally gated during stabilization to keep the core app reliable. Reintroduction also requires adding Expo's mobile notifications package; the package registry was unavailable during the 2026-07-21 implementation attempt, so a crash-safe client registration flow could not be safely built or verified.
  Resume hint: Revisit server push routes, device registration flow, mobile permission handling, and settings UI truthfulness together.
  Owner: Unassigned

- Status: RESOLVED 2026-07-21.
  Area: Biometric enforcement
  Deferred item: Implement actual biometric session-lock enforcement instead of storing preference only.
  Resolution: `BiometricLockProvider` persists the setting and `BiometricLockGate` overlays the app until native biometric authentication succeeds at launch and after backgrounding. Hardware-unavailable, unenrolled, canceled, and failed authentication remain locked with a retry action; unit tests cover success and failure paths.
  Owner: Unassigned

- Area: Expo and TestFlight distribution
  Status: RESOLVED 2026-07-17.
  Deferred item: Choose and implement the final iOS build/distribution path.
  Reason deferred: Core repo stabilization was prioritized before distribution work.
  Resolution: Implemented `.github/workflows/ios-testflight.yml` — a `macos-latest` GitHub Actions runner using `expo prebuild` (native project generated at build time, not committed) plus `fastlane` + `match` for signing and TestFlight upload, authenticated via an App Store Connect API key. Chosen over EAS Build because EAS usage was exhausted; chosen over a committed native project because `expo prebuild --clean` at build time avoids drift between the Expo config and a hand-maintained native project. Full manual: `docs/IOS_TESTFLIGHT_CI_MANUAL.md`. `.github/workflows/eas-build.yml` remains available unchanged for Android or if EAS usage is restored.
  Owner: Unassigned

- Area: Shared contract generation
  Deferred item: Build a real code generator so `lib/api-spec/openapi.yaml`, `lib/api-zod/src/schemas.ts`, and `lib/api-client-react/src/hooks.ts` are no longer three independently hand-maintained sources of truth, then enforce in CI that regenerating from the spec produces no diff against what's committed.
  Reason deferred: Roadmap Now-item 3 ("enforce spec regeneration and generated-output cleanliness in CI") assumed this generator already existed. It doesn't — all three files are hand-written today (see CONTRIBUTING.md "Contract Changes"). A 2026-07-21 attempt to install the chosen spec-first generator (Orval) was blocked by registry access, so the migration cannot be safely completed or verified in this checkout. In the meantime, `artifacts/api-server/src/__tests__/contract-snapshot.test.ts` (added 2026-07-17) catches drift between the three files by comparison rather than by generation, and CI already runs it on every push/PR via the existing `test` job.
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
