# RemoteCTRL — UI/UX Design Specification

**Design System:** Dark mode only · iPhone 15 Pro (393×852pt) · iOS 18+
**Font:** Inter (400/500/600/700) · **Corner radius:** 8px (inputs/cards), 12px (modals), 28px (FAB)
**Min tap target:** 44×44pt · **Safe area:** Respect top/bottom safe areas

---

## Color System

| Token | Hex | Usage |
|-------|-----|-------|
| `background` | `#0d0d0d` | Root background |
| `foreground` | `#e0e0e0` | Primary text |
| `card` | `#1a1a1a` | Card, input backgrounds |
| `border` | `#2a2a2a` | Card borders, input borders |
| `surface` | `#111111` | Tab bar, bottom sheet background |
| `surfaceElevated` | `#1e1e1e` | Elevated cards, active states |
| `primary` | `#00ff88` | Accent, success, active indicators |
| `primaryForeground` | `#0d0d0d` | Text on primary buttons |
| `mutedForeground` | `#666666` | Secondary text, placeholders |
| `destructive` | `#ff4444` | Delete, error states |
| `warning` | `#ffaa00` | Warning, connecting state |

---

## Typography

| Style | Font | Size | Weight | Line Height | Usage |
|-------|------|------|--------|-------------|-------|
| H1 | Inter | 28px | 700 | 34px | Screen title |
| H2 | Inter | 22px | 700 | 28px | Section header |
| H3 | Inter | 17px | 600 | 22px | Card title |
| Body | Inter | 15px | 400 | 20px | Content |
| Caption | Inter | 13px | 400 | 18px | Secondary text |
| Label | Inter | 12px | 600 | 16px | Form labels |
| Mono | Inter | 12px | 400 | 18px | Terminal output, command text |
| Tiny | Inter | 11px | 600 | 14px | Badge text, meta |

---

## Component Library

### Card
- Background: `#1a1a1a`
- Border: `#2a2a2a`, 1px
- Corner radius: 12px
- Padding: 16px
- Shadow: none (border-based)
- Active state: border `#00ff88`

### Badge
- Pill-shaped (border-radius: 4px)
- Padding: 2px 8px
- Connected: bg `rgba(0,255,136,0.15)`, text `#00ff88`
- Connecting: bg `rgba(255,170,0,0.15)`, text `#ffaa00`
- Error: bg `rgba(255,68,68,0.15)`, text `#ff4444`
- Disconnected: bg `rgba(102,102,102,0.2)`, text `#666666`

### Button — Primary
- Background: `#00ff88`
- Text: `#0d0d0d`, 16px, 700
- Height: 52px
- Corner radius: 8px

### Button — Secondary
- Background: `#1e1e1e`
- Border: `#2a2a2a`, 1px
- Text: `#00ff88`, 15px, 600
- Height: 48px
- Corner radius: 8px

### Text Input
- Background: `#1a1a1a`
- Border: `#2a2a2a`, 1px
- Corner radius: 8px
- Padding: 12px
- Text: 15px, `#e0e0e0`
- Placeholder: `#666666`
- Focus: border `#00ff88`

### Action Sheet (Bottom Sheet)
- Background: `#111111`
- Corner radius: 16px (top)
- Handle bar: 32×4px `#2a2a2a` centered at top
- Items: height 52px, left icon + label
- Destructive item: text `#ff4444`
- Cancel: bold, separated

### Empty State
- Icon: 48×48px, `#666666`
- Message: 15px, `#666666`, centered
- Optional CTA button below

### Loading State
- Skeleton cards: `#1a1a1a` with shimmer animation
- Height matches real card (72–120px)
- Corner radius: 12px

### Search Bar
- Background: `#1a1a1a`
- Border: `#2a2a2a`, 1px
- Corner radius: 8px
- Height: 44px
- Leading icon: search, 18px, `#666666`
- Trailing icon: clear X (shown when text present)

### FAB (Floating Action Button)
- Size: 56×56px
- Corner radius: 28px
- Background: `#00ff88`
- Icon: plus, 24px, `#0d0d0d`
- Position: bottom 24px, right 24px
- Elevation: 8dp

