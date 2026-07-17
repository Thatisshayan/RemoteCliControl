export interface ConnectionCheckResult {
  reachable: boolean;
  authOk: boolean;
  ok: boolean;
  message: string;
}

const TIMEOUT_MS = 5000;

// A single "Test Connection" action needs to answer two separate questions
// before the user ever reaches a live screen: is the server reachable at
// all, and — independently — is the API token they entered actually
// accepted? `/health` is unauthenticated by design, so it only answers the
// first question; a wrong token still reports "server reachable" there and
// only fails later on a real `/api/*` call. Checking an authenticated route
// here (`/api/connection`) surfaces a rejected token immediately instead.
export async function checkConnection(baseUrl: string, apiToken?: string): Promise<ConnectionCheckResult> {
  const base = baseUrl.replace(/\/+$/, "");

  try {
    const healthResponse = await fetch(`${base}/health`, {
      method: "GET",
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!healthResponse.ok) {
      return { reachable: false, authOk: false, ok: false, message: `Server returned ${healthResponse.status}` };
    }
  } catch (err: any) {
    return { reachable: false, authOk: false, ok: false, message: err?.message || "Could not reach server" };
  }

  try {
    const headers: Record<string, string> = {};
    if (apiToken) headers.Authorization = `Bearer ${apiToken}`;
    const authResponse = await fetch(`${base}/api/connection`, {
      method: "GET",
      headers,
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });

    if (authResponse.status === 401) {
      return { reachable: true, authOk: false, ok: false, message: "Server reachable, but the API token was rejected" };
    }
    // 404 CONNECTION_NOT_FOUND is a valid authenticated response — it just
    // means no connection profile is configured on the server yet.
    if (authResponse.ok || authResponse.status === 404) {
      return { reachable: true, authOk: true, ok: true, message: "Connected successfully" };
    }
    return { reachable: true, authOk: false, ok: false, message: `Unexpected response (${authResponse.status})` };
  } catch (err: any) {
    return { reachable: true, authOk: false, ok: false, message: err?.message || "Token check failed" };
  }
}
