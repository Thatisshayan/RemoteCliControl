# RemoteCTRL

A full-stack mobile app that lets you control a Windows machine via SSH from your phone.

## Prerequisites

### On your Windows PC (the machine you want to control):
1. **OpenSSH Server** must be installed and running
   - Go to Settings → Apps → Optional Features → Add a feature → OpenSSH Server → Install
   - Open PowerShell as Administrator and run:
     ```powershell
     Start-Service sshd
     Set-Service -Name sshd -StartupType Automatic
     ```
   - Verify it's running: `Get-Service sshd`

2. **Node.js** v18+ must be installed — https://nodejs.org

3. **pnpm** must be installed:
   ```bash
   npm install -g pnpm
   ```

### On your phone:
- **iOS**: App Store → Expo Go
- **Android**: Play Store → Expo Go

---

## Setup

### 1. Clone the repo on your PC:
```bash
git clone https://github.com/Thatisshayan/RemoteCliControl.git
cd RemoteCliControl
```

### 2. Install dependencies:
```bash
pnpm install
```

### 3. Build the backend:
```bash
cd artifacts/api-server
node build.mjs
```

### 4. Start the backend server:

**PowerShell:**
```powershell
$env:PORT="3000"; node dist/index.mjs
```

**Bash / Git Bash:**
```bash
PORT=3000 node dist/index.mjs
```
You should see:
```
{"level":30,"msg":"Server running on port 3000"}
{"level":30,"msg":"WebSocket server mounted at /api/ws/terminal"}
```

### 5. Find your PC's local IP address:
```bash
ipconfig
```
Look for "IPv4 Address" under your active adapter (e.g., `192.168.1.50`).

### 6. On your phone, open Expo Go and scan the QR code:
```bash
cd artifacts/mobile
npx expo start
```
Scan the QR code displayed in the terminal with your phone's camera (iOS) or Expo Go scanner (Android).

---

## Usage

### Setting Up SSH Connection

1. Open the app → tap the **gear icon** (top-right) on the Terminal tab
2. Fill in the form:
   - **Name**: A label (e.g., "Home PC")
   - **Host**: Your PC's local IP (e.g., `192.168.1.50`)
   - **Port**: `22` (default)
   - **Username**: Your Windows username
   - **Password**: Your Windows password
3. Tap **Test Connection** to verify it works (you'll see latency on success)
4. Tap **Save & Connect**

> **SSH Key Auth**: Toggle to "SSH Key" mode and paste your PEM private key instead of using a password.

> **Multiple Profiles**: You can save multiple SSH targets (e.g., home PC, work server). Tap a profile to activate it. Long-press to delete.

### Creating a Terminal Session

1. Go to the **Terminal** tab
2. Tap the **green +** button (bottom-right)
3. You'll be taken to a full-screen terminal connected to your PC

### Using the Terminal

- **Type commands** in the input bar at the bottom and tap Send (or press Enter)
- **Quick keys**: Tab, Ctrl+C, Ctrl+D are available as buttons above the input
- **Command history**: Use ▲ / ▼ arrows to cycle through previously sent commands
- **Font size**: Use A- / A+ buttons to make text smaller or larger
- **Colors**: ANSI colors (git, npm, ls --color) render with actual colors
- **Auto-reconnect**: If the connection drops, it automatically reconnects (up to 10 attempts with exponential backoff)

### Managing Sessions

- **Terminal tab** lists all active sessions with colored status dots:
  - 🟢 Green = connected
  - 🟡 Amber = connecting
  - 🔴 Red = error
  - ⚪ Grey = disconnected
- **Tap a session** to open it
- **Long-press** a session to rename it
- **X button** on a session card to close it

### File Browser (Files Tab)

1. Navigate directories by tapping folders
2. Use **breadcrumbs** at the top to jump back to any parent directory
3. **New folder**: Tap the folder+ icon in the header
4. **Long-press** any item for actions:
   - **Directories**: Delete
   - **Files**: Preview, Download, or Delete
5. **Upload**: Tap the upload icon in the header → pick a file from your phone
6. **Download**: Long-press a file → Download → share it via AirDrop, Files, etc.
7. **Text Preview**: Tap any file to view its contents in a modal (files up to 100KB)

### Process Manager (Processes Tab)

- Shows all running Windows processes with:
  - **CPU usage** bar (green < 50%, amber 50-80%, red > 80%)
  - **Memory** in MB
  - **Status** badge (running / not responding)
- **Search**: Type in the search bar to filter processes by name
- **Kill a process**: Tap the X button, or long-press → confirm
- **Refresh**: Tap the refresh icon or pull down

### Saved Commands (Commands Tab)

1. Tap the **green +** to add a new command:
   - **Label**: Name for the command (e.g., "Restart IIS")
   - **Command**: The actual command (e.g., `iisreset`)
   - **Description**: Optional note
2. **Tap a command** to see options:
   - **Copy**: Copies to your phone's clipboard
   - **Send to Session**: Fires the command directly into an active terminal session
3. **Long-press** or tap the trash icon to delete

---

## Network Requirements

Your phone and PC must be on the **same local network** (same Wi-Fi).

If you're outside your home network, you can:
- Use a VPN to connect back to your home network
- Set up port forwarding on your router (port 22 for SSH, port 3000 for the API)

---

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | (required) | Backend server port (e.g., `3000`) |
| `EXPO_PUBLIC_DOMAIN` | `localhost:3000` | Backend URL the mobile app connects to |

To connect to a remote server, set `EXPO_PUBLIC_DOMAIN` in `artifacts/mobile/.env`:
```
EXPO_PUBLIC_DOMAIN=192.168.1.50:3000
```

---

## Architecture

```
/
├── artifacts/
│   ├── api-server/          ← Express backend (SSH relay)
│   │   ├── src/
│   │   │   ├── index.ts     ← Entry point
│   │   │   ├── app.ts       ← Express setup
│   │   │   ├── lib/
│   │   │   │   ├── sshManager.ts   ← SSH session management
│   │   │   │   ├── wsHandler.ts    ← WebSocket relay
│   │   │   │   ├── store.ts        ← JSON file-backed store
│   │   │   │   └── logger.ts       ← Pino logger
│   │   │   └── routes/      ← REST endpoints
│   │   └── build.mjs        ← esbuild config
│   └── mobile/              ← Expo React Native app
│       ├── app/
│       │   ├── (tabs)/      ← Tab screens
│       │   ├── session/     ← Terminal screen
│       │   └── connection.tsx
│       └── components/
└── lib/
    ├── api-spec/            ← OpenAPI spec
    ├── api-zod/             ← Zod schemas + TS types
    └── api-client-react/    ← React Query hooks
```

## Troubleshooting

**"No connection configured"**
- Go to the Connection screen (gear icon) and set up your SSH credentials

**Connection test fails**
- Verify OpenSSH Server is running on your PC
- Check your firewall isn't blocking port 22
- Make sure your phone and PC are on the same network

**Terminal shows "Waiting for output..."**
- The WebSocket might not have connected yet. Try going back and reopening the session

**File browser shows "Empty directory"**
- You might not have permission to read that directory. Try navigating to a different path.

**App crashes on startup**
- Make sure `pnpm install` completed successfully
- Try deleting `node_modules` and running `pnpm install` again