---

## Screen 1 — Onboarding (NEW)

Three steps in a horizontal pager. No tab bar visible.

### Step 1: Welcome
- Full-screen dark background
- App icon/logo centered (top 40%)
- Title: "RemoteCTRL", 28px, 700, `#00ff88`
- Tagline: "Control your PC from anywhere", 15px, `#666666`
- "Get Started" primary button at bottom (safe area + 24px)

### Step 2: Backend Setup
- Header: "Connect to Server", 22px
- Body text explaining: "Run the server on your Windows PC and enter the URL below"
- TextInput: "Server URL", placeholder "https://xxxx.trycloudflare.com"
- "Test Connection" secondary button
- Result banner:
  - Success: green bg, green text, shows latency "23ms"
  - Error: red bg, red text, error message
  - Loading: spinner
- "Continue" primary button (disabled until connection succeeds)

### Step 3: API Token
- Header: "API Token", 22px
- Body: "Set an API token to secure your connection (optional)"
- TextInput: masked, placeholder "Enter token or leave blank"
- Eye toggle to reveal token
- "Skip for now" link (secondary button style)
- "Continue" primary button
- On complete: save to AsyncStorage, navigate to tabs

### States
- **Empty:** Initial state with empty fields
- **Loading:** Spinner in "Test Connection" button
- **Error:** Red banner with error text
- **Success:** Green banner with latency, "Continue" enabled
- **Complete:** Navigate to tabs, AsyncStorage `onboardingComplete: true`

---

## Screen 2 — Connection Profiles (REDESIGN)

### Header
- Back chevron (left) · Title: "SSH Profiles" · Gear icon (right, navigates to Settings)

### Profile List
- Each row: Card component
  - Left: profile icon (server)
  - Middle: name (17px, 600), host:port (13px, `#666666`)
  - Right: Active badge (if active)
- Swipe-to-delete: reveals red "Delete" button on swipe left
- Empty state: "No profiles yet" + illustration

### FAB → Add Profile (bottom right)
- Opens bottom sheet "New Profile"

### Add Profile Sheet (Bottom Sheet)
- Fields:
  - NAME — TextInput
  - HOST — TextInput
  - PORT — TextInput, numeric
  - USERNAME — TextInput
  - Auth toggle: [Password] [SSH Key] segmented control
  - PASSWORD — TextInput, masked (if password mode)
  - PRIVATE KEY — multiline TextInput, monospace (if key mode)
  - PASSPHRASE — TextInput, masked (if key mode)
- "Test Connection" secondary button
- Result banner (success/error)
- "Save Profile" primary button

### States
- **Empty:** "No profiles yet" with folder illustration
- **Populated:** Card list with active indicator
- **Loading:** Spinner in Test Connection
- **Error:** Red banner on test failure
- **Swipe-delete:** Red "Delete" button revealed on swipe left

---

## Screen 3 — Terminal Tab (REDESIGN)

### Header
- Title: "Terminal" (left) · Gear icon (right, navigates to Settings)

### Session List
- Each session card:
  - Session name (17px, 600), truncated if long
  - Status pill: Connected (`#00ff88`) / Connecting (`#ffaa00`) / Error (`#ff4444`) / Disconnected (`#666666`)
  - Created-at timestamp (13px, `#666666`)
  - Close X button (top right)
- Tap → navigate to full-screen terminal
- Long-press → rename inline (TextInput replaces title, Enter to confirm)

### Empty State
- Illustration: terminal icon, 48px
- "No active sessions"
- "Tap + to create a new session"

### FAB → New Session
- Creates session → navigates to terminal screen

### States
- **Loading:** Skeleton cards (3)
- **Empty:** Illustration + message + CTA
- **Populated:** Cards with status pills
- **Error:** "Failed to load sessions" with retry button

---

## Screen 4 — Terminal Session (REDESIGN)

Full-screen modal, slides up from bottom.

### Header
- Back chevron (left) — closes session and returns to list
- Session name (center, 17px, 600)
- Status dot (right) — green connected / amber connecting / red error
- A− button (decrease font)
- A+ button (increase font)
- Clear button (trash icon)

