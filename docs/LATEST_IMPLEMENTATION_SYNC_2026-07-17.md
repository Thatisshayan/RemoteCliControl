# Latest Implementation Sync

Date: Friday, July 17, 2026

This document preserves the latest architecture and behavior changes so they are not lost behind stale repo documentation.

## Synced Changes

### Contract

- Authenticated application routes are documented as `/api/*`.
- Shared schemas now describe:
  - password and key auth connection inputs
  - redacted connection profile outputs
  - session rename input
  - file path and rename payloads
  - push preferences
  - health, tunnel, and version status payloads

### Server

- `/api/connections/active` returns the safe redacted profile only.
- Public routes are `/health`, `/tunnel-url`, `/version`, and `/api/setup/*`.
- WebSocket terminal auth accepts token in `sec-websocket-protocol` only.
- `notifyServerStarted()` runs from server startup, not route import time.
- Tunnel lifecycle is server-owned.
- Tray no longer spawns `cloudflared` directly.

### Mobile

- Saved runtime base URL is the live transport source after onboarding.
- Terminal WebSocket uses the saved runtime base URL.
- Files upload/download use the saved runtime base URL.
- Settings reads `/health` and `/tunnel-url` separately.
- Push UI is intentionally marked unavailable during stabilization.

### Verification

Verified locally on Friday, July 17, 2026 with:

```bash
node artifacts/mobile/node_modules/typescript/bin/tsc -p lib/api-zod/tsconfig.json --noEmit
node artifacts/mobile/node_modules/typescript/bin/tsc -p lib/api-client-react/tsconfig.json --noEmit
node artifacts/mobile/node_modules/typescript/bin/tsc -p artifacts/api-server/tsconfig.json --noEmit
node artifacts/mobile/node_modules/typescript/bin/tsc -p artifacts/mobile/tsconfig.json --noEmit
artifacts/api-server/node_modules/.bin/vitest.CMD run
```

Result:

- TypeScript passed for all edited package configs
- API server test suite passed: 12 files, 54 tests

## Docs Updated In This Sync

- `README.md`
- `ARCHITECTURE.md`
- `CONTRIBUTING.md`
- `artifacts/mobile/BUILDING.md`
- `artifacts/mobile/.env.example`
- `lib/api-spec/openapi.yaml`
- `docs/privacy-policy.html`

## Notes

- Historical documents under `docs/history/` were left as historical records and were not rewritten as current-state docs.
- The current worktree already had an unrelated `.gitignore` modification before this doc sync.
