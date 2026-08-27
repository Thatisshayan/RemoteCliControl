import Foundation

enum SanitizeCommandError: LocalizedError {
    case tooLong
    case nullByte

    var errorDescription: String? {
        switch self {
        case .tooLong: return "Command too long"
        case .nullByte: return "Null byte not allowed"
        }
    }
}

/// Strips ANSI SGR escape sequences and trims whitespace. Enforces length
/// and null-byte constraints. The server's SSH layer is the real security
/// boundary -- this only prevents obviously invalid input from being sent
/// over the WebSocket (matches the old app's lib/sanitize-command.ts).
func sanitizeCommand(_ input: String) throws -> String {
    var cmd = input.replacingOccurrences(
        of: #"\x1B\[[0-9;]*m"#,
        with: "",
        options: .regularExpression
    )
    cmd = cmd.trimmingCharacters(in: .whitespacesAndNewlines)
    if cmd.isEmpty { return cmd }
    if cmd.count > 128 { throw SanitizeCommandError.tooLong }
    if cmd.contains("\0") { throw SanitizeCommandError.nullByte }
    return cmd
}
