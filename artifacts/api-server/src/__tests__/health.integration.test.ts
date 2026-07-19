import type { AddressInfo } from "net";
import type { Server } from "http";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("../lib/sshManager.js", () => ({
  listSessions: vi.fn(() => [{ id: "1", title: "Session 1", status: "connected", createdAt: "2024-01-01T00:00:00.000Z" }]),
  getSession: vi.fn(() => undefined),
  createSession: vi.fn(),
  closeSession: vi.fn(() => false),
  addOutputListener: vi.fn(() => () => {}),
  sendToSession: vi.fn(() => false),
  resizeSession: vi.fn(() => false),
  markUserInitiatedClose: vi.fn(),
  testConnection: vi.fn(),
  getSftp: vi.fn(),
  execCommand: vi.fn(),
}));

vi.mock("../lib/store.js", () => ({
  getActiveConnection: vi.fn(() => null),
  getActiveConnectionSafe: vi.fn(() => null),
  getConnectionsSafe: vi.fn(() => []),
  addConnection: vi.fn(),
  removeConnection: vi.fn(),
  setActiveConnection: vi.fn(),
  getConnectionById: vi.fn(),
  getPushDevices: vi.fn(() => []),
  registerPushDevice: vi.fn(),
  removePushDevice: vi.fn(),
  getNotificationPreferences: vi.fn(() => ({ sessionDisconnected: true, serverHealthChange: true })),
  updateNotificationPreferences: vi.fn(),
  getCommands: vi.fn(() => []),
  addCommand: vi.fn(),
  removeCommand: vi.fn(),
}));

describe("GET /health", () => {
  let server: Server;
  let baseUrl: string;

  beforeAll(async () => {
    delete process.env.API_TOKEN;
    const { default: app } = await import("../app.js");
    server = app.listen(0);
    await new Promise<void>((resolve) => server.once("listening", resolve));
    const port = (server.address() as AddressInfo).port;
    baseUrl = `http://127.0.0.1:${port}`;
  }, 30000);

  afterAll(async () => {
    if (!server) return;
    await new Promise<void>((resolve) => server.close(() => resolve()));
  });

  it("returns JSON with status ok and required fields", async () => {
    const response = await request(baseUrl).get("/health");
    expect(response.status).toBe(200);
    expect(response.headers["content-type"]).toMatch(/^application\/json/);
    expect(response.body).toHaveProperty("status", "ok");
    expect(response.body).toHaveProperty("activeSessions");
    expect(typeof response.body.activeSessions).toBe("number");
    expect(response.body).toHaveProperty("uptimeSeconds");
    expect(typeof response.body.uptimeSeconds).toBe("number");
    expect(response.body).toHaveProperty("version");
    expect(response.body).toHaveProperty("authMode");
    expect(["none", "token"]).toContain(response.body.authMode);
    expect(response.body).toHaveProperty("tunnelEnabled");
    expect(typeof response.body.tunnelEnabled).toBe("boolean");
  });
});
