// Normalizes the handful of error shapes screens actually see into one
// consistent, user-facing message, instead of each screen doing its own
// `err.message` (which surfaces raw fetch/JSON/zod internals verbatim) or
// its own ad-hoc wording.
//
// Error shapes seen in practice:
// - API errors from the shared client (lib/api-client-react/src/client.ts):
//   a real Error with `.code` (e.g. "VALIDATION_ERROR", "HTTP_404") and a
//   server-authored `.message` that's already reasonable to show as-is.
// - Network failures: `fetch` itself rejects (no HTTP response at all) with
//   a plain Error/TypeError, no `.code` -- this is the "server unreachable"
//   case, distinct from the server responding with an error.
// - Response parsing failures: the shared client's schema.parse(json) throws
//   a ZodError when the server returned a 2xx with an unexpected shape.
// - Anything else (a thrown string, undefined, a non-Error object).

const NETWORK_ERROR_PATTERNS = [
  /network request failed/i,
  /failed to fetch/i,
  /fetch failed/i,
  /load failed/i, // Safari/WebKit's fetch failure wording
  /timeout/i,
  /econnrefused/i,
  /econnreset/i,
];

interface CodedError extends Error {
  code?: string;
}

function hasCode(err: unknown): err is CodedError {
  return err instanceof Error && typeof (err as CodedError).code === "string";
}

/**
 * True when the error indicates the request never reached the server (DNS
 * failure, connection refused, timeout, offline) rather than the server
 * responding with an error status. Screens use this to distinguish a
 * "server unreachable, offer retry" state from a normal validation/API error.
 */
export function isServerUnreachable(err: unknown): boolean {
  if (!(err instanceof Error)) return false;
  if (hasCode(err)) return false; // the server responded — it's reachable
  return NETWORK_ERROR_PATTERNS.some((pattern) => pattern.test(err.message));
}

/**
 * Returns a single user-facing message for any error a screen might catch
 * from a react-query call or a direct api.* call.
 */
export function getErrorMessage(err: unknown): string {
  if (isServerUnreachable(err)) {
    return "Can't reach the server. Check your connection and the server URL in Settings.";
  }
  if (err instanceof Error) {
    if (err.name === "ZodError") {
      return "The server returned an unexpected response. Try again, or check Settings for a version mismatch.";
    }
    return err.message || "Something went wrong.";
  }
  if (typeof err === "string" && err.trim()) {
    return err;
  }
  return "Something went wrong.";
}
