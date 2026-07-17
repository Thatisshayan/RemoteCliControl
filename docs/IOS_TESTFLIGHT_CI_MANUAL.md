# iOS TestFlight CI — User Manual

This is the step-by-step manual for shipping iOS builds to TestFlight without
Expo Application Services (EAS) and without owning a Mac. It replaces
`eas build --platform ios` for iOS specifically. Android/EAS is untouched.

Read this before touching `.github/workflows/ios-testflight.yml`,
`ios/Gemfile`, `ios/fastlane/Fastfile`, or `ios/fastlane/Matchfile`.

## 1. Why this exists

EAS Build usage was exhausted. `xcodebuild`/Xcode signing only runs on
macOS, so a `macos-latest` GitHub Actions runner stands in for a Mac, and
`fastlane` + `match` handle building, signing, and uploading non-interactively.

## 2. How it works, end to end

1. **`workflow_dispatch`** (manual, with a `lane` choice) or **`push` of a
   tag matching `ios-v*`** triggers `.github/workflows/ios-testflight.yml`
   on a `macos-latest` runner.
2. The workflow installs the pnpm workspace, then runs
   `npx expo prebuild --platform ios --no-install --clean` inside
   `artifacts/mobile` to generate a plain native Xcode project at
   `artifacts/mobile/ios/` — this is the "no EAS" step. EAS Build is not
   invoked anywhere in this pipeline.
3. `ios/Gemfile` and `ios/fastlane/` (committed at the repo root as the
   canonical template) get copied into the freshly generated
   `artifacts/mobile/ios/` directory. The project is built **in place**
   there — not moved to the repo root — because the generated `Podfile`
   has relative `../node_modules` paths that only resolve correctly from
   that location.
4. `pod install` runs inside `artifacts/mobile/ios` (CocoaPods is
   preinstalled on GitHub's macOS runners).
5. `fastlane` runs the requested lane (see §4) from
   `artifacts/mobile/ios`, authenticating to Apple with an **App Store
   Connect API key** (no Apple ID, no password, no 2FA prompt — this is
   what makes full non-interactive CI possible).
6. `fastlane match` fetches (or, for `bootstrap_certs`, creates) the iOS
   Distribution certificate and App Store provisioning profile. These are
   stored **encrypted, on the `ios-certs` branch of this same repository**
   (see §5) — not a separate repo, not your local keychain permanently.
7. `fastlane match`'s own git operations authenticate using a token
   derived on the fly from the workflow's built-in `GITHUB_TOKEN` — no
   PAT, no manually managed credential.
8. `gym` (`build_app`) archives and exports a signed `.ipa`.
9. `upload_to_testflight` uploads it to App Store Connect. It typically
   appears in the TestFlight tab within a few minutes after that.

## 3. One-time setup (already done for this repo — reference only)

If this is ever rebuilt from scratch (new Apple account, revoked API key,
etc.), the one-time setup is:

1. **Apple Developer Program membership** must be active.
2. **Create an App Store Connect API key**: App Store Connect →
   Users and Access → Integrations → App Store Connect API → Generate Key.
   Role: App Manager (or Admin). Download the `.p8` immediately — Apple
   only allows one download.
3. **Base64-encode the `.p8`** (never paste raw key content into chat/logs):
   ```powershell
   [Convert]::ToBase64String([IO.File]::ReadAllBytes("AuthKey_XXXXXXXXXX.p8"))
   ```
4. **Set repo secrets** (Settings → Secrets and variables → Actions):
   | Secret | Value |
   |---|---|
   | `ASC_KEY_ID` | the Key ID from the filename, e.g. `FA9UD39BF8` |
   | `ASC_ISSUER_ID` | the Issuer ID shown on the Integrations page |
   | `ASC_KEY_CONTENT` | the base64 string from step 3 |
   | `MATCH_PASSWORD` | any strong random passphrase — this is fastlane match's own encryption key for the certs it stores, pick your own, it is not an Apple credential |

   No GitHub PAT is needed. `MATCH_GIT_BASIC_AUTHORIZATION` (match's git
   auth) is derived automatically inside the workflow from the ambient
   `GITHUB_TOKEN` — do not add it as a stored secret.
5. **Confirm the bundle identifier** (`com.remotectrl.app`, set in
   `artifacts/mobile/app.json` under `expo.ios.bundleIdentifier`) is
   registered in Apple's Certificates, IDs & Profiles, and that an App
   record for it exists in App Store Connect → My Apps.
6. Run the `bootstrap_certs` lane once (§4) to populate the `ios-certs`
   branch.

## 4. The four fastlane lanes

Run any of these via **Actions → iOS TestFlight → Run workflow**, choosing
the `lane` input. All run entirely inside CI — none require a local Mac,
local Ruby, or an interactive Apple ID login.

| Lane | What it does | When to use it |
|---|---|---|
| `beta` (default) | Archives, signs, and uploads a new build to TestFlight | Every normal release. Also runs automatically on any `git push` of a tag matching `ios-v*`. |
| `bootstrap_certs` | Creates or fetches the distribution cert + provisioning profile and pushes them (encrypted) to `ios-certs` | One-time, or after a full cert reset. **Not** part of normal releases. |
| `list_certs` | Read-only: prints every certificate on the account (id, serial, name, type, expiry) | Diagnostics before any cert cleanup. Always safe to run. |
| `revoke_cert` | Revokes exactly one certificate by its ASC resource id (pass via the `cert_id` input) | Only when you've identified a specific bad/orphaned cert via `list_certs`. **Irreversible.** |

### Shipping a normal release

Either:
- **Actions → iOS TestFlight → Run workflow → lane: `beta`**, or
- `git tag ios-v1 && git push origin ios-v1` (bump the tag name each release).

Both do the same thing. The tag path is convenient for tying a specific
commit to a specific TestFlight build; manual dispatch is convenient for
re-running the same commit.

## 5. Where the signing certificate actually lives

`ios/fastlane/Matchfile` points `match`'s git storage at:

```ruby
git_url("https://github.com/Thatisshayan/RemoteCliControl.git")
git_branch("ios-certs")
```

This is a **branch of this same repository**, not a separate repo. That
was a deliberate simplification: it lets `match` authenticate with the
workflow's own ambient `GITHUB_TOKEN` (which already has write access to
this repo) instead of needing a separately managed cross-repo Personal
Access Token. The branch holds only encrypted files — the encryption key
is `MATCH_PASSWORD`, never committed anywhere.

