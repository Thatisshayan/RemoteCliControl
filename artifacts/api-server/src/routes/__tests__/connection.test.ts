import express from "express";
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
  setActiveConnection,
} from "../../lib/store.js";

describe("connection routes", () => {
  const app = express();
  app.use(express.json());
  app.use(router);

  beforeEach(() => {
    vi.clearAllMocks();
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
