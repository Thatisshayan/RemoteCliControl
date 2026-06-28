# RemoteCTRL — Improvement & Feature Specifications

**Sprint:** June 2026 Completion Sprint
**Status:** ✅ All 14 features DONE and merged to `main`

---

## Feature Completion Status

| # | Feature | Status | Notes |
|---|---------|--------|-------|
| 1 | Persistent Storage | ✅ DONE | `data/store.json`, survives restarts |
| 2 | Command History | ✅ DONE | ▲/▼ buttons, max 100 entries, AsyncStorage font-size |
| 3 | Auto-Reconnect WebSocket | ✅ DONE | Exponential backoff, 10 attempts, status in header |
| 4 | Keep Screen Awake | ✅ DONE | `expo-keep-awake` activated on terminal mount |
| 5 | File Download to Phone | ✅ DONE | `GET /files/download` + expo-file-system + share sheet |
| 6 | File Upload from Phone | ✅ DONE | `POST /files/upload`, multer, 100 MB limit |
| 7 | Text File Preview | ✅ DONE | `GET /files/read`, capped at 100 KB, modal in files tab |
| 8 | Send Command to Session | ✅ DONE | Action sheet → navigate with `?prefill=` param |
| 9 | Multiple SSH Profiles | ✅ DONE | Full CRUD: list/create/delete/activate |
| 10 | SSH Key Authentication | ✅ DONE | PEM key + passphrase, auth mode toggle in connection screen |
| 11 | Process Search / Filter | ✅ DONE | Live client-side filter in processes tab |
| 12 | ANSI Color Rendering | ✅ DONE | Custom `parseAnsi()` in session screen |
| 13 | Terminal Font Size | ✅ DONE | A−/A+ buttons, clamped [8,20], persisted to AsyncStorage |
| 14 | Session Renaming | ✅ DONE | `PATCH /sessions/:id`, long-press in terminal list |

---

## Detailed Specifications

### 1. Persistent Storage (JSON file on disk) ✅

**Implemented in:** `artifacts/api-server/src/lib/store.ts`

File path: `process.cwd() + "/data/store.json"`. Created on first write via `fs.mkdirSync('./data', { recursive: true })`.

State shape:
```json
{
  "connections": [{ "id", "name", "host", "port", "username", "password", "privateKey?", "passphrase?" }],
  "activeConnectionId": "string | null",
  "commands": [{ "id", "label", "command", "description" }]
}
```

Every mutation calls `persist()` → synchronous `fs.writeFileSync`. Read wrapped in `try/catch` — defaults to empty state if file missing or corrupt.

---

### 2. Command History Per Terminal Session ✅

**Implemented in:** `artifacts/mobile/app/session/[sessionId].tsx`

- `history: string[]` state, max 100 entries, newest last
- `historyIndex: number` state, `-1` = not browsing
- On send: push to history, reset index to `-1`
- ▲ button: decrement index (or start at `history.length - 1`), set input to `history[historyIndex]`
- ▼ button: increment index; if past end, reset to `-1` and clear input
- History resets when navigating away (component unmounts)

---

### 3. Auto-Reconnect WebSocket ✅

**Implemented in:** `artifacts/mobile/app/session/[sessionId].tsx`

- `reconnectAttempts` ref (starts 0), `shouldReconnect` ref (starts `true`)
- On `ws.onclose`: if `shouldReconnect && attempts < 10` → `setTimeout(openWs, min(1000 * 2^n, 30000))`
- On `ws.onopen`: reset `reconnectAttempts` to 0, clear `reconnectStatus`
- On unmount: `shouldReconnect = false`, close socket
- UI: `reconnectStatus` string in header: `"Reconnecting (N/10)..."`

---

### 4. Keep Screen Awake ✅

**Implemented in:** `artifacts/mobile/app/session/[sessionId].tsx`

```typescript
import * as KeepAwake from "expo-keep-awake";
// in component:
useEffect(() => {
  KeepAwake.activateKeepAwakeAsync();
  return () => { KeepAwake.deactivateKeepAwakeAsync(); };
}, []);
```

---

### 5. File Download to Phone ✅

**Backend:** `GET /api/files/download?path=<remote path>`
- SFTP `stat()` → set `Content-Length`; `createReadStream().pipe(res)`
- Headers: `Content-Disposition: attachment; filename="<basename>"`, `Content-Type: application/octet-stream`

**Mobile:** `artifacts/mobile/app/(tabs)/files.tsx`
- Long-press file → action sheet includes "Download"
- `FileSystem.downloadAsync(url, localUri)` → `Sharing.shareAsync(localUri)`

