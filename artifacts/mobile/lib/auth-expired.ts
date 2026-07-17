// A single place for "the saved API token no longer works" to be detected
// and reacted to, without threading error handling through every screen and
// react-query hook individually. app/_layout.tsx wires this to react-query's
// global QueryCache/MutationCache onError; runtime-config.tsx subscribes to
// flip an `authExpired` flag that the root layout uses to redirect to
// Settings — the one place a user can fix a bad token.

type Listener = () => void;

let listeners: Listener[] = [];

export function onAuthExpired(listener: Listener): () => void {
  listeners.push(listener);
  return () => {
    listeners = listeners.filter((l) => l !== listener);
  };
}

export function notifyAuthExpired(): void {
  for (const listener of listeners) listener();
}

// The server's authMiddleware (artifacts/api-server/src/lib/auth.ts) only
// ever returns 401 with one of these two codes, and only when it actually
// requires a token — so either one reliably means "the token we sent was
// rejected," not a transient network or server error.
export function isAuthExpiredError(error: unknown): boolean {
  const code = (error as { code?: unknown } | null | undefined)?.code;
  return code === "AUTH_REQUIRED" || code === "AUTH_INVALID";
}