Do not merge the `ios-certs` branch into `main`, and do not delete it
without running `bootstrap_certs` again first (that would orphan the
current cert the same way the pre-fix pipeline once did — see §7).

## 6. Certificate hygiene

Apple caps the number of live "Apple Distribution" (App Store) certificates
per account (observed cap: 3 on this account, as of 2026-07-17). Before
ever running `bootstrap_certs` again on a working setup, run `list_certs`
first and read the output — don't create a new cert if a good one already
exists in `ios-certs`.

If a `revoke_cert` run is ever needed:
1. Run `list_certs` and copy the `id=` value of the specific certificate.
2. Run `revoke_cert` with `cert_id` set to that exact id.
3. Never revoke a cert unless you're certain nothing signed with it is
   still relied upon (a revoked cert doesn't retroactively break an
   *already-uploaded* TestFlight build, but breaks any future build that
   still references it).

## 7. Known failure modes and their fixes (for future debugging)

These were each hit once and fixed while standing this pipeline up. If any
reappear, this is why:

| Symptom | Cause | Fix already in place |
|---|---|---|
| `Could not locate Gemfile or .bundle/ directory` | `rsync --delete` wiped the fastlane config that was already in the target dir | Build happens in-place in `artifacts/mobile/ios`; fastlane config is copied in, never rsync-mirrored with `--delete` |
| `fatal: could not read Username for 'https://github.com'` (match push silently fails, job still exits 0) | match's git clone/push doesn't inherit `actions/checkout`'s credentials | `MATCH_GIT_BASIC_AUTHORIZATION` derived from `GITHUB_TOKEN` in a dedicated workflow step |
| `Could not create another Distribution certificate, reached the maximum` | A prior cert was created on Apple's side but never persisted (see above), orphaning it against the account's cert cap | Use `list_certs` + `revoke_cert` to clear orphans before bootstrapping again |
| `Unable to open base configuration reference file .../Pods-RemoteCTRL.release.xcconfig` | `expo prebuild --no-install` skips CocoaPods too | Explicit `pod install` step added after prebuild |
| `Signing for "RemoteCTRL" requires a development team` | Generated Xcode project defaults to automatic signing, which conflicts with match's manual profile | `update_code_signing_settings(use_automatic_signing: false, ...)` before `build_app` |
| Job hangs 45+ minutes on `Run fastlane`, no error | No non-interactive CI keychain — macOS blocks on a GUI unlock prompt that never comes on a headless runner | `setup_ci` in `before_all`; also a 30-minute `timeout-minutes` job cap as a backstop |
| `No "iOS App Store" profiles ... matching 'match AppStore com.remotectrl.app' are installed` (archive succeeds, export fails) | Apple/match appends a random numeric suffix to the installed profile name; a hardcoded name in `export_options` didn't match it | `export_options` now reads `ENV["sigh_com.remotectrl.app_appstore_profile-name"]`, the actual name match set, instead of a literal string |

## 8. Checklist for a first-time run on a fresh clone/fork

- [ ] Apple Developer Program membership active
- [ ] App Store Connect API key created, `.p8` downloaded once
- [ ] `ASC_KEY_ID`, `ASC_ISSUER_ID`, `ASC_KEY_CONTENT`, `MATCH_PASSWORD` set as repo secrets
- [ ] Bundle identifier registered with Apple and an App Store Connect app record exists
- [ ] Run `list_certs` — confirm you're not already at the Distribution cert cap
- [ ] Run `bootstrap_certs` — confirm the workflow log shows `Pushing changes to remote git repo...` with no `fatal:`/`Couldn't commit` errors, and that `git ls-remote --heads origin ios-certs` shows the branch
- [ ] Run `beta` — confirm `Successfully uploaded the new binary to App Store Connect` in the log
- [ ] Check App Store Connect → TestFlight a few minutes later for the new build

## 9. Related files

- Workflow: `.github/workflows/ios-testflight.yml`
- Fastlane config: `ios/Gemfile`, `ios/fastlane/Fastfile`, `ios/fastlane/Matchfile`
- Legacy EAS workflow (Android, or iOS if EAS usage is restored): `.github/workflows/eas-build.yml`
- Mobile app config (bundle id, app name/scheme): `artifacts/mobile/app.json`
- General mobile build notes: `artifacts/mobile/BUILDING.md`
