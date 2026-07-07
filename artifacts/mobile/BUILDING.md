# Building & Distributing RemoteCTRL for iOS

## Prerequisites

- Node.js 18+
- pnpm
- An **Apple Developer** account ($99/year)
- **Xcode 16+** (macOS only)
- Expo CLI: `pnpm add -g eas-cli`

## Setup

### 1. EAS Login

```bash
eas login
```

You'll be prompted for your Expo credentials. Create an account at https://expo.dev if you don't have one.

### 2. Configure Project ID

Open `app.json` and replace `YOUR_EAS_PROJECT_ID` with your actual project ID:

```bash
eas init
```

Run this in `artifacts/mobile/` and it will output the project ID and update `app.json` automatically.

### 3. Apple Developer Portal Setup

Run the credentials wizard to register your bundle identifier and create distribution certificates:

```bash
eas build --platform ios --profile development
```

Follow the interactive prompts to create an App ID, generate a certificate, and register your development device(s).

### 4. Environment Variables

| Variable | Purpose |
|----------|---------|
| `EXPO_PUBLIC_DOMAIN` | Fallback API URL (user can override in onboarding) |

**For EAS builds:** set as EAS Secrets:
```bash
eas secret:create --name EXPO_PUBLIC_DOMAIN --value "https://your-tunnel.trycloudflare.com"
eas secret:create --name EXPO_PUBLIC_API_TOKEN --value "your-token"
```

**For local dev:** use `.env` file (already gitignored).

### 5. App Store Connect API Key (for `eas submit`)

`eas.json`'s `submit.preview.ios` block references three env vars rather than
hardcoding credentials, so the key never lands in git:

```bash
export EXPO_ASC_API_KEY_PATH="/path/to/AuthKey_XXXXXXXXXX.p8"
export EXPO_ASC_API_KEY_ID="XXXXXXXXXX"
export EXPO_ASC_API_KEY_ISSUER_ID="your-issuer-id"
```

Generate the key at App Store Connect → Users and Access → Integrations →
App Store Connect API, and keep the `.p8` file outside the repo.

> **Action required:** an earlier version of `eas.json` committed a real key
> ID (`RY256KG775`) and issuer ID to git history. Rotate that key in App
> Store Connect (revoke it, generate a new one) before treating it as safe —
> the values are still recoverable from git history even though `eas.json`
> no longer references them directly.

## Build Profiles

Three profiles are defined in `eas.json`:

| Profile | Type | Use |
|---------|------|-----|
| `development` | Simulator + internal | Local dev builds with Metro bundler |
| `preview` | Internal TestFlight | QA / team testing via TestFlight |
| `production` | App Store | Release build for App Store submission |

## Building for TestFlight

### Step 1: Preview Build

```bash
eas build --platform ios --profile preview
```

This produces an `.ipa` that EAS can automatically upload to TestFlight.

### Step 2: Submit to TestFlight

```bash
eas submit --platform ios --profile preview
```

This uploads the build to App Store Connect and makes it available in TestFlight.

## Building for the App Store

### Step 1: Production Build

```bash
eas build --platform ios --profile production
```

### Step 2: Submit for Review

```bash
eas submit --platform ios --profile production
```

Then go to [App Store Connect](https://appstoreconnect.apple.com), fill in metadata (screenshots, description, privacy policy), and submit for review.

## Local Development Builds

```bash
# Run directly with Expo Go (limited native module support)
pnpm start

# Development build on simulator
eas build --platform ios --profile development
# Install the resulting build on your simulator, then:
pnpm start --dev-client
```

## Crash Reporting (Sentry)

The app has shipped several TestFlight/App Store builds with an unresolved
cold-start crash (`3f71496` and prior commits), diagnosed only via a
LAN-only debug logger that's useless once a build leaves the dev network.
`@sentry/react-native` is now wired in (`lib/sentry.ts`, initialized at the
top of `app/_layout.tsx`, `Sentry.wrap()` around the root component, and
`ErrorBoundary.componentDidCatch` reports React-render errors) so crashes
from real user devices are actually visible.

1. Create a project at https://sentry.io (React Native platform).
2. Set as EAS secrets (or in `.env` for local builds):
   ```bash
   eas secret:create --name EXPO_PUBLIC_SENTRY_DSN --value "https://...@sentry.io/..."
   eas secret:create --name SENTRY_AUTH_TOKEN --value "..."
   eas secret:create --name SENTRY_ORG --value "your-org-slug"
   eas secret:create --name SENTRY_PROJECT --value "remotectrl"
   ```
   `SENTRY_AUTH_TOKEN`/`SENTRY_ORG`/`SENTRY_PROJECT` let the Sentry Expo
   config plugin upload source maps for readable native/JS stack traces.
3. Ship a `preview` build to TestFlight and reproduce the cold-start crash —
   the resulting Sentry issue should finally show whether the failure is
   native-layer (before JS even runs) or a JS exception, which the last
   several bisection commits couldn't distinguish.

### New Architecture bisection

`app.json` sets `"newArchEnabled": true` on Expo SDK 52 with
`react-native-reanimated`, `react-native-gesture-handler`, and
`react-native-keyboard-controller` — all native modules with known New
Architecture interop issues in that SDK/RN window. If Sentry shows a
native-layer crash with no JS stack trace, the next bisection step is
setting `newArchEnabled` to `false` and shipping a build to confirm/deny
before spending more time on JS-level fixes.

## Troubleshooting

- **Build fails with code signing error:** Run `eas credentials` to regenerate certificates.
- **Face ID not working:** Verify `expo-local-authentication` is in `app.json` plugins and `NSFaceIDUsageDescription` is set.
- **API connection refused:** Make sure the Cloudflare Tunnel is running on the server. On first launch, the onboarding screen allows entering a custom URL.
- **Push rejected (duplicate bundle ID):** Change `bundleIdentifier` in `app.json` to something unique (e.g. `com.yourname.remotectrl`).
