# Now / Next / Later Roadmap

Date: Friday, July 17, 2026

This roadmap reflects the repo state after the contract hardening, runtime cleanup, mobile stabilization, documentation sync, CI repair, and branch cleanup already completed on `main`.

It exists to keep future work tied to the current truth of the repository rather than to older planning artifacts.

## Current Standing

### Product

- Core mobile flows are stabilized around runtime-configured server access.
- Shared contracts are synchronized across spec, shared schemas, server validation, and client/mobile usage.
- Terminal WebSocket auth now uses subprotocol token transport only.
- Push remains intentionally unavailable in the mobile UI until a later dedicated milestone.
- Biometric preference is stored but not yet enforced as a security control.

### Repo

- `main` is the only remaining active branch.
- Current architecture and implementation sync documents are up to date as of Friday, July 17, 2026.
- CI was repaired after lockfile refresh and the standalone EAS workflow was gated away from every `main` push.
- Future work should preserve the current contract-first and docs-in-sync operating model.

## Founder / Operator View

In plain terms, this roadmap is ordered to protect the business in the right sequence.

### Now

`Now` is about making the product harder to break.

What these items do in basic English:

- prove the main app flow actually works from start to finish
- stop API/docs/type drift from creeping back in
- make CI catch contract mistakes automatically
- prove the mobile app really uses the saved server URL and token correctly
- prove terminal auth still works the right way
- prove the Windows script layer works in CI, not only on one machine
- let a user test whether their server URL and token are valid before they hit broken screens
- recover cleanly when auth expires instead of leaving the app in a confusing state
- make process handling less fragile
- make logs easier to use when something goes wrong

Why it matters to a founder/operator:

- fewer silent regressions
- less time wasted debugging basic failures
- more confidence that demos, internal testing, and real usage will behave the same way
- lower risk before spending time on distribution

### Next

`Next` is about making the product easier to operate, support, and trust day to day.

What these items do in basic English:

- explain version mismatches
- clearly show when the server is offline or unreachable
- let users retry failed actions without restarting everything
- reconnect better after backend restarts
- add more guardrails around risky or fragile API paths
- reduce accidental destructive actions
- record important backend changes for later review
- make startup behavior easier to understand
- expose useful diagnostics inside the app
- reduce duplicated mobile data-fetch logic

Why it matters to a founder/operator:

- less support friction
- faster troubleshooting
- a more trustworthy product feel
- cleaner internal operations as usage grows

### Later

`Later` is about polish, stronger security, and deferred capabilities once the base is dependable.

What these items do in basic English:

- bring push back safely
- make biometric locking real instead of just a saved preference
- improve file browsing and large-folder handling
- make switching between servers easier
- capture more debug data for terminal problems
- improve file-preview behavior
- protect the server from noisy usage
- make local app setup easier to move or back up
- expand release and recovery process docs
- revisit the iOS distribution path once the repo is more mature

Why it matters to a founder/operator:

- better product polish
- stronger security posture
- easier scaling and support later
- less risk of polishing the wrong layer too early

## Now

These are the highest-return tasks before any renewed Expo/TestFlight push.

**All 10 items below are done as of 2026-07-17.** `Next` is the current priority list.

