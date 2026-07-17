import http from "http";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import WebSocket from "ws";

vi.mock("../sshManager.js", () => ({
  getSession: vi.fn(() => ({ id: "session-1", title: "Test", status: "connected", createdAt: new Date() })),
  addOutputListener: vi.fn(() => () => {}),
  sendToSession: vi.fn(),
  resizeSession: vi.fn(),
}));

vi.mock("../logger.js", () => ({
  default: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

describe("setupWebSocket", () => {
  let server: http.Server;
  let port: number;
  let cleanup: { close(): void } | null = null;

  beforeEach(async () => {
    process.env.API_TOKEN = "secret-token";
    server = http.createServer((_req, res) => {
      res.writeHead(200);
      res.end("ok");
    });
    const { setupWebSocket } = await import("../wsHandler.js");
    cleanup = setupWebSocket(server);
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", () => resolve()));
    port = (server.address() as any).port;
  });

  afterEach(async () => {
    cleanup?.close();
    cleanup = null;
    await new Promise<void>((resolve) => server.close(() => resolve()));
    delete process.env.API_TOKEN;
    vi.resetModules();
  });

  it("accepts an authenticated terminal connection via subprotocol", async () => {
    await new Promise<void>((resolve, reject) => {
      const ws = new WebSocket(`ws://127.0.0.1:${port}/api/ws/terminal/session-1`, ["secret-token"]);
      ws.once("open", () => {
        ws.close();
        resolve();
      });
      ws.once("error", reject);
    });
  });

  it("rejects a token passed only in the query string", async () => {
    await new Promise<void>((resolve, reject) => {
      const ws = new WebSocket(`ws://127.0.0.1:${port}/api/ws/terminal/session-1?token=secret-token`);
      ws.once("open", () => reject(new Error("connection should not open without subprotocol auth")));
      ws.once("close", () => resolve());
      ws.once("error", () => resolve());
    });
  });
});
