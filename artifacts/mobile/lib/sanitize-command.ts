/**
 * Strips ANSI escape sequences and trims whitespace from a terminal command.
 * Enforces length and null-byte constraints.
 *
 * The server SSH layer is the real security boundary — this function only
 * prevents obviously invalid input from being sent over the WebSocket.
 */
export function sanitizeCommand(cmd: string): string {
  if (!cmd || typeof cmd !== "string") return cmd;
  cmd = cmd.replace(/\x1b\[[0-9;]*m/g, "");
  cmd = cmd.trim();
  if (cmd.length === 0) return cmd;
  if (cmd.length > 128) throw new Error("Command too long");
  if (cmd.includes("\x00")) throw new Error("Null byte not allowed");
  return cmd;
}