1. ~~Add end-to-end happy-path smoke coverage across connection, session, terminal, and files.~~ Done 2026-07-17: `artifacts/api-server/src/__tests__/smoke.e2e.test.ts` drives the real Express app and WebSocket upgrade handler end to end (connection create/activate, session create/list/close, terminal WS round-trip, file listing) with SSH/SFTP mocked only at the `sshManager` boundary.
2. ~~Add contract snapshot tests tying OpenAPI to generated/shared client artifacts.~~ Done 2026-07-17: `artifacts/api-server/src/__tests__/contract-snapshot.test.ts` cross-checks `lib/api-spec/openapi.yaml` against the shared zod schemas (property-set parity for every documented component) and against the live route table (every documented path/method actually resolves through the real Express app). There is no code generator wiring these together (see CONTRIBUTING.md "Contract Changes") — this test is what makes drift between them fail loudly. It also caught and fixed one real pre-existing gap: `VersionResponseSchema`'s optional `mobileMinVersion` field was never documented in `openapi.yaml`.
3. ~~Enforce spec regeneration and generated-output cleanliness in CI.~~ Done 2026-07-17, reinterpreted: this repo has no code generator tying `lib/api-spec/openapi.yaml` to the shared zod schemas or client hooks — all three are hand-maintained (see CONTRIBUTING.md "Contract Changes"), so "regeneration cleanliness" isn't a check that can exist yet. Verified instead that the real intent — contract drift gets caught automatically, not just when someone remembers to run tests locally — is already satisfied: `.github/workflows/ci.yml`'s `test` job runs `pnpm --filter api-server test` on every push to any branch and every PR to `main`, and that now includes item 2's `contract-snapshot.test.ts`. No CI change was needed. Building an actual spec generator (so this item's literal reading — "regeneration is clean" — becomes meaningful) is recorded as deferred work; see [docs/governance/DEFERRED_WORK.md](./governance/DEFERRED_WORK.md).
4. ~~Add mobile tests for runtime config hydration and live backend URL switching.~~ Done 2026-07-17: the mobile app had zero test infrastructure before this, so this item also stood up `jest-expo` + `@testing-library/react-native` (new devDependencies, `artifacts/mobile/jest.config.js`, wired into `pnpm test` and a new CI `test-mobile` job). `artifacts/mobile/lib/__tests__/runtime-config.test.tsx` (9 tests) covers hydration from `AsyncStorage`/`expo-secure-store` and live backend URL/token switching, asserting the shared HTTP client is actually repointed. Also fixed a real pnpm+jest-expo incompatibility: the preset's default `transformIgnorePatterns` assumes a flat node_modules layout and silently fails to transform React Native's own internals under pnpm's nested `.pnpm` store — documented in `jest.config.js`.
5. ~~Add mobile tests for terminal WebSocket subprotocol auth construction.~~ Done 2026-07-17: extracted the session-id sanitization and WebSocket URL/subprotocol construction out of `app/session/[sessionId].tsx` into `artifacts/mobile/lib/terminal-ws.ts` (`sanitizeSessionId`, `buildTerminalSocketArgs`) with no behavior change, then added `artifacts/mobile/lib/__tests__/terminal-ws.test.ts` (9 tests) covering session-id sanitization and that the API token is carried as the sole WebSocket subprotocol only when present.
6. ~~Add Windows CI coverage for the actual workspace script layer.~~ Done 2026-07-17: before this, `windows-latest` in CI only ran on tagged releases (`windows-release`), and only called `pnpm build:server` directly rather than the actual workspace scripts. Added a `windows-workspace` job that runs on every push/PR (not tag-gated) and runs `pnpm typecheck`, `pnpm test` (API server + mobile), and `pnpm build:server` on `windows-latest`, gating `eas-build`/`windows-release`/`slack-notify` like the other quality jobs. Verified locally on Windows first: all three commands pass end to end, then verified on the real CI run (not just assumed) — the first CI run on `windows-latest` immediately caught a real bug this local verification had missed: `contract-snapshot.test.ts` searched `openapi.yaml` for literal `"\n"`-delimited markers, but GitHub's hosted `windows-latest` runners default to `core.autocrlf=true`, so a fresh checkout there has CRLF line endings and every marker search silently failed. Fixed by normalizing to LF right after reading the file (no `.gitattributes`/git-config change). Confirmed fixed on a second real CI run: all jobs green.
7. ~~Add a connection validation action in onboarding and settings.~~ Done 2026-07-17: the existing "Test Connection" actions in onboarding (`step2.tsx`) and Settings only checked `/health` (unauthenticated), so a wrong API token was invisible until the first real authenticated screen failed. Added `artifacts/mobile/lib/connection-check.ts` (`checkConnection`, 9 tests) which checks server reachability and then separately probes an authenticated route (`/api/connection`) with the entered token, distinguishing unreachable / token-rejected / unexpected-error / success. Wired into Settings' existing "Test" button and added a new "Test Token" action + Continue-gating to onboarding's API token step (`step3.tsx`) — a non-blank token must pass validation before onboarding can complete; a blank token (unauthenticated mode) still passes through immediately as before.
8. ~~Add explicit auth-expired handling that returns the app to a safe recovery state.~~ Done 2026-07-17: before this, an authenticated request rejected with `AUTH_REQUIRED`/`AUTH_INVALID` just surfaced as a generic per-hook error — nothing routed the user anywhere or explained why. Added `artifacts/mobile/lib/auth-expired.ts` (pub/sub + `isAuthExpiredError`, 6 tests), wired into `app/_layout.tsx`'s shared `QueryClient` via `QueryCache`/`MutationCache` `onError` (catches every react-query-driven authenticated call in one place). `RuntimeConfigProvider` now exposes an `authExpired` flag (4 new tests) that clears automatically on `saveApiToken`/`clearLocalState` or an explicit `dismissAuthExpired()`. A new `AuthExpiredRedirect` component in the root layout bounces the user to Settings — the one screen that can fix a rejected token — where a banner now explains what happened.
9. ~~Replace brittle process parsing with a more structured machine-readable approach where feasible.~~ Done 2026-07-17: `execCommand` (`artifacts/api-server/src/lib/sshManager.ts`) used to merge stdout and stderr into one buffer, so any PowerShell warning/error text on stderr could interleave with and break the `ConvertTo-Json` stdout that `GET /api/processes` parses. `execCommand` now returns `{ stdout, stderr, exitCode }` separately; the route parses only stdout and logs stderr as a warning instead. Also fixed two real bugs this surfaced: (1) `Responding === "True"` compared a real JSON boolean against a string, so every process was always reported "not responding" regardless of actual state; (2) `DELETE /api/processes/:pid` always returned `success: true` even when `Stop-Process` silently failed (wrong/missing pid, access denied) — it now checks the command's exit code (forced non-zero on failure via `$ErrorActionPreference = 'Stop'`) and returns a real error. Added `artifacts/api-server/src/routes/__tests__/processes.test.ts` (7 route-level tests, replacing a prior version that only re-tested a regex without exercising the route) covering both fixes plus the array/single-object/empty-stdout response shapes.
10. ~~Add structured server logs with request IDs.~~ Done 2026-07-17: `pino-http`'s default request id was just an in-process counter (1, 2, 3, ...) — not unique across restarts and useless once a reverse proxy/tunnel is involved. `app.ts` now supplies a `genReqId` that reuses an incoming `x-request-id` header or mints a UUID, and echoes it back via an `x-request-id` response header on every response (so a user-reported error can be matched to server logs directly). The global unhandled-error handler and the three remaining route-level manual log calls (`files.ts`, `processes.ts`, `push.ts`) now log via `req.log` (a pino child logger already bound with the request id) instead of the bare logger singleton, so those lines carry the id too. Added `artifacts/api-server/src/__tests__/request-id.test.ts` (3 tests): a generated id is attached, an incoming id is echoed back rather than replaced, and independent requests get distinct ids.

