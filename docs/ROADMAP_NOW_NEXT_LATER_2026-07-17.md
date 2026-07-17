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

1. ~~Add end-to-end happy-path smoke coverage across connection, session, terminal, and files.~~ Done 2026-07-17: `artifacts/api-server/src/__tests__/smoke.e2e.test.ts` drives the real Express app and WebSocket upgrade handler end to end (connection create/activate, session create/list/close, terminal WS round-trip, file listing) with SSH/SFTP mocked only at the `sshManager` boundary.
2. Add contract snapshot tests tying OpenAPI to generated/shared client artifacts.
3. Enforce spec regeneration and generated-output cleanliness in CI.
4. Add mobile tests for runtime config hydration and live backend URL switching.
5. Add mobile tests for terminal WebSocket subprotocol auth construction.
6. Add Windows CI coverage for the actual workspace script layer.
7. Add a connection validation action in onboarding and settings.
8. Add explicit auth-expired handling that returns the app to a safe recovery state.
9. Replace brittle process parsing with a more structured machine-readable approach where feasible.
10. Add structured server logs with request IDs.

Expected effect:

- stronger regression protection
- clearer operator debugging
- safer recovery when auth or connectivity changes
- less contract drift risk

## Next

These build operational confidence and user-facing resilience after the highest-risk coverage work lands.

1. Add version compatibility messaging in Settings.
2. Add explicit server-unreachable UX states and retry actions.
3. Add session reconnect UX after backend restart.
4. Add route-level tests for file rename validation and push preference validation failures.
5. Add safer confirmations for delete and process-kill actions.
6. Add audit logging for connection create, delete, and activate flows.
7. Add a startup log summary and server status snapshot.
8. Add a lightweight mobile diagnostics screen showing base URL, auth state, health, tunnel, and version.
9. Normalize user-facing error messages across mobile screens.
10. Introduce shared mobile data-access hooks for sessions, files, and settings.

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
10. Revisit iOS distribution strategy once the repo is stronger operationally.

Expected effect:

- more polished mobile UX
- better security posture
- safer scaling and support
- a cleaner path to distribution work

## Maintenance Rules For This Roadmap

- Update this roadmap when priorities materially change.
- Move deferred or discovered work into [docs/governance/DEFERRED_WORK.md](./governance/DEFERRED_WORK.md) when it should survive beyond the current task.
- Do not treat historical planning documents as higher priority than this roadmap unless a newer current-state document replaces it.
