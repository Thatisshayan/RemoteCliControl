import { AddressInfo } from "net";
import type { Server } from "http";
import WebSocket from "ws";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

// Full happy-path smoke test: connection -> session -> terminal (WS) -> files.
// SSH/SFTP are mocked at the sshManager boundary so the test exercises the
// real Express app, real route wiring, real WS upgrade handling, and the
// real shared-contract validation, without needing a live SSH server.

vi.mock("../lib/store.js", async () => {
  const actual = await vi.importActual<typeof import("../lib/store.js")>("../lib/store.js");
  let connections: any[] = [];
  let activeId: string | null = null;
  let counter = 0;

  return {
    ...actual,
    getActiveConnection: vi.fn(() => connections.find((c) => c.id === activeId) ?? null),
    getActiveConnectionSafe: vi.fn(() => {
      const conn = connections.find((c) => c.id === activeId);
      return conn ? actual.toSafeConnectionProfile(conn) : null;
    }),
    getConnectionsSafe: vi.fn(() => connections.map((c) => actual.toSafeConnectionProfile(c))),
    getConnectionById: vi.fn((id: string) => connections.find((c) => c.id === id)),
    addConnection: vi.fn((data: any) => {
      counter += 1;
      const profile = { id: `conn-${counter}`, authMode: data.privateKey ? "key" : "password", ...data };
      connections.push(profile);
      if (connections.length === 1) activeId = profile.id;
      return profile;
    }),
    removeConnection: vi.fn((id: string) => {
      const before = connections.length;
      connections = connections.filter((c) => c.id !== id);
      if (activeId === id) activeId = connections[0]?.id ?? null;
      return connections.length < before;
    }),
    setActiveConnection: vi.fn((id: string) => {
      activeId = id;
    }),
  };
});

vi.mock("../lib/sshManager.js", () => {
  const listeners = new Map<string, Set<(data: string) => void>>();
  const sessions = new Map<string, any>();
  let counter = 0;

  const fakeSftp = {
    readdir: (_p: string, cb: any) => cb(null, [{ filename: "notes.txt" }]),
    stat: (_p: string, cb: any) => cb(null, { size: 42, mtime: Date.now() / 1000, mode: 0o644, isDirectory: () => false, isSymbolicLink: () => false }),
  };

  return {
    listSessions: vi.fn(() => Array.from(sessions.values())),
    getSession: vi.fn((id: string) => sessions.get(id)),
    createSession: vi.fn(async () => {
      counter += 1;
      const session = {
        id: `sess-${counter}`,
        title: `Session ${counter}`,
        status: "connected",
        createdAt: new Date().toISOString(),
      };
      sessions.set(session.id, session);
      listeners.set(session.id, new Set());
      return session;
    }),
    closeSession: vi.fn((id: string) => {
      listeners.delete(id);
      return sessions.delete(id);
    }),
    addOutputListener: vi.fn((id: string, fn: (data: string) => void) => {
      listeners.get(id)?.add(fn);
      return () => listeners.get(id)?.delete(fn);
    }),
    sendToSession: vi.fn((id: string, data: string) => {
      const fns = listeners.get(id);
      if (!fns) return false;
      for (const fn of fns) fn(`echo:${data}`);
      return true;
    }),
    resizeSession: vi.fn(() => true),
    markUserInitiatedClose: vi.fn(),
    testConnection: vi.fn(async () => ({ success: true, message: "Connected successfully", latencyMs: 5 })),
    getSftp: vi.fn(async () => fakeSftp),
  };
});

let server: Server;
let baseUrl: string;
let wsUrl: string;

beforeAll(async () => {
  delete process.env.API_TOKEN;
  const { default: app } = await import("../app.js");
  const { setupWebSocket } = await import("../lib/wsHandler.js");
  server = app.listen(0);
  await new Promise<void>((resolve) => server.once("listening", resolve));
  setupWebSocket(server);
  const port = (server.address() as AddressInfo).port;
  baseUrl = `http://127.0.0.1:${port}`;
  wsUrl = `ws://127.0.0.1:${port}`;
});

afterAll(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()));
});

describe("end-to-end happy path", () => {
  it("connects, opens a session, drives the terminal, and browses files", async () => {
    // 1. Connection
    const connectionResponse = await request(baseUrl)
      .post("/api/connection")
      .send({ host: "example.com", port: 22, username: "root", password: "secret", authMode: "password" })
      .expect(200);
    expect(connectionResponse.body).toMatchObject({ host: "example.com", authMode: "password", hasPassword: true });
    expect(connectionResponse.body.password).toBeUndefined();

    const activeResponse = await request(baseUrl).get("/api/connections/active").expect(200);
    expect(activeResponse.body.id).toBe(connectionResponse.body.id);

    // 2. Session
    const createSessionResponse = await request(baseUrl).post("/api/sessions").expect(201);
    const sessionId = createSessionResponse.body.id;
    expect(createSessionResponse.body).toMatchObject({ status: "connected" });

    const listSessionsResponse = await request(baseUrl).get("/api/sessions").expect(200);
    expect(listSessionsResponse.body.map((s: any) => s.id)).toContain(sessionId);

    // 3. Terminal over WebSocket
    const ws = new WebSocket(`${wsUrl}/api/ws/terminal/${sessionId}`, [], {});
    await new Promise<void>((resolve, reject) => {
      ws.once("open", resolve);
      ws.once("error", reject);
    });

    const echoed = await new Promise<string>((resolve, reject) => {
      ws.once("message", (data) => resolve(data.toString()));
      ws.once("error", reject);
      ws.send("ls\n");
    });
    expect(echoed).toBe("echo:ls\n");
    ws.close();
    await new Promise<void>((resolve) => ws.once("close", () => resolve()));

    // 4. Files
    const filesResponse = await request(baseUrl).get("/api/files").query({ path: "/home" }).expect(200);
    expect(filesResponse.body.path).toBe("/home");
    expect(filesResponse.body.items).toEqual(
      expect.arrayContaining([expect.objectContaining({ name: "notes.txt" })]),
    );

    // Cleanup: close the session
    await request(baseUrl).delete(`/api/sessions/${sessionId}`).expect(200);
    const finalSessionsResponse = await request(baseUrl).get("/api/sessions").expect(200);
    expect(finalSessionsResponse.body.map((s: any) => s.id)).not.toContain(sessionId);
  });
});