### Output Area
- Full remaining screen
- Background: `#0d0d0d` (same as root)
- Monospace text, 12px (adjustable 8–20px via A−/A+)
- ANSI color rendering
- Scrollable (ScrollView, auto-scrolls to bottom on new output)
- Ring buffer: last 5,000 lines kept

### Reconnect Banner
- Appears at top of screen (below header) when reconnecting
- Background: amber (`rgba(255,170,0,0.15)`)
- Text: "Reconnecting (3/10)..." with spinner
- Dismisses automatically when connected

### Quick Key Bar (fixed above keyboard)
- Background: `#1a1a1a`
- Border-top: `#2a2a2a`
- Height: 44px
- Buttons: Tab · Ctrl+C · Ctrl+D · ▲ (history up) · ▼ (history down)
- Equal width distribution

### Input Bar (above keyboard, below quick keys)
- TextInput: flex 1, monospace, send button on right
- Send icon (arrow up, filled circle)
- Also sends on Enter/Submit

### States
- **Connected:** Green dot, output streaming
- **Connecting:** Amber dot, "Connecting..." banner
- **Reconnecting:** Amber banner with attempt count, disabled input
- **Error:** Red dot, error message in output area
- **Disconnected:** Gray dot, "Session closed" message

---

## Screen 5 — File Browser (REDESIGN)

### Header
- Title: "Files" (left) · Upload icon · New folder icon (right)

### Breadcrumb Bar
- Horizontal scroll, `#666666` segments
- Active segment (last): `#00ff88`
- Tappable segments navigate to that path
- Leading root "/" always visible

### File/Folder Rows
- Each row: icon (green folder / file icon / symlink icon), name, size, date
- Background: `#1a1a1a`, border: `#2a2a2a`
- Corner radius: 8px
- Tap folder → navigate in
- Tap file → preview (if text) or "Binary file" message
- Swipe left → red "Delete"

### Long-press Action Sheet
- File: Preview / Download / Rename / Delete
- Folder: Rename / Delete
- Opens iOS action sheet (bottom sheet style)

### Preview Modal
- PageSheet presentation
- Header: filename · close X
- Scrollable monospace content
- Max file size: 100 KB
- Binary detection: .png/.jpg/.gif/.webp/.mp4/.zip/.exe/.pdf → "Binary file — download to view"

### Empty State
- "Empty directory" with folder illustration

### States
- **Loading:** Skeleton rows (5)
- **Populated:** File rows with icons
- **Empty:** "Empty directory" illustration
- **Preview:** Modal with file content
- **Preview error:** "Cannot preview this file"
- **Error banner:** "Failed to load directory" + retry

---

## Screen 6 — Process Manager (REDESIGN)

### Header
- Title: "Processes" (left) · Refresh icon (right)

### Search Bar (sticky, below header)
- Search icon · TextInput · Clear X button (when text)

### Count Bar
- "N processes" or "Showing N of M" (when filtered)

### Process Cards
- Name (15px, 600), truncated
- PID (12px, `#666666`)
- CPU bar: label "CPU" + percentage, track height 4px, color-coded:
  - < 50%: `#00ff88`
  - 50–80%: `#ffaa00`
  - > 80%: `#ff4444`
- Memory: "123.4 MB" (13px)
- Status badge: running (`#00ff88`) / stopped (`#ff4444`)
- Kill X button (top right, `#ff4444`)

### Kill Confirmation
- iOS action sheet (not Alert):
  - Title: "Kill Process"
  - Message: `Kill "process.exe" (PID 1234)?`
  - "Kill" (destructive, red)
  - "Cancel"

### States
- **Loading:** Skeleton cards (5)
- **Populated:** Process cards with CPU bars
- **Filtered:** Subset shown, count bar updates
- **Empty:** "No processes found"
- **Error:** "Failed to load processes" + retry

---

## Screen 7 — Commands (REDESIGN)

### Header
- Title: "Commands" (left)

### Command Cards
- Label (16px, 600), top
- Command text (14px, `#00ff88`, monospace), truncated to 2 lines
- Description (12px, `#666666`), single line, optional

