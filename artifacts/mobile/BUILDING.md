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

## Troubleshooting

- **Build fails with code signing error:** Run `eas credentials` to regenerate certificates.
- **Face ID not working:** Verify `expo-local-authentication` is in `app.json` plugins and `NSFaceIDUsageDescription` is set.
- **API connection refused:** Make sure the Cloudflare Tunnel is running on the server. On first launch, the onboarding screen allows entering a custom URL.
- **Push rejected (duplicate bundle ID):** Change `bundleIdentifier` in `app.json` to something unique (e.g. `com.yourname.remotectrl`).
