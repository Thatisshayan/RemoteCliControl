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
  Deferred item: Choose and implement the final iOS build/distribution path.
  Reason deferred: Core repo stabilization was prioritized before distribution work.
  Resume hint: Evaluate EAS, GitHub Actions on macOS with `expo prebuild`, committed native iOS project, or Xcode Cloud.
  Owner: Unassigned
