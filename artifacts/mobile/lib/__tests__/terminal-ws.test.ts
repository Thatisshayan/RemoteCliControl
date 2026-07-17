jest.mock("@remotectrl/api-client-react", () => ({
  buildWebSocketUrl: jest.fn((path: string) => `ws://mock-host${path}`),
}));

import { buildWebSocketUrl } from "@remotectrl/api-client-react";
import { buildTerminalSocketArgs, sanitizeSessionId } from "../terminal-ws";

beforeEach(() => {
  jest.clearAllMocks();
});

describe("sanitizeSessionId", () => {
  it("passes through an already-safe session id", () => {
    expect(sanitizeSessionId("abc123_-XYZ")).toBe("abc123_-XYZ");
  });

  it("strips characters outside [a-zA-Z0-9_-]", () => {
    expect(sanitizeSessionId("abc/../123")).toBe("abc123");
    expect(sanitizeSessionId("abc 123")).toBe("abc123");
    expect(sanitizeSessionId("abc?token=x")).toBe("abctokenx");
  });

  it("returns null for null input", () => {
    expect(sanitizeSessionId(null)).toBeNull();
  });

  it("returns null for an empty string", () => {
    expect(sanitizeSessionId("")).toBeNull();
  });

  it("returns null when sanitizing strips everything", () => {
    expect(sanitizeSessionId("///???")).toBeNull();
  });
});

describe("buildTerminalSocketArgs", () => {
  it("builds the WS path from the sanitized session id via the shared client", () => {
    buildTerminalSocketArgs("sess-123");
    expect(buildWebSocketUrl).toHaveBeenCalledWith("/api/ws/terminal/sess-123");
  });

  it("returns the URL produced by the shared client unchanged", () => {
    const { url } = buildTerminalSocketArgs("sess-123");
    expect(url).toBe("ws://mock-host/api/ws/terminal/sess-123");
  });

  it("carries the API token as the sole WebSocket subprotocol when present", () => {
    // The token travels as a subprotocol (not a query param) so it never
    // ends up in access/proxy/edge logs — see
    // artifacts/api-server/src/lib/wsHandler.ts.
    const { protocols } = buildTerminalSocketArgs("sess-123", "secret-token");
    expect(protocols).toEqual(["secret-token"]);
  });

  it("returns no subprotocol when there is no token (unauthenticated server mode)", () => {
    expect(buildTerminalSocketArgs("sess-123", undefined).protocols).toEqual([]);
    expect(buildTerminalSocketArgs("sess-123", null).protocols).toEqual([]);
    expect(buildTerminalSocketArgs("sess-123", "").protocols).toEqual([]);
  });
});
