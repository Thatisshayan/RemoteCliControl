import type { AddressInfo } from "net";
import type { Server } from "http";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("../lib/store.js", () => ({
  getActiveConnection: vi.fn(() => null),
}));

vi.mock("../lib/sshManager.js", () => ({
  listSessions: vi.fn(() => []),
}));

let server: Server;
let baseUrl: string;

beforeAll(async () => {
  delete process.env.API_TOKEN;
  const { default: app } = await import("../app.js");
  server = app.listen(0);
  await new Promise<void>((resolve) => server.once("listening", resolve));
  const port = (server.address() as AddressInfo).port;
  baseUrl = `http://127.0.0.1:${port}`;
}, 30000); // cold import of app.js (express, ssh2, pino-http, etc.) can exceed the 10s default hook timeout

afterAll(async () => {
  if (!server) return;
  await new Promise<void>((resolve) => server.close(() => resolve()));
});

describe("request id", () => {
  it("attaches a generated x-request-id header when the client sends none", async () => {
    const response = await request(baseUrl).get("/health");
    expect(response.headers["x-request-id"]).toBeTruthy();
  });

  it("echoes back an incoming x-request-id instead of generating a new one", async () => {
    const response = await request(baseUrl).get("/health").set("x-request-id", "client-supplied-id");
    expect(response.headers["x-request-id"]).toBe("client-supplied-id");
  });

  it("gives independent requests distinct generated ids", async () => {
    const [a, b] = await Promise.all([request(baseUrl).get("/health"), request(baseUrl).get("/health")]);
    expect(a.headers["x-request-id"]).not.toBe(b.headers["x-request-id"]);
  });
});
