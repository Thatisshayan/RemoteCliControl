# Deferred Work Register

Rule 12 / Rule 11. This register survives the session. Future agents resume from here.

## Format
- `[DATE] <scope>: <what> — <why deferred> — <resume hint> — <status>`

## Items
- [2026-08-27] Windows desktop release: Package a self-contained Windows service installation path — resolved in the current branch with `RemoteCTRLServer.exe` and native PowerShell boot-startup scripts; install/start/uninstall still requires clean-machine validation — in verification
- [2026-08-27] Windows desktop service configuration: Normalize service installer configuration keys — resolved in the current branch through a shared `AppConfig` environment mapper and automated mapping test — in verification
- [2026-08-27] Windows desktop verification: Add tray, installer, and release-archive smoke coverage — build outputs and required release contents are now asserted in CI; install/start/uninstall still requires clean-machine validation — in verification
- [2026-08-27] Windows application control: Provide a trusted Authenticode certificate and publisher allow-list for managed devices — signing automation is now present and verified end-to-end locally with a free self-signed dev cert (`scripts/create-dev-signing-cert.ps1`); a publicly-trusted CA certificate still needs to be purchased and its PFX added to CI secrets before a real signed release can ship — blocked on certificate purchase / budget owner
