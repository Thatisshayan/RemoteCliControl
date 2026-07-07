# RemoteCTRL — Audit Report
**Date:** 25.06.2026  
**Auditor:** Claude (Principal Engineer / Orchestrator)  
**Branch audited:** `main`  
**Iteration:** 1 — Initial

---

## 1. SYSTEM UNDERSTANDING

### Stack
| Layer | Technology |
|---|---|
| Mobile | Expo SDK 54, Expo Router, React Native |
| Backend | Express 5, Node.js 20+, TypeScript, esbuild |
| SSH | ssh2 (native, externalized from bundle) |
| WebSocket | ws (native, externalized from bundle) |
| Logging | pino + pino-pretty |
| API Contract | OpenAPI spec → Zod types → React Query hooks (orval) |
| Package Manager | pnpm workspaces (monorepo) |
| State | In-memory only (no database) |

### Structure
```
/
├── artifacts/
│   ├── api-server/     ← Express backend (SSH relay)
│   └── mobile/         ← Expo React Native frontend
├── lib/
│   ├── api-spec/       ← openapi.yaml (source of truth)
│   ├── api-zod/        ← Zod schemas + TS types
│   └── api-client-react/ ← React Query hooks (generated)
```

### What Works Today
- SSH terminal sessions (create, close, WebSocket output, raw input)
- File browser: list, navigate, preview (text), download, upload, mkdir, delete
- Process manager: list, kill
- Saved commands: create, delete, copy to clipboard
- Connection: save credentials, test connection, single profile only
- OpenAPI → Zod → React Query codegen pipeline

---

## 2. AUDIT FINDINGS

### P0 — CRITICAL (must fix before any production use)

| # | Location | Issue | Risk |
|---|---|---|---|
| P0-1 | `artifacts/api-server/src/lib/store.ts` | All state is in-memory. SSH credentials and saved commands are **lost on every server restart**. | Users must re-enter credentials every restart. Unusable in any persistent deployment. |
| P0-2 | `artifacts/api-server/src/app.ts` | **Zero API authentication**. Any process on the network can call all endpoints (create SSH sessions, kill processes, delete files). | Critical security gap for anything beyond localhost. |
| P0-3 | `artifacts/api-server/src/lib/sshManager.ts` | SSH passwords are stored in plain memory and returned in API responses via `getConnection()`. No masking anywhere. | Credential leakage in logs and API responses. |
| P0-4 | `artifacts/api-server/src/routes/processes.ts` | PID is taken directly from URL param and passed to PowerShell without strict integer validation (`Stop-Process -Id <pid>`). | Command injection if PID is not sanitised to `/^\d+$/`. |
| P0-5 | `artifacts/api-server/src/routes/files.ts` | File path is taken from query string and passed directly to SFTP operations without canonicalization or directory traversal check. | Path traversal attack: `?path=../../etc/passwd`. |

---

### P1 — HIGH (blocks production readiness)

| # | Location | Issue |
|---|---|---|
| P1-1 | `artifacts/api-server/src/lib/sshManager.ts` | `execCommand` and `getSftp` both open brand-new SSH connections for every single call. Listing processes or browsing files creates a new SSH handshake each time. Latency and resource waste. |
| P1-2 | `artifacts/api-server/src/lib/sshManager.ts` | Session titles use `sessions.size + 1` which breaks after any session is deleted (e.g., delete session 2, create new → also gets "Session 2"). |
| P1-3 | `artifacts/api-server/src/lib/wsHandler.ts` | No heartbeat / ping-pong on the WebSocket. Silent drops (mobile network switch, sleep) leave dead sessions with no cleanup. |
| P1-4 | `artifacts/mobile/app/session/[sessionId].tsx` | No auto-reconnect on WebSocket disconnect. If the connection drops, the terminal goes dead with no recovery path. |
| P1-5 | `artifacts/mobile/app/session/[sessionId].tsx` | No ANSI escape code rendering. PowerShell / git / npm color output shows raw escape sequences (`\x1b[32m`) as garbled characters. |
| P1-6 | `artifacts/api-server/` | No rate limiting on any endpoint. A crash loop or hostile client can exhaust SSH connections and memory. |
| P1-7 | All routes | No request body size limit. An attacker can POST arbitrarily large bodies to crash the server. |
| P1-8 | `artifacts/api-server/src/routes/connection.ts` | No input validation on `host`, `port`, `username`, `password` fields. Malformed values are forwarded directly to ssh2. |
| P1-9 | `lib/api-spec/openapi.yaml` | Missing `PATCH /sessions/:id` endpoint (session renaming is in the spec doc but not in the OpenAPI spec or backend routes). |
| P1-10 | `artifacts/mobile/app/(tabs)/commands.tsx` | "Send to session" feature is not implemented — commands can only be copied to clipboard, not fired into an active terminal. |

---

