RemoteCTRL — Improvement & Feature Specifications
1. Persistent Storage (JSON file on disk)
Goal: Connection credentials and saved commands survive server restarts.

How to implement:

Replace the in-memory store.ts with a file-backed version. On startup, read a JSON file from disk into memory. On every write, sync the file back to disk.

Choose a file path like process.cwd() + "/data/store.json". Create the data/ directory if it doesn't exist (use fs.mkdirSync(dir, { recursive: true })).

The JSON file structure:

{
  "connection": {
    "host": "192.168.1.10",
    "port": 22,
    "username": "john",
    "password": "secret"
  },
  "commands": [
    { "id": "abc123", "label": "List dir", "command": "dir /w", "description": "" }
  ]
}

setConnection and addCommand/removeCommand should call a private persist() function that does fs.writeFileSync(filePath, JSON.stringify(state, null, 2)) after each mutation.

On startup, wrap the fs.readFileSync in a try/catch — if the file doesn't exist yet, start with the default empty state and create the file on the first write.

2. Command History Per Terminal Session
Goal: Up/down on-screen buttons cycle through previously typed commands in a session, like a real shell.

How to implement:

In session/[sessionId].tsx, add two new pieces of state:

history: string[] — array of commands sent, newest last
historyIndex: number — current position (-1 means not browsing history)
When the user sends a command (calls sendInput):

Push the command string onto history
Reset historyIndex to -1
Add two small ▲ / ▼ buttons in the quick key bar next to Tab / Ctrl+C / Ctrl+D.

Pressing ▲: if historyIndex === -1, set it to history.length - 1; else decrement. Set input to history[historyIndex].
Pressing ▼: if historyIndex === -1 do nothing; else increment. If past the end, reset to -1 and clear input. Otherwise set input to history[historyIndex].
Keep history capped at the last 100 commands to avoid unbounded growth. History lives only in component state — it resets if you leave the screen, which is fine.

3. Auto-Reconnect WebSocket
Goal: If the network drops briefly, the terminal silently reconnects instead of going dead.

How to implement:

In session/[sessionId].tsx, replace the plain WebSocket setup with a reconnecting wrapper. Use a reconnectAttempts ref (starts at 0) and a shouldReconnect ref (boolean, set to false when the user intentionally closes the session or navigates away).

On ws.onclose:

Set connected to false
If shouldReconnect.current is true and reconnectAttempts.current < 10:
Increment reconnectAttempts.current
Calculate delay: Math.min(1000 * 2 ** reconnectAttempts.current, 30000) (exponential backoff, capped at 30 s)
setTimeout(() => openWs(), delay) where openWs is the function that creates and configures a new WebSocket
On ws.onopen:

Reset reconnectAttempts.current to 0
Set connected to true
On component unmount (cleanup in useEffect):

Set shouldReconnect.current to false
Close the socket
Show the user a small reconnect status in the header: "Reconnecting (2/10)..." using a reconnectStatus: string state variable.

4. Keep Screen Awake
Goal: Prevent the phone from dimming or sleeping while a terminal session is open.

How to implement:

