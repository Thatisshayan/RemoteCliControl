# App Store Submission Guide

## Prerequisites

1. **Apple Developer Account** — $99/year at [developer.apple.com](https://developer.apple.com)
2. **App Store Connect** — Create a new app at [appstoreconnect.apple.com](https://appstoreconnect.apple.com)
3. **EAS Account** — Free at [expo.dev](https://expo.dev)

## Step 1: Configure EAS Credentials

```bash
cd artifacts/mobile
eas credentials --platform ios
```

Follow prompts to:
- Generate an Apple Distribution Certificate
- Register your Bundle ID (`com.remotectrl.app`)
- Generate a Provisioning Profile

## Step 2: Set Apple ID Secrets

```bash
eas secret:create --name APPLE_ID --value "your-apple-id@email.com"
eas secret:create --name APPLE_TEAM_ID --value "XXXXXXXXXX"
```

## Step 3: Build for App Store

```bash
eas build --platform ios --profile production
```

## Step 4: Submit to App Store

```bash
eas submit --platform ios --profile production
```

## Step 5: Complete App Store Listing

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

## Step 6: Submit for Review

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
