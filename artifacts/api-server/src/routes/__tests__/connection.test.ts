import express from "express";
import pino from "pino";
import pinoHttp from "pino-http";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../lib/store.js", () => ({
  getActiveConnection: vi.fn(),
  getActiveConnectionSafe: vi.fn(),
  getConnectionsSafe: vi.fn(),
  addConnection: vi.fn(),
  removeConnection: vi.fn(),
  setActiveConnection: vi.fn(),
  getConnectionById: vi.fn(),
}));

vi.mock("../../lib/sshManager.js", () => ({
  testConnection: vi.fn(),
}));

import router from "../connection.js";
import {
  addConnection,
  getActiveConnectionSafe,
  getConnectionsSafe,
  getConnectionById,
  removeConnection,
  setActiveConnection,
} from "../../lib/store.js";

describe("connection routes", () => {
  // connection.ts logs create/delete/activate via req.log (audit trail) —
  // route them through a locally captured pino instance instead of the
  // shared logger so audit-log assertions don't depend on stdout, and so
  // req.log exists at all (without pino-http mounted, req.log is undefined
  // and those routes throw).
  const logLines: any[] = [];
  const captureStream = { write: (line: string) => logLines.push(JSON.parse(line)) };
  const testLogger = pino({ level: "info" }, captureStream);

  const app = express();
  app.use(express.json());
  app.use(pinoHttp({ logger: testLogger }));
  app.use(router);

  beforeEach(() => {
    vi.clearAllMocks();
    logLines.length = 0;
  });

  it("GET /connections/active returns only the safe profile", async () => {
    vi.mocked(getActiveConnectionSafe).mockReturnValue({
      id: "conn-1",
      name: "Desktop",
      host: "192.168.0.10",
      port: 22,
      username: "admin",
      authMode: "password",
      hasPassword: true,
      hasPrivateKey: false,
      hasPassphrase: false,
    });

    const response = await request(app).get("/connections/active").expect(200);

    expect(response.body).toMatchObject({
      id: "conn-1",
      authMode: "password",
      hasPassword: true,
    });
    expect(response.body.password).toBeUndefined();
    expect(response.body.privateKey).toBeUndefined();
    expect(response.body.passphrase).toBeUndefined();
  });

  it("POST /connection persists a secret profile but responds with the safe profile", async () => {
    vi.mocked(addConnection).mockReturnValue({
      id: "conn-2",
      name: "Default",
      host: "example.com",
      port: 22,
      username: "root",
      authMode: "password",
      password: "super-secret",
    });
    vi.mocked(getActiveConnectionSafe).mockReturnValue({
      id: "conn-2",
      name: "Default",
      host: "example.com",
      port: 22,
      username: "root",
      authMode: "password",
      hasPassword: true,
      hasPrivateKey: false,
      hasPassphrase: false,
    });

    const response = await request(app)
      .post("/connection")
      .send({
        host: "example.com",
        port: 22,
        username: "root",
        password: "super-secret",
        authMode: "password",
      })
      .expect(200);

    expect(addConnection).toHaveBeenCalledWith(
      expect.objectContaining({
        host: "example.com",
        password: "super-secret",
        authMode: "password",
      }),
    );
    expect(setActiveConnection).toHaveBeenCalledWith("conn-2");
    expect(response.body.password).toBeUndefined();
    expect(response.body.privateKey).toBeUndefined();
    expect(response.body.passphrase).toBeUndefined();

    const auditLine = logLines.find((l) => l.msg === "Connection audit: connection created and activated");
    expect(auditLine).toBeTruthy();
    expect(auditLine.connectionId).toBe("conn-2");
    expect(auditLine.host).toBe("example.com");
    // pino's redact config strips password/privateKey/passphrase wherever
    // they appear -- the audit log must never carry the secret even though
    // it only logs id/host/username/authMode by design.
    expect(auditLine.password).toBeUndefined();
  });

  it("POST /connections creates a profile and logs an audit line", async () => {
    vi.mocked(addConnection).mockReturnValue({
      id: "conn-3",
      name: "Prod",
      host: "prod.example.com",
      port: 22,
      username: "deploy",
      authMode: "key",
      privateKey: "-----BEGIN KEY-----",
    });
    vi.mocked(getConnectionsSafe).mockReturnValue([
      {
        id: "conn-3",
        name: "Prod",
        host: "prod.example.com",
        port: 22,
        username: "deploy",
        authMode: "key",
        hasPassword: false,
        hasPrivateKey: true,
        hasPassphrase: false,
      },
    ]);

    await request(app)
      .post("/connections")
      .send({
        name: "Prod",
        host: "prod.example.com",
        port: 22,
        username: "deploy",
        authMode: "key",
        privateKey: "-----BEGIN KEY-----",
      })
      .expect(201);

    const auditLine = logLines.find((l) => l.msg === "Connection audit: profile created");
    expect(auditLine).toBeTruthy();
    expect(auditLine.connectionId).toBe("conn-3");
    expect(auditLine.name).toBe("Prod");
    expect(auditLine.privateKey).toBeUndefined();
  });

  it("DELETE /connections/:id logs an audit line with the deleted profile's name/host", async () => {
    vi.mocked(getConnectionById).mockReturnValue({
      id: "conn-4",
      name: "Old Box",
      host: "old.example.com",
      port: 22,
      username: "admin",
      authMode: "password",
      password: "secret",
    });
    vi.mocked(removeConnection).mockReturnValue(true);

    await request(app).delete("/connections/conn-4").expect(200);

    const auditLine = logLines.find((l) => l.msg === "Connection audit: profile deleted");
    expect(auditLine).toBeTruthy();
    expect(auditLine.connectionId).toBe("conn-4");
    expect(auditLine.name).toBe("Old Box");
    expect(auditLine.host).toBe("old.example.com");
  });

  it("DELETE /connections/:id does not log an audit line when the profile doesn't exist", async () => {
    vi.mocked(getConnectionById).mockReturnValue(undefined);
    vi.mocked(removeConnection).mockReturnValue(false);

    await request(app).delete("/connections/missing").expect(404);

    expect(logLines.find((l) => l.msg === "Connection audit: profile deleted")).toBeUndefined();
  });

  it("POST /connections/:id/activate logs an audit line", async () => {
    vi.mocked(getConnectionById).mockReturnValue({
      id: "conn-5",
      name: "Staging",
      host: "staging.example.com",
      port: 22,
      username: "admin",
      authMode: "password",
      password: "secret",
    });

    await request(app).post("/connections/conn-5/activate").expect(200);

    expect(setActiveConnection).toHaveBeenCalledWith("conn-5");
    const auditLine = logLines.find((l) => l.msg === "Connection audit: profile activated");
    expect(auditLine).toBeTruthy();
    expect(auditLine.connectionId).toBe("conn-5");
    expect(auditLine.name).toBe("Staging");
  });

  it("GET /connections returns only safe profiles", async () => {
    vi.mocked(getConnectionsSafe).mockReturnValue([
      {
        id: "conn-1",
        name: "Desktop",
        host: "localhost",
        port: 22,
        username: "admin",
        authMode: "key",
        hasPassword: false,
        hasPrivateKey: true,
        hasPassphrase: true,
      },
    ]);

    const response = await request(app).get("/connections").expect(200);
    expect(response.body[0]).toMatchObject({
      authMode: "key",
      hasPrivateKey: true,
      hasPassphrase: true,
    });
    expect(response.body[0].privateKey).toBeUndefined();
    expect(response.body[0].passphrase).toBeUndefined();
  });
});