### Long-press / Swipe → Action Sheet
- "Copy to Clipboard"
- "Send to Session" (only if sessions exist)
- "Delete" (destructive)

### Tap → Bottom Action Sheet
- "Copy" · "Send to Session" · "Cancel"

### Send to Session Picker
- If multiple sessions: list them as a bottom sheet
- Tap session → navigate to terminal with command prefilled

### FAB → Add Command
- Bottom sheet "New Command"
- Fields: LABEL, COMMAND (multiline, monospace), DESCRIPTION (optional)
- "Cancel" · "Save" buttons

### States
- **Empty:** "No saved commands" + illustration
- **Populated:** Card list
- **Loading:** Spinner

---

## Screen 8 — Settings (NEW)

Accessed via gear icon in tab header (right side).
Presented as a modal or a Stack screen.

### Sections

#### Connection
- **Backend URL** — TextInput, editable, with "Test" button
- **API Token** — TextInput, masked, with eye toggle

#### Remote Access
- **Cloudflare Tunnel** — status card:
  - Active: green dot + tunnel URL (tappable→copy to clipboard)
  - Inactive: gray dot + "Not connected"

#### Security
- **Biometric Lock** — toggle switch (Face ID / Touch ID)
  - Subtext: "Lock the app when backgrounded"

#### Terminal
- **Font Size** — slider, range 8–20, default 12
- **Line Height** — (future)

#### About
- **App Version** — from `expo-constants`
- **Clear Local Data** — destructive red button, confirm dialog
  - Clears AsyncStorage, navigates back to onboarding

### States
- **Loaded:** All fields populated from AsyncStorage
- **Test Connection loading:** Spinner
- **Test success:** Green banner
- **Test failure:** Red banner
- **Clearing data:** Confirm alert, then navigate to onboarding

---

## Navigation Flow

```
App Launch
    ↓
[Onboarding Complete?]
    ├── No → Onboarding (3 steps) → Tabs
    └── Yes → Tabs
                ├── Terminal Tab → Session List → Tap → Terminal Session
                ├── Files Tab → File List → Tap → Navigate/Predict
                ├── Processes Tab → Process List → Search → Kill
                └── Commands Tab → Command List → Tap → Action Sheet
                                                    → Send → Session Picker → Terminal
                
Settings (gear icon in tab headers)
    ├── Backend URL, API Token
    ├── Cloudflare Tunnel status
    ├── Biometric toggle
    └── Font size slider

Connection Profiles (from Terminal tab gear → or initial setup)
    ├── Profile List → Tap → Select → Back
    ├── Swipe → Delete
    └── FAB → Add Profile Sheet → Save → Select → Back
```

---

## Prototype Connections (Figma)

Build these user flow prototypes:

1. **Onboarding flow:** Step 1 → Step 2 (enter URL → Test → success) → Step 3 (enter/skip token → Continue) → Tab bar appears
2. **Connection → Session → Terminal:** Tap gear → Profiles → FAB → fill form → Save → Back → Terminal tab → FAB → session card appears → connecting → connected → Tap card → Terminal screen
3. **Send command:** Commands tab → tap card → "Send to Session" → pick session → Terminal screen with command prefilled → Send button → output appears
4. **File browse → Preview:** Files tab → tap folder → tap folder → tap file → preview modal → close
5. **Process kill:** Processes tab → type search → tap X → action sheet → "Kill" → card removed

---

## Accessibility Requirements

- All interactive elements: minimum 44×44pt tap target
- All icons: `accessibilityLabel` on TouchableOpacity
- Color contrast: all text meets WCAG AA (4.5:1 ratio)
- `#00ff88` on `#0d0d0d`: contrast ratio ~7.5:1 ✓
- `#e0e0e0` on `#0d0d0d`: contrast ratio ~12.5:1 ✓
- `#666666` on `#0d0d0d`: contrast ratio ~4.6:1 ✓
- `#666666` on `#1a1a1a`: contrast ratio ~3.5:1 (OK for caption/secondary)
- Reduce motion: no auto-play animations; use `AccessibilityInfo.isReduceMotionEnabled`
