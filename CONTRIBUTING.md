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

## Contract Changes

If you change a request/response shape:

1. Update `lib/api-spec/openapi.yaml`
2. Update `lib/api-zod/src/schemas.ts`
3. Update any server validation using the shared schemas
4. Update client/mobile usage
5. Update docs

Do not land route changes without syncing the docs and shared types in the same change.

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
- `artifacts/mobile/BUILDING.md`
- any affected public/legal docs
- preservation note in `docs/` if the change is architectural

## Verification Reference

Latest architecture sync preserved in:

- [docs/LATEST_IMPLEMENTATION_SYNC_2026-07-17.md](./docs/LATEST_IMPLEMENTATION_SYNC_2026-07-17.md)
