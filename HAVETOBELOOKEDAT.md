# Items Requiring Manual Review

This document lists items found during the code audit that require human verification or decision-making. These are NOT confirmed bugs - they are areas where the intent or correctness is unclear.

---

## api-server

### 1. connection.ts:65-68 - Active Connection Endpoint Returns Credentials
**File:** `artifacts/api-server/src/routes/connection.ts:65-68`
**Issue:** The `GET /connections/active` endpoint calls `getActiveConnection()` which returns the full connection object including password/privateKey/passphrase, then sends it directly to the client.
**Question:** Is this intentional? The mobile client needs credentials for SSH, but exposing them via API could be a security concern depending on the threat model.
**Status:** NEEDS REVIEW

### 2. connection.ts:17-19,77 - Password Required Even for SSH Key Auth
**File:** `artifacts/api-server/src/routes/connection.ts:17-19,77`
**Issue:** Both `validateConnectionInput()` and the `POST /connections` endpoint require `password` to be a non-empty string. This means SSH key-only authentication (without a password) would fail validation.
**Question:** Is this intentional? Should password be optional when privateKey is provided?
**Status:** NEEDS REVIEW

### 3. files.ts:100 - Empty Catch Block in Directory Listing
**File:** `artifacts/api-server/src/routes/files.ts:100`
**Issue:** Empty catch block when stat-ing files during directory listing. If a file can't be stat'd, it silently falls back to defaults.
**Question:** Is this acceptable behavior, or should errors be logged?
**Status:** NEEDS REVIEW

### 4. sessions.ts:29 - No Validation on Session Title Update
**File:** `artifacts/api-server/src/routes/sessions.ts:29`
**Issue:** `PATCH /sessions/:id` accepts `req.body.title` without any type or length validation. A client could send a non-string value or extremely long title.
**Question:** Should there be validation on the title field?
**Status:** NEEDS REVIEW

### 5. sshManager.ts:80,152 - Empty Catch Blocks
**File:** `artifacts/api-server/src/lib/sshManager.ts:80,152`
**Issue:** Empty catch blocks when calling `utilityClient.end()` and when invoking listener callbacks.
**Question:** Are these intentionally silent, or should errors be logged?
**Status:** NEEDS REVIEW

### 6. tray.ts:168 - setInterval Never Cleared
**File:** `artifacts/api-server/src/tray.ts:168`
**Issue:** `setInterval(updateStatus, 10_000)` is never cleared. If the tray exits via `systray.onExit`, the interval could fire after process exit is initiated.
**Question:** Should the interval be stored and cleared on exit?
**Status:** NEEDS REVIEW

### 7. processes.ts:38 - Command Injection Risk?
**File:** `artifacts/api-server/src/routes/processes.ts:38`
**Issue:** The PID is validated with regex `/^\d+$/` before being interpolated into a PowerShell command. The regex validation appears sufficient, but command injection via SSH to a remote Windows machine is a high-severity concern.
**Question:** Is the regex validation sufficient, or should additional precautions be taken?
**Status:** NEEDS REVIEW

---

## mobile

### 8. session/[sessionId].tsx:93 - globalThis Type Cast
**File:** `artifacts/mobile/app/session/[sessionId].tsx:93`
**Issue:** `(globalThis as any).EXPO_PUBLIC_API_TOKEN` uses `any` type cast to access environment variable.
**Question:** Is there a better way to access this env var in React Native?
**Status:** NEEDS REVIEW

### 9. session/[sessionId].tsx:77 - Optional Chaining on deactivateKeepAwake
**File:** `artifacts/mobile/app/session/[sessionId].tsx:77`
**Issue:** `(KeepAwake as any).deactivateKeepAwake?.().catch(() => {})` uses `any` cast and optional chaining. This suggests the API might not be stable or available.
**Question:** Is this a known issue with the expo-keep-awake API?
**Status:** NEEDS REVIEW

### 10. files.tsx:117 - FormData `as any` Cast
**File:** `artifacts/mobile/app/(tabs)/files.tsx:117`
**Issue:** `{ uri: asset.uri, name: filename, type: asset.mimeType || "application/octet-stream" } as any` uses `any` type cast for FormData append.
**Question:** Is this a React Native TypeScript limitation, or is there a proper type?
**Status:** NEEDS REVIEW

---

## General

### 11. Multiple Empty Catch Blocks
**Files:** Various across codebase
**Issue:** Several empty catch blocks (`catch {}` or `catch (() => {})`) exist throughout the codebase.
**Question:** Should these be reviewed for potential error logging, or are they intentionally silent?
**Status:** NEEDS REVIEW

---

*Last updated: July 7, 2026*
