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

### 2026-07-18 (from OpenCode General Audit)

- Area: Mobile terminal command sanitization
  Deferred item: Fix `sanitizeCommand` in `session/[sessionId].tsx:57-69` — currently blocks most real shell commands (cd, npm, git, echo, globs). The allow-class and dangerous-chars regex reject common shell characters (~ $ ( ) * ? % # + > < & ; ' " |).
  Reason deferred: Highest priority fix but requires careful testing across Windows/Unix shells to ensure security is maintained while allowing real commands.
  Resume hint: Rewrite to strip ANSI + null bytes + enforce length only. Remove dangerousChars regex and the overly restrictive allow-class. The server SSH layer is the real security boundary; client-side should not block legitimate command input.
  Owner: Unassigned

- Area: Terminal WebSocket 4004 UX
  Deferred item: Fix `onerror` handler in `session/[sessionId].tsx:186-191` — it fires alongside the clean 4004 close, overwrites the session-lost status with "Connection error" text, and calls `ws.close()` redundantly.
  Reason deferred: Requires careful ordering analysis of React Native WebSocket event delivery.
  Resume hint: Make `onclose` the sole owner of session-lost/reconnect logic. Remove or gate the `onerror` status update and redundant `ws.close()`.
  Owner: Unassigned

- Area: Tunnel failure reporting
  Deferred item: Fix `tunnel.ts:72-73` dead logic (tunnelUrl = null then if (!tunnelUrl) always true) and `tunnel.ts:34,83` + `index.ts:46-49` where startTunnel resolves "" on failure instead of rejecting, making tunnelError in startup summary always null.
  Reason deferred: Requires changing startTunnel's return type/contract and index.ts caller logic.
  Resume hint: Remove dead if-guard, make startTunnel reject on failure instead of resolving "", populate tunnelError in index.ts catch block. Add tests for the FAILED branch in startupSummary.
  Owner: Unassigned

- Area: Setup-token auth bypass
  Deferred item: Fix `setup.ts` writing API_TOKEN to config.json but server reading only process.env.API_TOKEN — direct launch (README Quickstart) runs unauthenticated even after setup.
  Reason deferred: Requires choosing between loading config.json into process.env at startup, or documenting the env requirement explicitly.
  Resume hint: In index.ts, after `const API_TOKEN = process.env.API_TOKEN;`, add a fallback: if (!API_TOKEN) load from config.json via loadConfig(). This preserves env-var override while supporting the setup flow.
  Owner: Unassigned

- Area: commands.ts hardening
  Deferred item: commands.ts uses manual validation, returns 201 (openapi says 200), error body lacks code field. Needs SavedCommandSchema validation, status code fix, sendError usage.
  Reason deferred: Small fix but needs openapi.yaml update and test additions.
  Resume hint: Import parseBody + SavedCommandSchema from contracts, use parseBody, return res.status(200).json(), use sendError for validation errors. Update openapi.yaml 201→200.
  Owner: Unassigned

- Area: OpenAPI completeness
  Deferred item: Add /api/setup/* and POST /api/push/register, GET /api/push/devices, DELETE /api/push/device/:id to openapi.yaml. Make contract-snapshot.test.ts bidirectional (every real route must be documented).
  Reason deferred: Requires writing OpenAPI paths for undocumented routes and reversing the snapshot test assertion.
  Resume hint: Add the 5 missing path entries to openapi.yaml. In contract-snapshot.test.ts, add a second it.each that collects all registered routes from the Express app and asserts every one appears in openapiRoutes.
  Owner: Unassigned

- Area: Health integration test
  Deferred item: Replace no-op health.integration.test.ts (mock-only, doesn't test /health) with a real supertest of /health + the router.
  Reason deferred: Needs supertest against the real app (similar to smoke.e2e.test.ts setup).
  Resume hint: Import app, spin up server on port 0, supertest GET /health, assert JSON body has status:"ok" and required fields. Mock store/sshManager like other tests do.
  Owner: Unassigned

- Area: Error message leakage
  Deferred item: app.ts:55 returns raw err.message for non-HttpError, leaking SSH/SFTP error strings (incl. file paths) to the client.
  Reason deferred: Requires a redaction/normalization step in the global error handler.
  Resume hint: In the catch block, for non-HttpError instances, return a generic "Internal server error" message instead of err.message. Keep the detailed message in req.log only.
  Owner: Unassigned

- Area: Store atomic write
  Deferred item: store.ts persist() uses writeFileSync directly — crash mid-write corrupts store.json with no backup.
  Reason deferred: Needs temp-file + fs.rename pattern; also needs backup before one-time migration.
  Resume hint: Write to FILE_PATH + ".tmp", then fs.renameSync to FILE_PATH. Before the migration persist(), copy existing FILE_PATH to FILE_PATH + ".bak".
  Owner: Unassigned

- Area: Server-status Promise.all collapse
  Deferred item: `server-status.ts` uses Promise.all which collapses any /tunnel-url failure into false "server unreachable" even though /health succeeded.
  Reason deferred: Needs Promise.allSettled or individual catch handlers per endpoint.
  Resume hint: Use Promise.allSettled for all three calls. Extract results individually. Only set isUnreachable when /health itself fails.
  Owner: Unassigned

- Area: Mobile screen tests
  Deferred item: Add screen/component tests for session/[sessionId].tsx (covers C1 sanitizeCommand, C2 4004 UX) and server-status.ts (covers M2 Promise.all collapse).
  Reason deferred: No existing screen test convention; needs jest-expo component test setup.
  Resume hint: Start with unit tests for sanitizeCommand (import and test directly). For 4004 UX, test the onclose handler logic in isolation. For server-status, test useServerStatus with mocked publicApi.
  Owner: Unassigned

- Area: Document reconciliation
  Deferred item: Reconcile test counts (6 contradictory claims across README/ARCHITECTURE/ROADMAP/sync/CHANGELOG), mark stale status docs as historical/superseded, update CHANGELOG, fix app-store/README.md, move audit reports to audits/ per Rule 6/7.
  Reason deferred: Large doc-only change touching many files; needs careful cross-checking.
  Resume hint: On disk: 18 server test files, 7 mobile test files. Pick README.md as the canonical source. Add superseded headers to MUSTDONOW/14.07/HAVETOBELOOKEDAT. Update CHANGELOG push/biometric/EAS status. Move docs/*AUDIT_REPORT.md to audits/ with DD.MM.YYYY naming.
  Owner: Unassigned
