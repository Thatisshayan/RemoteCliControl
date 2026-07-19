# App Store Submission Guide

## Prerequisites

1. **Apple Developer Account** — $99/year at [developer.apple.com](https://developer.apple.com)
2. **App Store Connect** — Create a new app at [appstoreconnect.apple.com](https://appstoreconnect.apple.com)
3. **match credentials** — Encrypted certificate/profile storage on the `ios-certs` branch (see [docs/IOS_TESTFLIGHT_CI_MANUAL.md](../docs/IOS_TESTFLIGHT_CI_MANUAL.md) for one-time setup)

## Primary Pipeline: GitHub Actions + fastlane (No EAS Required)

The production iOS pipeline uses `.github/workflows/ios-testflight.yml` with `macos-latest` runner, `fastlane`, and `match`. This runs without a local Mac and without EAS Build.

### How It Works

1. Push a `v*` tag (e.g. `v1.0.5`)
2. GitHub Actions triggers `ios-testflight.yml`
3. The job: `expo prebuild` → `fastlane match appstore` → `fastlane gym` → `fastlane upload_to_testflight`
4. Apple processes the build and notifies via App Store Connect

### One-Time Setup

See [docs/IOS_TESTFLIGHT_CI_MANUAL.md](../docs/IOS_TESTFLIGHT_CI_MANUAL.md) for:
- `match` certificate/password setup
- `ios-certs` branch configuration
- App Store Connect API key generation
- GitHub secrets configuration (`MATCH_PASSWORD`, `MATCH_GIT_AUTHORIZATION`, `ASC_API_KEY_JSON`)

## Fallback: EAS Build (Optional)

EAS Build is available as a fallback if the fastlane pipeline is unavailable:

```bash
cd artifacts/mobile
eas build --platform ios --profile production
eas submit --platform ios --profile production
```

Requires an EAS account at [expo.dev](https://expo.dev) and EAS secrets configured via `eas secret:create`.

## Complete App Store Listing

After the build is uploaded, go to [App Store Connect](https://appstoreconnect.apple.com) and fill in:

- **App Name:** RemoteCTRL
- **Subtitle:** Remote SSH Terminal Manager
- **Description:** See `metadata.json`
- **Keywords:** See `metadata.json`
- **Category:** Developer Tools (Primary), Utilities (Secondary)
- **Privacy Policy URL:** Host `docs/privacy-policy.html` and paste the URL
- **Support URL:** Host `docs/support.html` and paste the URL
- **Screenshots:** Take 6.7" iPhone screenshots (1290x2796)
- **App Rating:** 4+ (no objectionable content)

## Submit for Review

Click "Submit for Review" in App Store Connect. Apple typically reviews within 24-48 hours.

## Screenshot Guide

Required screenshot sizes:
- **iPhone 6.7"** (1290x2796) — iPhone 14 Pro Max, 15 Pro Max
- **iPhone 6.5"** (1242x2688) — iPhone XS Max, 11 Pro Max
- **iPad 12.9"** (2048x2732) — iPad Pro 12.9"

Suggested screenshots:
1. Connection Profiles — server list with status indicators
2. Terminal Session — active SSH session with colorful output
3. File Browser — directory listing with upload/download buttons
4. Process Manager — CPU/memory stats with kill button
5. Settings — full settings screen
6. Push Notification — notification on lock screen