### P2 — MEDIUM (quality / UX gaps)

| # | Location | Issue |
|---|---|---|
| P2-1 | `artifacts/mobile/app/session/[sessionId].tsx` | No command history (up/down arrows). Every command must be re-typed from scratch. |
| P2-2 | `artifacts/mobile/app/session/[sessionId].tsx` | Terminal font size is hardcoded at 12. No user control. |
| P2-3 | `artifacts/mobile/app/session/[sessionId].tsx` | No `expo-keep-awake` — screen dims/sleeps mid-session. |
| P2-4 | `artifacts/mobile/app/(tabs)/processes.tsx` | No search/filter on the process list. On a Windows machine with 100+ processes, this is painful. |
| P2-5 | `artifacts/api-server/` | No connection pooling for SFTP/exec — each file operation opens a fresh SSH connection. |
| P2-6 | `artifacts/mobile/app/connection.tsx` | Only one SSH profile is supported. No ability to save multiple hosts. |
| P2-7 | `artifacts/mobile/app/session/[sessionId].tsx` | Terminal output is an ever-growing string in React state. No output ring-buffer — large sessions cause memory pressure and slow renders. |
| P2-8 | `artifacts/api-server/src/lib/sshManager.ts` | `readyTimeout` is hardcoded at 15 000 ms. Not configurable per connection profile. |
| P2-9 | `artifacts/mobile/` | No offline / no-connection state detection. App silently fails without a clear "server unreachable" message. |
| P2-10 | `artifacts/api-server/` | No graceful shutdown — active SSH sessions are not cleaned up on SIGTERM/SIGINT. |
| P2-11 | `artifacts/mobile/app/(tabs)/terminal.tsx` | Sessions list is not auto-refreshed. User must manually navigate away and back to see status changes. |
| P2-12 | `artifacts/api-server/src/routes/files.ts` | File upload uses raw body parsing. Large files may time out or exhaust memory without streaming. |

---

### P3 — LOW (polish / developer experience)

| # | Location | Issue |
|---|---|---|
| P3-1 | Root | No CI pipeline (no GitHub Actions, no lint step, no build check on PR). |
| P3-2 | Root | No Docker / containerization. Deployment is entirely manual. |
| P3-3 | Root | No `.env.example` file. `EXPO_PUBLIC_DOMAIN` and `PORT` are magic strings. |
| P3-4 | Root | `cloudflared.exe` is committed to the repo. Binary files should not be in version control. |
| P3-5 | Root | `ngrok.log` is committed (even if empty). Should be in `.gitignore`. |
| P3-6 | `artifacts/api-server/` | `readyTimeout` is duplicated in 4 places in `sshManager.ts`. Should be a shared constant. |
| P3-7 | `lib/api-spec/openapi.yaml` | OpenAPI spec is manually maintained. It can drift from the actual routes. No validation step. |
| P3-8 | `artifacts/mobile/` | No unit tests anywhere. No integration tests. |
| P3-9 | `artifacts/api-server/` | No unit tests or integration tests. |
| P3-10 | `artifacts/mobile/app/(tabs)/files.tsx` | The `DOMAIN` / `BASE_URL` construction at the top of the file is duplicated from what `setBaseUrl` already handles. |
| P3-11 | `artifacts/api-server/` | No health-check `/metrics` endpoint for monitoring. Only a bare `{ status: "ok" }` health route. |
| P3-12 | Root | `package-lock.json` is committed alongside `pnpm-lock.yaml` — two lockfiles will cause confusion. |

---

## 3. PRIORITY MATRIX

```
CRITICAL NOW (P0):  5 issues — security + data loss
HIGH       (P1): 10 issues — UX blockers + reliability
MEDIUM     (P2): 12 issues — quality + usability
LOW        (P3): 12 issues — polish + DevOps
```

**Total issues found: 39**

---

## 4. DONE STATE DEFINITION

The system reaches DONE STATE when:
- [ ] All P0 issues resolved
- [ ] All P1 issues resolved
- [ ] All 14 features in the Improvement Spec implemented and verified
- [ ] CI pipeline passes on every push
- [ ] No secrets or binaries in the repo
- [ ] Backend can be started from a clean clone with one command
- [ ] Mobile app connects to backend via documented env vars
- [ ] All sessions, profiles, and commands survive a server restart

---

## 5. SYSTEM RISK SUMMARY

**Highest risk areas:**
1. `store.ts` — data loss on restart (P0-1)
2. No API auth layer (P0-2)
3. Path traversal in file routes (P0-5)
4. PID injection in process kill (P0-4)
5. WebSocket dead-session leak (P1-3 + P1-4)

**Lowest risk (already solid):**
- OpenAPI → Zod → React Query pipeline is clean
- esbuild bundler config is correct (ssh2/ws externalized properly)
- pino structured logging is in place
- Color system and design system are consistent
- TypeScript is strict enough across both packages
