# iOS Build Notes

## Current Runtime Behavior

- `EXPO_PUBLIC_DOMAIN` is only a build-time fallback.
- The app’s live backend URL is the stored runtime value collected during onboarding or edited in Settings.
- The app’s live API token is stored locally and propagated into the shared client at runtime.

Do not document `EXPO_PUBLIC_API_TOKEN` as a required operational setting for the current app flow.

## Local Development

```bash
pnpm dev:mobile
```

On first launch:

1. enter the backend URL
2. optionally enter the API token

## EAS Secrets

Recommended:

```bash
eas secret:create --name EXPO_PUBLIC_DOMAIN --value "https://your-server-or-tunnel-url"
```

That fallback helps pre-onboarding bootstrap only. It is not the long-term runtime source.

## Tunnel Expectations

For remote access builds:

- the backend server starts the Cloudflare Tunnel
- the mobile app can read tunnel state from `/tunnel-url`
- users do not need to rebuild the app every time the runtime URL changes if they update it in-app

## Product Truth

As of Friday, July 17, 2026:

- push notifications are not presented as a working end-user feature in the stabilized mobile UI
- enabling Biometric Lock requires Face ID, Touch ID, or fingerprint authentication on launch and after the app returns from the background

## Verification

```bash
node artifacts/mobile/node_modules/typescript/bin/tsc -p artifacts/mobile/tsconfig.json --noEmit
```

Before the next TestFlight candidate, also run the mobile Jest suite. The root
startup test covers both successful and failed font loading so a font failure
cannot leave the app on a blank screen.

## iOS TestFlight Releases (No EAS)

iOS release builds do not use `eas build`. They run through
`.github/workflows/ios-testflight.yml`, a `macos-latest` GitHub Actions
workflow that runs `expo prebuild` + `fastlane` + `match` to build, sign,
and upload to TestFlight, authenticated with an App Store Connect API key
instead of an interactive Apple ID.

Full step-by-step manual, one-time setup, and troubleshooting:
[docs/IOS_TESTFLIGHT_CI_MANUAL.md](../../docs/IOS_TESTFLIGHT_CI_MANUAL.md).

Quick reference for a normal release:

```bash
git tag ios-v1 && git push origin ios-v1
```

or **Actions → iOS TestFlight → Run workflow** with `lane: beta`.

Increment `expo.ios.buildNumber` for every TestFlight upload. The next
candidate after the 2026-07-21 startup remediation is build `7`.

`.github/workflows/eas-build.yml` (EAS-based) is still present and unchanged
for Android, or for iOS if EAS usage is restored later.
