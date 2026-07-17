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
