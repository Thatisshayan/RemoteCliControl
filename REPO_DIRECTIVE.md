# RemoteCliControl — REPO_DIRECTIVE

> Goal-layer constitution. `REPO_RULES.md` is the law; this is the mission. Every task
> MUST carry `traces-to:`. Orphan tasks rejected by CI (scripts/verify.sh → directive-lint) + Sentinel.

## Vision

RemoteCliControl is a remote control system for the user's desktop — Express + Expo Windows
remote, controlled from another device. North-star: safe, local-first remote control with
explicit permission boundaries and NO credential leakage. AGENTS.md is the canonical
baseline for this repo. (Vision DRAFT — confirm exact control scope with Shayan.)

## Non-Goals

- NOT a surveillance tool; user-consented control only.
- NOT exposing the remote without auth.
- NOT committing `store.key` or any credential (gitignored per AGENTS.md).

## Phases

### P1 — Safety & Truth (CURRENT)
  exit criteria: AGENTS.md baseline followed; auth on every control path.
### P2 — Remote UX
  exit criteria: Expo Windows remote usable + permission-gated.
### P3 — Hardening
  exit criteria: no creds leaked; audit log present.

## Sprints

### S1 (maps to P1) — safe baseline
  goal: AGENTS.md rules enforced; auth verified.
### S2 (maps to P2) — remote
  goal: control flows permission-gated.

## Epics / Chapters

### E1 — Control Core (maps to P1/P2)
  command execution behind auth.
### E2 — Safety (maps to P1/P3)
  credential hygiene + audit.
### E3 — Integrity (maps to P1)
  build/test hygiene.

## Tasks

- [ ] T1 — Enforce AGENTS.md baseline (no direct main, secrets gitignored) | traces-to: P1/S1/E2 | acceptance: secret-scan clean; branch-only
- [ ] T2 — Verify auth on every control endpoint | traces-to: P1/S1/E1 | acceptance: unauthenticated control rejected
- [ ] T3 — Confirm `store.key` gitignored + not in history | traces-to: P1/S1/E2 | acceptance: secret-scan clean; key absent from tree
- [ ] T4 — Add audit log for control actions | traces-to: P3/S2/E2 | acceptance: each action logged with actor+time
- [ ] T5 — Get build+test green in CI | traces-to: P1/S1/E3 | acceptance: verify.sh passes on PR

## Sentinel Constraints

- auto-approve: docs/tests/typing tracing to P1/E3.
- review-required: auth, control endpoints, credential handling, `store.key`.
- locked: `main`; `store.key`/credentials never; control scope needs Shayan.
