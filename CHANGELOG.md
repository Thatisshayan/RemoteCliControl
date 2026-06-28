# Changelog

## 1.0.0 (2026-06-28)

### Features
- **Cloudflare Tunnel** — automatic tunnel creation for remote access without port forwarding
- **System Tray** — Windows system tray app with server management
- **Windows Installer** — NSIS installer for Windows Service setup
- **Onboarding Flow** — 3-step setup wizard (Welcome → Backend URL → API Token)
- **Settings Screen** — Connection, Security, Push Notifications, Terminal, Server Status, About
- **Component Library** — Card, Badge, ActionSheet, SearchBar, EmptyState, LoadingState
- **Push Notifications** — Session disconnect alerts, server health alerts via Expo Push API
- **App Icon** — Prompt cursor (>_ ) on dark background, splash screen, adaptive icons
- **EAS Build** — Automated iOS builds on tag push
- **EAS Submit** — Automatic TestFlight submission
- **CI/CD Pipeline** — Node 18/20/22 matrix, mobile type checking, Slack notifications
- **App Store Metadata** — Listing content, privacy policy, support page

### Server
- Express 5 backend with SSH session management
- WebSocket relay for real-time terminal I/O
- SFTP file browser (upload, download, preview, mkdir, delete, rename)
- Process manager (list, search, kill)
- Saved commands library
- Push notification routes (register, preferences, devices)
- Rate limiting and bearer token authentication

### Mobile
- Expo SDK 52 React Native app
- Full SSH terminal with xterm-256color support
- File browser with upload/download
- Process manager with CPU/memory monitoring
- Command library with send-to-session
- Biometric lock (Face ID / Touch ID)
- Dark mode throughout

### Security
- Bearer token auth on all /api/* routes
- Rate limiting (100 req/15 min general, 10 req/15 min for connection test)
- Path traversal protection on SFTP operations
- PID validation regex before process kill
- Credential masking in all API responses
- Pino log redaction for passwords and keys

### CI/CD
- GitHub Actions with Node 18/20/22 matrix
- Mobile TypeScript checking
- EAS Build on v* tags
- EAS Submit (TestFlight) on v* tags
- Slack notifications to #obsidian-media

### Testing
- Vitest test suite (37 tests)
- Store tests (connections, commands, push devices, preferences)
- Push notification tests (utility, routes)
- Auth middleware tests
- Validation tests
