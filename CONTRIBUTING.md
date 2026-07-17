# Contributing

## Setup

```bash
git clone https://github.com/Thatisshayan/RemoteCliControl.git
cd RemoteCliControl
pnpm install
cp .env.example .env
cp artifacts/mobile/.env.example artifacts/mobile/.env
pnpm build:server
PORT=3000 node artifacts/api-server/dist/index.mjs
pnpm dev:mobile
```

The mobile `.env` fallback is optional. Normal usage should go through onboarding/runtime config.

## Required Checks

Before committing:

```bash
pnpm typecheck
pnpm test
pnpm lint
```

If `pnpm` tries to touch the registry in a restricted environment, use the local TypeScript/Vitest binaries directly.

`pnpm test` runs the API server's Vitest suite, then the mobile app's Jest suite (`jest-expo` + `@testing-library/react-native`). Mobile's `artifacts/mobile/jest.config.js` overrides `transformIgnorePatterns` to handle pnpm's nested `.pnpm/pkg@version/node_modules/...` store layout, which the `jest-expo` preset's default pattern (written for a flat node_modules layout) doesn't match — see the comment in that file before changing it.

## Contract Changes

If you change a request/response shape:

1. Update `lib/api-spec/openapi.yaml`
2. Update `lib/api-zod/src/schemas.ts`
3. Update any server validation using the shared schemas
4. Update client/mobile usage
5. Update docs

Do not land route changes without syncing the docs and shared types in the same change.

`artifacts/api-server/src/__tests__/contract-snapshot.test.ts` enforces this mechanically: it fails if a documented OpenAPI component's property set drifts from its zod schema, or if a documented path/method stops resolving in the live Express app.

## Current Architecture Rules

- Authenticated business routes belong under `/api/*`.
- `/health`, `/tunnel-url`, `/version`, and `/api/setup/*` stay public.
- The server owns Cloudflare Tunnel lifecycle.
- The tray is a supervisor/status surface only.
- WebSocket terminal auth uses `sec-websocket-protocol`, not `?token=`.
- Mobile runtime URL/token come from stored runtime config after onboarding.
- Push UI is currently unavailable by design in the stabilized mobile build.

## Documentation Rule

When behavior changes, sync at least:

- `README.md`
- `ARCHITECTURE.md`
- `docs/README.md`
- `docs/governance/REPO_RULES.md`, if repo workflow or agent expectations changed
- `docs/governance/DEFERRED_WORK.md`, if any part of the requested work was deferred
- `artifacts/mobile/BUILDING.md`
- `docs/IOS_TESTFLIGHT_CI_MANUAL.md`, if the iOS release pipeline changed
- any affected public/legal docs
- preservation note in `docs/` if the change is architectural

## Agent Rule Entry Point

Repo-level agent instructions live in:

- [AGENTS.md](./AGENTS.md)
- [docs/governance/REPO_RULES.md](./docs/governance/REPO_RULES.md)

Future automation and audits should start there before making claims about repo state.

## Verification Reference

Latest architecture sync preserved in:

- [docs/LATEST_IMPLEMENTATION_SYNC_2026-07-17.md](./docs/LATEST_IMPLEMENTATION_SYNC_2026-07-17.md)