Install expo-keep-awake. In session/[sessionId].tsx, call useKeepAwake() at the top of the component (it's a hook from expo-keep-awake). That's the entire implementation — it activates while the screen is mounted and deactivates automatically when you navigate away.

5. File Download to Phone
Goal: Long-pressing a file (not a directory) shows an option to download it to the phone.

How to implement:

Backend: Add a new route GET /files/download?path=/remote/path/to/file. In the handler, call getSftp(), then use sftp.createReadStream(filePath) and pipe it into the Express response. Set the header Content-Disposition: attachment; filename="<basename>" and Content-Type: application/octet-stream.

Mobile: In files.tsx, update the handleLongPress logic. If the item is a file (not a directory), show an Alert.alert with two options: "Download" and "Delete".

On "Download":

Use expo-file-system FileSystem.downloadAsync(url, localUri) where url is https://${process.env.EXPO_PUBLIC_DOMAIN}/api/files/download?path=<encoded path> and localUri is FileSystem.documentDirectory + filename.
After download, use expo-sharing Sharing.shareAsync(localUri) to let the user save it to Files, AirDrop it, etc.
Show an ActivityIndicator while in progress and an alert on completion or error.
6. File Upload from Phone
Goal: A button lets the user pick a file from their phone and upload it to the current SFTP directory.

How to implement:

Backend: Add a new route POST /files/upload?path=/remote/dir. Use multer (or manually read the raw body) to receive a multipart file upload. In the handler:

Get the uploaded file as a Buffer
Call getSftp()
Write the buffer to remotePath using sftp.writeFile(remotePath, buffer, callback) (or pipe a Readable.from(buffer) through sftp.createWriteStream)
Call client.end(), return { success: true }
Mobile: Add an upload icon button (Feather upload) to the header of files.tsx. On press:

Call DocumentPicker.getDocumentAsync() from expo-document-picker to let the user pick any file
Read it as a base64 string with FileSystem.readAsStringAsync(uri, { encoding: 'base64' })
Send a multipart/form-data POST to /api/files/upload?path=<encoded currentPath + "/" + filename> using fetch (React Query mutation is also fine)
Invalidate the file list query on success
7. Text File Preview In-App
Goal: Tapping a file (not a directory) opens a modal that shows its text content.

How to implement:

Backend: Add GET /files/read?path=/remote/file.txt. In the handler, open SFTP and call sftp.readFile(filePath) which returns a Buffer. Return { content: buffer.toString('utf8') }. Cap at the first 100 KB to avoid sending huge files — check stat first and return a { error: "File too large" } if it exceeds that.

Mobile: In files.tsx, change the onPress for non-directory items to open a preview modal instead of doing nothing.

Add state: previewContent: string | null, previewName: string | null, previewLoading: boolean.

On tap of a file:

Set previewName to the filename, set previewLoading to true
fetch GET /api/files/read?path=<encoded path>
On success set previewContent to the response content
The preview modal (Modal, presentationStyle="pageSheet"):

Header: filename + close button
Scrollable Text with monospace font (Inter_400Regular), small font size (12), green color
If the file is too large, show the error message instead
8. Send Saved Command Directly to a Session
Goal: Tap a saved command, then pick an active session to fire it into — not just copy to clipboard.

How to implement:

Mobile: In commands.tsx, replace the single onPress (copy to clipboard) with a bottom action sheet or a new small modal that appears when you tap a command card.

The sheet/modal shows:

"Copy to clipboard" (existing behavior)
"Send to session →" — only shown if sessions.length > 0
If "Send to session" is pressed and there are multiple sessions, show a second list of all active sessions (from GET /sessions). If there's only one session, send immediately.

To actually "send" the command, you need a way to trigger input from outside the session screen. The cleanest approach: navigate to session/[sessionId] and pass the command as a query parameter (router.push(/session/${id}?prefill=${encodeURIComponent(command)})). In session/[sessionId].tsx, read the prefill query param on mount — if it exists, put it in input state and call sendInput automatically (or just pre-fill the input box and let the user press send).

9. Multiple SSH Connection Profiles
Goal: Save multiple SSH targets and switch between them with a single tap.

How to implement:

Backend: Change the store from connection: ConnectionConfig | null to connections: ConnectionProfile[] and activeConnectionId: string | null.

interface ConnectionProfile extends ConnectionConfig {
  id: string;
  name: string;   // user-defined label, e.g. "Home PC"
}

New routes:

GET /connections — returns all profiles (passwords should ideally be masked here)
POST /connections body: { name, host, port, username, password } — creates a new profile, returns it (201)
DELETE /connections/:id — deletes a profile
POST /connections/:id/activate — sets activeConnectionId; getConnection() returns the active profile
GET /connections/active — returns the currently active profile
Mobile: Replace the single Connection screen with a Connection Profiles list screen. Each profile shows name, host, and an "Active" badge. Tap to activate. Swipe-to-delete or long-press-to-delete. A FAB opens the Add Profile form (same fields as current connection form, plus a Name field at the top).

10. SSH Key Authentication
Goal: Let the user paste a private key string (PEM format) as an alternative to a password.

How to implement:

Backend: Add an optional privateKey: string field to ConnectionConfig. In sshManager.ts, in every conn.connect(...) call, conditionally pass either password or privateKey:

conn.connect({
  host: cfg.host,
  port: cfg.port,
  username: cfg.username,
  ...(cfg.privateKey
    ? { privateKey: cfg.privateKey }
    : { password: cfg.password }),
  readyTimeout: 15000,
});

ssh2 supports PEM private keys natively — just pass the raw string.

Mobile: In the connection form, add a segmented control or toggle between "Password" and "SSH Key" auth modes. When "SSH Key" is selected, hide the password field and show a tall multiline TextInput for the PEM key (labeled "Private Key (PEM format)"). The placeholder should say -----BEGIN OPENSSH PRIVATE KEY-----. Mark the field secureTextEntry={false} and autoCorrect={false} autoCapitalize="none".

Passphrase-protected keys: add an optional "Passphrase" field (single-line, secure). Pass passphrase: cfg.passphrase to conn.connect() if provided.

11. Process Search / Filter
Goal: A search bar on the Processes tab to filter the list by process name.

How to implement:

Mobile only (purely frontend, no backend changes needed).

In processes.tsx, add state search: string. Add a TextInput search bar below the header (same style as other inputs — backgroundColor: colors.card, borderColor: colors.border). A Feather search icon on the left, an X button to clear.

Filter the processes list before passing to FlatList:

const filtered = (processes as RemoteProcess[]).filter(p =>
  p.name.toLowerCase().includes(search.toLowerCase())
);

Pass filtered to FlatList instead of processes. Update the count bar to say "Showing N of M processes" when a search is active.

12. ANSI Color Rendering in Terminal
Goal: Programs like git, npm, ls --color, PowerShell color output render with actual colors instead of garbled escape codes.

How to implement:

Install ansi-to-react (works in React Native with some caveats) or build a lightweight ANSI parser yourself.

The simplest custom approach: write a function parseAnsi(text: string): { text: string, color?: string, bold?: boolean }[] that uses a regex to split on ANSI sequences (/\x1b\[[0-9;]*m/g) and maps common SGR codes (30-37 = standard colors, 90-97 = bright colors, 1 = bold, 0 = reset) to hex color values.

In session/[sessionId].tsx, instead of rendering output as a single <Text>, break it into segments and render each segment as a <Text> with the appropriate color and fontWeight style props.

Color mapping for the 8 standard ANSI colors (plus bright variants):

30 = #4d4d4d   31 = #ff4444   32 = #00ff88   33 = #ffaa00
34 = #5599ff   35 = #cc44ff   36 = #00ccff   37 = #e0e0e0
90 = #999999   91 = #ff6666   92 = #33ff99   93 = #ffcc44
94 = #77bbff   95 = #dd77ff   97 = #ffffff

Reset (code 0) returns to the default foreground color (#00ff88 in the app's theme).

13. Terminal Font Size Adjustment
Goal: +/− buttons on the session screen to make the terminal text larger or smaller.

How to implement:

In session/[sessionId].tsx, add state fontSize: number initialized to 12 (the current hardcoded value). Persist this to AsyncStorage so it's remembered across sessions.

Add two small buttons to the header area (or the quick key bar): A- and A+. Each press decrements/increments fontSize by 1, clamped between 8 and 20.

Replace the hardcoded fontSize: 12 in the output text style with the fontSize state variable. Also update lineHeight to be fontSize * 1.5 so it scales proportionally.

14. Session Renaming
Goal: Long-press a session card in the terminal list to rename it.

How to implement:

Backend: Add PATCH /sessions/:id body: { title: string }. In sshManager.ts, find the ActiveSession in the map by ID and update its title field. Return the updated Session.

Mobile: In terminal.tsx, add an onLongPress handler to each session card. Show an Alert.prompt (iOS) or a simple modal with a TextInput (Android, since Alert.prompt doesn't exist there). Pre-fill with the current session title. On confirm, call PATCH /sessions/:id via a React Query mutation, then invalidate the sessions query.

