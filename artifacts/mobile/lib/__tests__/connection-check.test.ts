import { checkConnection } from "../connection-check";

function mockFetchSequence(...responses: Array<{ ok: boolean; status: number } | Error>) {
  const fn = jest.fn();
  for (const response of responses) {
    if (response instanceof Error) {
      fn.mockImplementationOnce(() => Promise.reject(response));
    } else {
      fn.mockImplementationOnce(() => Promise.resolve(response as Response));
    }
  }
  global.fetch = fn as unknown as typeof fetch;
  return fn;
}

beforeEach(() => {
  jest.restoreAllMocks();
});

describe("checkConnection", () => {
  it("reports unreachable when the health check fails to connect", async () => {
    mockFetchSequence(new Error("Network request failed"));

    const result = await checkConnection("https://example.com");

    expect(result).toEqual({
      reachable: false,
      authOk: false,
      ok: false,
      message: "Network request failed",
    });
  });

  it("reports unreachable when the health check returns a non-2xx status", async () => {
    mockFetchSequence({ ok: false, status: 502 });

    const result = await checkConnection("https://example.com");

    expect(result.reachable).toBe(false);
    expect(result.ok).toBe(false);
    expect(result.message).toBe("Server returned 502");
  });

  it("reports the token as rejected when the server is reachable but auth fails", async () => {
    const fetchMock = mockFetchSequence({ ok: true, status: 200 }, { ok: false, status: 401 });

    const result = await checkConnection("https://example.com", "wrong-token");

    expect(result).toEqual({
      reachable: true,
      authOk: false,
      ok: false,
      message: "Server reachable, but the API token was rejected",
    });
    // Auth header must actually carry the token being tested, not a stale one.
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      "https://example.com/api/connection",
      expect.objectContaining({ headers: { Authorization: "Bearer wrong-token" } }),
    );
  });

  it("reports success when the server and token are both valid", async () => {
    mockFetchSequence({ ok: true, status: 200 }, { ok: true, status: 200 });

    const result = await checkConnection("https://example.com", "good-token");

    expect(result).toEqual({ reachable: true, authOk: true, ok: true, message: "Connected successfully" });
  });

  it("treats a 404 (no connection configured yet) as a valid authenticated response", async () => {
    mockFetchSequence({ ok: true, status: 200 }, { ok: false, status: 404 });

    const result = await checkConnection("https://example.com", "good-token");

    expect(result.ok).toBe(true);
    expect(result.authOk).toBe(true);
  });

  it("omits the Authorization header entirely when no token is provided", async () => {
    const fetchMock = mockFetchSequence({ ok: true, status: 200 }, { ok: true, status: 200 });

    await checkConnection("https://example.com");

    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      "https://example.com/api/connection",
      expect.objectContaining({ headers: {} }),
    );
  });

  it("strips a trailing slash from the base URL before building request URLs", async () => {
    const fetchMock = mockFetchSequence({ ok: true, status: 200 }, { ok: true, status: 200 });

    await checkConnection("https://example.com/");

    expect(fetchMock).toHaveBeenNthCalledWith(1, "https://example.com/health", expect.anything());
    expect(fetchMock).toHaveBeenNthCalledWith(2, "https://example.com/api/connection", expect.anything());
  });

  it("reports an unexpected status distinctly from a rejected token", async () => {
    mockFetchSequence({ ok: true, status: 200 }, { ok: false, status: 500 });

    const result = await checkConnection("https://example.com", "some-token");

    expect(result.ok).toBe(false);
    expect(result.authOk).toBe(false);
    expect(result.message).toBe("Unexpected response (500)");
  });

  it("reports a network failure on the auth check separately from an unreachable server", async () => {
    mockFetchSequence({ ok: true, status: 200 }, new Error("timed out"));

    const result = await checkConnection("https://example.com", "some-token");

    // The server *was* reachable — only the second (authenticated) call failed.
    expect(result.reachable).toBe(true);
    expect(result.ok).toBe(false);
    expect(result.message).toBe("timed out");
  });
});
