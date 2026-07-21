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
- The module-scope splash-prevention call now absorbs a native rejection. It is a visual optimization and must not turn a completed or unavailable iOS splash lifecycle into an unhandled JavaScript exception before the app renders.
- The iOS TestFlight pipeline was run successfully. Fastlane assigns the GitHub Actions run number at archive time, so the uploaded candidate is version `1.0.4` build `11` despite `app.json` declaring the next local baseline as `7`.
- Apple crash report `5C2FE275-9A36-44AF-94D1-BB788AEB429C` confirms the TestFlight launch failure is a fatal React Native JavaScript exception (`RCTExceptionsManager`), not signing, privacy-manifest, or device-native termination. The report omits the JavaScript exception message; the unhandled splash-prevention promise was the only immediate launch native promise without a rejection handler and was repaired before another build.

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
- After the TestFlight crash triage, the focused root-startup Jest suite passed (3 tests) and `artifacts/mobile` TypeScript passed. No additional iOS archive or TestFlight upload was run after that repair.
- Changed API server and mobile TypeScript projects passed.
- Root `pnpm typecheck` and `pnpm lint` passed after TypeScript was linked directly to both shared workspaces.

## Docs Updated

- `README.md`
- `ARCHITECTURE.md`
- `artifacts/mobile/BUILDING.md`
- `docs/README.md`
- `docs/governance/DEFERRED_WORK.md`
