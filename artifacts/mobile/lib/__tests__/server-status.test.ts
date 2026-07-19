import { renderHook, waitFor, act } from "@testing-library/react-native";
import { useServerStatus } from "../server-status";

jest.mock("@remotectrl/api-client-react", () => ({
  publicApi: { get: jest.fn() },
}));

const { publicApi } = jest.requireMock("@remotectrl/api-client-react");

describe("useServerStatus", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("reports health/tunnel/version once all three succeed", async () => {
    (publicApi.get as jest.Mock).mockImplementation((path: string) => {
      if (path === "/health") return Promise.resolve({ status: "ok", uptimeSeconds: 100, activeSessions: 2 });
      if (path === "/tunnel-url") return Promise.resolve({ active: true, tunnelUrl: "https://tunnel.example.com" });
      if (path === "/version") return Promise.resolve({ version: "1.0.4", mobileMinVersion: "1.0.0" });
      throw new Error(`unexpected path ${path}`);
    });

    const { result } = renderHook(() => useServerStatus("https://example.com", { intervalMs: 999999 }));

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.health?.uptimeSeconds).toBe(100);
    expect(result.current.tunnelStatus?.tunnelUrl).toBe("https://tunnel.example.com");
    expect(result.current.mobileMinVersion).toBe("1.0.0");
    expect(result.current.isUnreachable).toBe(false);
  });

  it("tolerates /version failing without failing the whole refresh", async () => {
    (publicApi.get as jest.Mock).mockImplementation((path: string) => {
      if (path === "/health") return Promise.resolve({ status: "ok", uptimeSeconds: 5, activeSessions: 0 });
      if (path === "/tunnel-url") return Promise.resolve({ active: false, tunnelUrl: null });
      if (path === "/version") return Promise.reject(new Error("not found"));
      throw new Error(`unexpected path ${path}`);
    });

    const { result } = renderHook(() => useServerStatus("https://example.com", { intervalMs: 999999 }));

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.health).not.toBeNull();
    expect(result.current.mobileMinVersion).toBeUndefined();
    expect(result.current.isUnreachable).toBe(false);
  });

  it("marks the server unreachable on a network failure, clearing prior data", async () => {
    (publicApi.get as jest.Mock).mockImplementation(() => Promise.reject(new TypeError("Network request failed")));

    const { result } = renderHook(() => useServerStatus("https://example.com", { intervalMs: 999999 }));

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.isUnreachable).toBe(true);
    expect(result.current.health).toBeNull();
    expect(result.current.tunnelStatus).toBeNull();
  });

  it("does not flag isUnreachable for a coded API error (server responded)", async () => {
    const codedError = new Error("Forbidden") as Error & { code?: string };
    codedError.code = "HTTP_403";
    (publicApi.get as jest.Mock).mockImplementation((path: string) => {
      if (path === "/health") return Promise.reject(codedError);
      if (path === "/tunnel-url") return Promise.resolve({ active: false, tunnelUrl: null });
      if (path === "/version") return Promise.resolve({ version: "1.0.4" });
      throw new Error(`unexpected path ${path}`);
    });

    const { result } = renderHook(() => useServerStatus("https://example.com", { intervalMs: 999999 }));

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.isUnreachable).toBe(false);
  });

  it("refetch() re-runs the poll on demand", async () => {
    let call = 0;
    (publicApi.get as jest.Mock).mockImplementation((path: string) => {
      if (path === "/health") {
        call += 1;
        return call === 1
          ? Promise.reject(new TypeError("Network request failed"))
          : Promise.resolve({ status: "ok", uptimeSeconds: 1, activeSessions: 0 });
      }
      if (path === "/tunnel-url") return Promise.resolve({ active: false, tunnelUrl: null });
      if (path === "/version") return Promise.resolve({ version: "1.0.4" });
      throw new Error(`unexpected path ${path}`);
    });

    const { result } = renderHook(() => useServerStatus("https://example.com", { intervalMs: 999999 }));

    await waitFor(() => expect(result.current.isUnreachable).toBe(true));

    await act(async () => {
      await result.current.refetch();
    });

    expect(result.current.isUnreachable).toBe(false);
    expect(result.current.health?.uptimeSeconds).toBe(1);
  });
});