---

### 6. File Upload from Phone ✅

**Backend:** `POST /api/files/upload?path=<remote path>`
- `multer({ storage: multer.memoryStorage(), limits: { fileSize: 100 * 1024 * 1024 } })`
- `sftp.createWriteStream(remotePath)` → `stream.end(req.file.buffer)`

**Mobile:** Upload button in files header
- `DocumentPicker.getDocumentAsync()` → multipart POST
- Invalidates file list query on success

---

### 7. Text File Preview In-App ✅

**Backend:** `GET /api/files/read?path=<remote path>`
- `sftp.stat()` → reject if `size > 100 * 1024`
- `sftp.readFile()` → `{ content: buffer.toString("utf8") }`

**Mobile:** Tap file → preview modal (scrollable monospace text, Inter_400Regular, 12px)

---

### 8. Send Saved Command Directly to a Session ✅

**Implemented in:** `artifacts/mobile/app/(tabs)/commands.tsx`

- Tap command card → `Alert.alert` with options: Copy / Send to Session / Cancel
- "Send to Session": if 1 session → `router.push(/session/${id}?prefill=${encodeURIComponent(cmd)})` directly; if multiple → second alert with session list
- Session screen reads `prefill` query param on mount → pre-fills input

---

### 9. Multiple SSH Connection Profiles ✅

**Backend:** `artifacts/api-server/src/lib/store.ts` + `src/routes/connection.ts`

Store model: `connections: ConnectionProfile[]`, `activeConnectionId: string | null`.

New endpoints: `GET /connections`, `POST /connections`, `DELETE /connections/:id`, `POST /connections/:id/activate`, `GET /connections/active`.

**Mobile:** `artifacts/mobile/app/connection.tsx`
- Profile list with active badge; FAB → Add Profile form (Name + Host + Port + Username + auth)
- Tap to activate; long-press to delete

---

### 10. SSH Key Authentication ✅

**Backend:** `buildConnectOpts(cfg)` in `sshManager.ts`:
```typescript
if (cfg.privateKey) {
  opts.privateKey = cfg.privateKey;
  if (cfg.passphrase) opts.passphrase = cfg.passphrase;
} else {
  opts.password = cfg.password;
}
```

`privateKey` and `passphrase` persisted to store. Masked in API responses and logs.

**Mobile:** Auth mode toggle "Password" / "SSH Key" in connection form. SSH Key mode shows tall multiline TextInput for PEM key + optional passphrase field.

---

### 11. Process Search / Filter ✅

**Implemented in:** `artifacts/mobile/app/(tabs)/processes.tsx`

```typescript
const [search, setSearch] = useState("");
const filtered = (processes || []).filter(p =>
  p.name.toLowerCase().includes(search.toLowerCase())
);
```

Search bar: TextInput + Feather search icon + X clear button below header. Count bar updates to "Showing N of M processes" when filter is active.

---

### 12. ANSI Color Rendering in Terminal ✅

**Implemented in:** `artifacts/mobile/app/session/[sessionId].tsx`

Custom `parseAnsi(text: string): AnsiSegment[]` splits on `/\x1b\[[0-9;]*m/g`.

Color map:
```
30=#4d4d4d  31=#ff4444  32=#00ff88  33=#ffaa00  34=#5599ff  35=#cc44ff  36=#00ccff  37=#e0e0e0
90=#999999  91=#ff6666  92=#33ff99  93=#ffcc44  94=#77bbff  95=#dd77ff  97=#ffffff
0 → reset to colors.primary (#00ff88)   1 → bold
```

Each segment rendered as `<Text style={{ color, fontWeight }}>`.

---

### 13. Terminal Font Size Adjustment ✅

**Implemented in:** `artifacts/mobile/app/session/[sessionId].tsx`

- `fontSize: number` state, default 12, persisted to AsyncStorage key `"terminal-font-size"`
- A− / A+ buttons in header; step ±1, clamped [8, 20]
- `lineHeight = fontSize * 1.5`

---

### 14. Session Renaming ✅

**Backend:** `PATCH /api/sessions/:id` in `src/routes/sessions.ts`
```typescript
if (req.body.title) session.title = req.body.title;
res.json({ id, title, status, createdAt });
```

**Mobile:** `artifacts/mobile/app/(tabs)/terminal.tsx`
- Long-press session card → inline TextInput with current title pre-filled
- `useRenameSession()` mutation → invalidate sessions query
