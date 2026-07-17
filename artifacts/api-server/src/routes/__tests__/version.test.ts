import express from "express";
import request from "supertest";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import router from "../version.js";
import packageJson from "../../../package.json" with { type: "json" };

describe("version route", () => {
  const app = express();
  app.use(router);
  const originalEnv = process.env.MOBILE_MIN_VERSION;

  afterEach(() => {
    if (originalEnv === undefined) delete process.env.MOBILE_MIN_VERSION;
    else process.env.MOBILE_MIN_VERSION = originalEnv;
  });

  it("returns the server version without mobileMinVersion when unset", async () => {
    delete process.env.MOBILE_MIN_VERSION;

    const response = await request(app).get("/").expect(200);

    expect(response.body).toEqual({ version: packageJson.version });
    expect(response.body.mobileMinVersion).toBeUndefined();
  });

  it("includes mobileMinVersion when the operator sets it", async () => {
    process.env.MOBILE_MIN_VERSION = "1.0.2";

    const response = await request(app).get("/").expect(200);

    expect(response.body).toEqual({
      version: packageJson.version,
      mobileMinVersion: "1.0.2",
    });
  });
});
