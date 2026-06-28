# Contributing to RemoteCTRL

## Prerequisites

- **Node.js** v20+
- **pnpm** v9+ (`npm install -g pnpm`)
- **Windows OpenSSH Server** running on the target machine (required for real SSH tests)

---

## Local Setup

```bash
git clone https://github.com/Thatisshayan/RemoteCliControl.git
cd RemoteCliControl
pnpm install

# Configure environment
cp .env.example .env
# Edit .env: set PORT=3000 (API_TOKEN is optional for local dev)

cp artifacts/mobile/.env.example artifacts/mobile/.env
# Edit: set EXPO_PUBLIC_DOMAIN=http://localhost:3000

# Build backend
pnpm build:server

# Start backend
PORT=3000 node artifacts/api-server/dist/index.mjs

# Start mobile (separate terminal)
pnpm dev:mobile
```

---

## Development Mode (hot reload)

```bash
# Backend — tsx watch (no build step needed)
pnpm dev:server

# Mobile
pnpm dev:mobile
```

---

## Running Tests

```bash
# All backend tests
pnpm test

# With coverage report
pnpm --filter api-server test:coverage

# Type-check all packages
pnpm typecheck
```

Test files live in:
- `artifacts/api-server/src/lib/__tests__/` — unit tests (store, auth)
- `artifacts/api-server/src/routes/__tests__/` — validation tests
- `artifacts/api-server/src/__tests__/` — integration tests (health endpoint)

---

## Regenerating the API Client

After any change to `lib/api-spec/openapi.yaml`:

```bash
pnpm --filter @remotectrl/api-zod generate
pnpm --filter @remotectrl/api-client-react generate
```

The OpenAPI spec is the source of truth. Keep it in sync with every new or modified route.

---

## Building the Backend

```bash
pnpm build:server
# Output: artifacts/api-server/dist/index.mjs
```

The build uses esbuild. `ssh2` and `ws` are **externalized** (not bundled) because they use native modules. Never import them with a plain `import` — always use `createRequire`:

```typescript
import { createRequire } from "module";
const require = createRequire(import.meta.url);
const { Client } = require("ssh2") as typeof import("ssh2");
```

---

## Branch Model

All completed phases are merged into `main`. Active branches:

| Branch | Purpose |
|--------|---------|
| `main` | Stable, production-ready |
| `phase1branch` | Security hardening (merged) |
| `phase2branch` | Reliability & WebSocket (merged) |
| `phase4branch` | Connection pooling (merged) |
| `phase5branch` | DevOps / Docker / CI (merged) |
| `phase6branch` | Observability (merged) |
| `phase8branch` | Testing (merged) |
| `phase10branch` | Final QA + orchestrator fixes (merged) |

For new work: branch off `main`, use `feat/`, `fix/`, or `chore/` prefix.

---

## Commit Style

Use [Conventional Commits](https://www.conventionalcommits.org/):

```
feat: add SSH key passphrase support
fix: forward WebSocket input to SSH shell
docs: update README quickstart
chore: bump pnpm-lock.yaml
refactor: extract READY_TIMEOUT constant
test: add store persistence tests
```

---

## Code Conventions

- **TypeScript strict mode** across all packages — `tsc --noEmit` must pass before commit
- **Colors**: never hardcode hex values in mobile — always use `colors.*` from `constants/colors.ts`
- **No comments** unless the *why* is non-obvious (a hidden constraint, workaround, invariant)
- **Error handling**: use `next(err)` in Express routes — the global error handler in `app.ts` formats all errors
- **Secrets**: `password`, `privateKey`, `passphrase` must never appear in API responses or logs — use `getActiveConnectionSafe()` / `getConnectionsSafe()` and trust pino redaction

---

## Docker

```bash
# Production build
docker compose up --build

# Development (live code — no build step)
docker compose -f docker-compose.dev.yml up
```

The `data/` directory is mounted as a volume so `store.json` persists across container restarts.

---

## Questions / Issues

Open an issue on GitHub: https://github.com/Thatisshayan/RemoteCliControl/issues
