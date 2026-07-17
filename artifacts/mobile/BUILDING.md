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
- biometric storage preference exists, but full lock enforcement is not implemented

## Verification

```bash
node artifacts/mobile/node_modules/typescript/bin/tsc -p artifacts/mobile/tsconfig.json --noEmit
```
