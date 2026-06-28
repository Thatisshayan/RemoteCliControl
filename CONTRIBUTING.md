# Contributing

## Development Setup

```bash
# Clone and install
git clone https://github.com/Thatisshayan/RemoteCliControl.git
cd RemoteCliControl
pnpm install

# Build backend
cd artifacts/api-server
node build.mjs

# Run tests
cd ../..
pnpm test
pnpm --filter api-server test:coverage
```

## Testing

- Run all tests: `pnpm test`
- Coverage: `pnpm --filter api-server test:coverage`
- Coverage threshold: 20% (actual ~28%)

## Branch Model

Each phase lives on its own branch:
- `phase1branch` - Security hardening
- `phase2branch` - Reliability & auto-refresh
- `phase3branch` - UX (skipped, already present)
- `phase4branch` - Connection pooling
- `phase5branch` - DevOps (Docker, CI)
- `phase6branch` - Observability
- `phase7branch` - UX polish
- `phase8branch` - Testing
- `phase9branch` - Documentation
- `phase10branch` - Final QA

## Commit Style

Use conventional commits: `feat:`, `fix:`, `docs:`, `chore:`, `refactor:`.

## Questions?

Open an issue or PR.