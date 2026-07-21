# Latest Implementation Sync

Date: Tuesday, July 21, 2026

## Synced Changes

### Security and observability

- The shared pino logger now removes bearer/proxy authorization, cookies, API-key, and auth-token headers from pino-http request records.
- `logger.test.ts` captures a serialized request log and verifies sentinel bearer/API-key values are absent.

### Mobile protection and verification

- The Expo mobile package now directly declares the SDK-compatible `babel-preset-expo`, rather than relying on Expo's transitive dependency.
- `BiometricLockProvider` owns the stored biometric preference; `BiometricLockGate` requires biometric authentication at launch and after the app returns from the background.
- A failed, canceled, unenrolled, or unavailable biometric check keeps the gate locked and provides a retry action. Device-passcode fallback is disabled where supported.
- The root layout now prevents splash auto-hide at module scope and falls back to system fonts if runtime font loading fails, rather than leaving the app on an empty screen.
- The next iOS candidate uses build number `7`; no native prebuild, archive, or TestFlight upload has been run for it.

### Verification

Verified locally on Tuesday, July 21, 2026:

```bash
pnpm install --offline --ignore-scripts
pnpm test
node artifacts/mobile/node_modules/typescript/bin/tsc -p artifacts/api-server/tsconfig.json --noEmit
node artifacts/mobile/node_modules/typescript/bin/tsc -p artifacts/mobile/tsconfig.json --noEmit
```

Results:

- API Vitest: 19 files, 142 tests passed.
- Mobile Jest: 9 suites, 75 tests passed.
- Mobile Jest after the release-readiness remediation: 10 suites, 79 tests passed, including root startup tests for loaded and failed fonts.
- Changed API server and mobile TypeScript projects passed.
- Root `pnpm typecheck` and `pnpm lint` passed after TypeScript was linked directly to both shared workspaces.

## Docs Updated

- `README.md`
- `ARCHITECTURE.md`
- `artifacts/mobile/BUILDING.md`
- `docs/README.md`
- `docs/governance/DEFERRED_WORK.md`