Expected effect:

- stronger regression protection
- clearer operator debugging
- safer recovery when auth or connectivity changes
- less contract drift risk

## Next

These build operational confidence and user-facing resilience after the highest-risk coverage work lands.

1. ~~Add version compatibility messaging in Settings.~~ Done 2026-07-17: `GET /version` now optionally includes `mobileMinVersion`, sourced from a new `MOBILE_MIN_VERSION` server env var (unset by default, so no client is flagged unless an operator opts in) — added to the shared zod schema, `openapi.yaml`, and `.env.example`. Settings now fetches `/version` alongside `/health`/`/tunnel-url`, shows the running app version (previously hardcoded as `"1.0.0"` regardless of the actual build — a real pre-existing bug this surfaced) via `expo-constants`, and shows the server's declared minimum next to it when set. New `artifacts/mobile/lib/version-compat.ts` (`compareVersions`, `getVersionCompatibility`, 10 tests) does a lenient dotted-version comparison and renders a warning banner in Settings only when the running build is older than the server's declared minimum — purely informational, never blocking.
2. ~~Add explicit server-unreachable UX states and retry actions.~~ Done 2026-07-17: every list screen (Terminal, Files, Processes, Commands) rendered an empty list indistinguishably whether there really were zero items or the server was simply unreachable — no way to tell "nothing here" from "can't reach it," and no retry short of manually refreshing. All four now check `isError && isServerUnreachable(error)` (from item 9's `error-message.ts`) and show a dedicated unreachable state (`wifi-off` icon, the normalized message, a "Retry" button wired to the same `refetch` react-query already provides) instead of falling through to the normal empty-list message. Settings' "Server Status" section gets an equivalent inline banner + retry icon, powered by the new shared `useServerStatus` hook — see item 10, same commit, since that hook is what made Settings' unreachable detection possible.
3. ~~Add session reconnect UX after backend restart.~~ Done 2026-07-17: the terminal session screen (`app/session/[sessionId].tsx`) already had exponential-backoff WebSocket reconnect for transient drops (up to 10 attempts), but it treated every disconnect the same way — including the server closing with code `4004 "Session not found"` (`wsHandler.ts`), which is exactly what happens after a backend restart wipes the server's in-memory session store. The client blindly retried the same now-nonexistent session id up to 10 times before giving up with a generic "Disconnected," with no path forward. `ws.onclose` now checks for that specific close code, stops the retry loop immediately (retrying a session id the server has already confirmed doesn't exist can never succeed), and shows a distinct red "Session no longer exists on the server — it may have restarted" banner with a "Start New Session" button that navigates back to the session list. No new test file — this repo has no per-screen-component test convention yet (only `lib/` units are tested; see README's mobile test list), consistent with the rest of this screen's existing reconnect logic.
4. ~~Add route-level tests for file rename validation and push preference validation failures.~~ Done 2026-07-17: `artifacts/api-server/src/routes/__tests__/files.test.ts` is new (`files.ts` had zero test coverage before) — 7 route-level tests covering relative-path rejection, `..` traversal rejection on both `from`/`to`, a missing field, a successful rename, and an sftp-layer failure propagating as a 500. Also replaced `push.test.ts`, which existed but — like `processes.test.ts` before the "Now" tier fixed it — never actually exercised the route: it called the mocked store function directly and asserted on the mock, so a broken `parseBody`/schema in `push.ts` itself couldn't have failed it. Rewrote it with `supertest` against the real router (11 tests): empty-body rejection, non-boolean value rejection, confirmed-and-documented zod default behavior (unknown keys are silently stripped, not rejected — the literal roadmap wording assumed rejection; verified actual behavior instead of asserting a false expectation), plus the existing register/devices/delete paths now going through real HTTP requests. API server suite: 17 files, 124 tests, all passing.
5. ~~Add safer confirmations for delete and process-kill actions.~~ Done 2026-07-17, mostly already-there: audited every destructive mobile action. Connection profile delete (`app/connection.tsx`) and process kill (`app/(tabs)/processes.tsx`) already required a second confirm step via a dedicated `ActionSheet` before this item — no change needed there. The one real gap was file/folder delete in `app/(tabs)/files.tsx`: "Delete" was one option in the general Preview/Download/Delete action menu and fired immediately on tap, no separate confirmation. Added a second `ActionSheet` (title "Delete File"/"Delete Folder", explicit "cannot be undone" wording, folder case warns it removes everything inside) that the first menu's "Delete" tap now opens instead of calling delete directly.
6. ~~Add audit logging for connection create, delete, and activate flows.~~ Done 2026-07-17: `connection.ts`'s create (`POST /connection`, `POST /connections`), delete (`DELETE /connections/:id`), and activate (`POST /connections/:id/activate`) handlers had zero logging before this — a profile could be silently deleted or switched with no trace. All four now log a structured `req.log.info` line (`connectionId`, `name`, `host`, `username`/`authMode` where relevant — never secrets) tagged `"Connection audit: ..."` for grep-ability. `connection.test.ts` previously didn't mount `pino-http` at all (so `req.log` was undefined — these routes would have thrown immediately in production-shaped code the moment this item added logging, and the test file's own missing middleware would have masked that); fixed by mounting a locally captured pino instance instead of stdout, and added 5 new tests asserting the audit line's fields including that pino's existing secret-redaction config actually deletes any credential-shaped field carried through. API server suite: 17 files, 128 tests, all passing.
7. ~~Add a startup log summary and server status snapshot.~~ Done 2026-07-17: startup previously scattered its state across several separate structured log lines (`"Server started"` before the tunnel attempt even ran, then a separate `"Cloudflare Tunnel active"` or error line, or nothing at all if the tunnel silently never got a URL) — there was no single place to see "is everything actually up" at a glance. New `artifacts/api-server/src/lib/startupSummary.ts` (`buildStartupSummary`, `formatStartupSummary`, 6 tests) builds a snapshot (version, Node version, pid, port, auth mode, tunnel state — active/disabled/FAILED-with-reason/enabled-but-pending, start timestamp) after the tunnel attempt resolves (success, failure, or disabled) and prints it as one human-scannable block via `console.log`, deliberately separate from the existing structured pino lines. Kept as a pure, independently-tested function rather than inline logging so it doesn't need a real server/tunnel to test.
8. Add a lightweight mobile diagnostics screen showing base URL, auth state, health, tunnel, and version.
9. ~~Normalize user-facing error messages across mobile screens.~~ Done 2026-07-17: every screen (`commands.tsx`, `files.tsx`, `processes.tsx`, `terminal.tsx`, `connection.tsx`) caught errors and showed the raw `err.message` directly — a network failure (`"Network request failed"`/`"Failed to fetch"`/etc.) and a real API validation error looked identical to the user, with no distinction and no actionable wording. New `artifacts/mobile/lib/error-message.ts` (`getErrorMessage`, `isServerUnreachable`, 11 tests) inspects the error shape from the shared client (`lib/api-client-react/src/client.ts` attaches `.code` to real API errors) to tell a network failure ("can't reach the server, check Settings") apart from a coded API error (pass through the server's own message) apart from a response-parsing failure (zod), and replaced all 14 raw `err.message` call sites across the five screens. `isServerUnreachable` is also the shared signal item 1 (server-unreachable UX) builds on. Mobile suite: 6 files, 59 tests, all passing.
10. ~~Introduce shared mobile data-access hooks for sessions, files, and settings.~~ Done 2026-07-17, reinterpreted: sessions/files/processes/commands already had shared data-access hooks — `useGetSessions`/`useListFiles`/`useGetProcesses`/`useGetCommands` in `@remotectrl/api-client-react`, used consistently by every screen already. The literal gap was **settings**: `settings.tsx` hand-rolled its own `Promise.all`/`setInterval` polling of `/health`, `/tunnel-url`, `/version` inline, not shared with anything. New `artifacts/mobile/lib/server-status.ts` (`useServerStatus`, 5 tests) extracts that into a reusable hook returning normalized `{ health, tunnelStatus, mobileMinVersion, isUnreachable, isLoading, refetch }`, used by Settings now and available for the diagnostics screen (item 8) to reuse rather than re-implement. Mobile suite: 7 files, 64 tests, all passing.

Expected effect:

- better supportability
- better day-to-day usability
- more consistent mobile behavior
- faster diagnosis of failures

## Later

These are valuable, but they should follow the current stabilization and observability work.

1. Reintroduce push notifications behind a dedicated reliability milestone.
2. Implement true biometric session-lock enforcement.
3. Add file sorting, search, and incremental loading for large directories.
4. Add recent-server history and easier environment switching in onboarding.
5. Add session transcript capture or debug logging for terminal failure analysis.
6. Add file preview capability checks and clearer unsupported-file messaging.
7. Add rate limiting or throttle guards for high-frequency endpoints.
8. Add backup/export for non-secret local app configuration.
9. Expand deployment and recovery runbooks.
10. ~~Revisit iOS distribution strategy once the repo is stronger operationally.~~ Resolved early, 2026-07-17 (out of sequence — EAS Build usage was exhausted, forcing this sooner than planned): see [docs/IOS_TESTFLIGHT_CI_MANUAL.md](./IOS_TESTFLIGHT_CI_MANUAL.md) and the resolved entry in [docs/governance/DEFERRED_WORK.md](./governance/DEFERRED_WORK.md).

Expected effect:

- more polished mobile UX
- better security posture
- safer scaling and support
- a cleaner path to distribution work

## Maintenance Rules For This Roadmap

- Update this roadmap when priorities materially change.
- Move deferred or discovered work into [docs/governance/DEFERRED_WORK.md](./governance/DEFERRED_WORK.md) when it should survive beyond the current task.
- Do not treat historical planning documents as higher priority than this roadmap unless a newer current-state document replaces it.
