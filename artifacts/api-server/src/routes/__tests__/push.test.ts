import express from "express";
import pinoHttp from "pino-http";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../lib/store.js", () => ({
  registerPushDevice: vi.fn(),
  removePushDevice: vi.fn(),
  getPushDevices: vi.fn(),
  getNotificationPreferences: vi.fn(),
  updateNotificationPreferences: vi.fn(),
}));

import router from "../push.js";
import {
  registerPushDevice,
  removePushDevice,
  getPushDevices,
  getNotificationPreferences,
  updateNotificationPreferences,
} from "../../lib/store.js";
import { HttpError, sendError } from "../../lib/http.js";
import logger from "../../lib/logger.js";

describe("push routes", () => {
  const app = express();
  app.use(express.json());
  app.use(pinoHttp({ logger }));
  app.use(router);
  app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    if (err instanceof HttpError) {
      return sendError(res, err.status, err.code, err.message, err.details);
    }
    return sendError(res, err.status || 500, err.code || "INTERNAL_ERROR", err.message || "INTERNAL_ERROR");
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("PUT /push/preferences", () => {
    it("rejects an empty body — at least one preference must be provided", async () => {
      const response = await request(app).put("/push/preferences").send({}).expect(400);

      expect(response.body.code).toBe("VALIDATION_ERROR");
      expect(updateNotificationPreferences).not.toHaveBeenCalled();
    });

    it("rejects a non-boolean preference value", async () => {
      const response = await request(app)
        .put("/push/preferences")
        .send({ sessionDisconnected: "yes" })
        .expect(400);

      expect(response.body.code).toBe("VALIDATION_ERROR");
      expect(updateNotificationPreferences).not.toHaveBeenCalled();
    });

    it("silently strips an unknown preference key rather than rejecting the request", async () => {
      vi.mocked(updateNotificationPreferences).mockReturnValue({
        sessionDisconnected: true,
        serverHealthChange: false,
      });

      await request(app)
        .put("/push/preferences")
        .send({ sessionDisconnected: true, notARealPreference: true })
        .expect(200);

      // zod's default object parsing strips unrecognized keys rather than
      // erroring, so only the known field reaches the store layer.
      expect(updateNotificationPreferences).toHaveBeenCalledWith({ sessionDisconnected: true });
    });

    it("accepts a single valid preference update", async () => {
      vi.mocked(updateNotificationPreferences).mockReturnValue({
        sessionDisconnected: true,
        serverHealthChange: false,
      });

      const response = await request(app)
        .put("/push/preferences")
        .send({ sessionDisconnected: true })
        .expect(200);

      expect(response.body).toEqual({ sessionDisconnected: true, serverHealthChange: false });
      expect(updateNotificationPreferences).toHaveBeenCalledWith({ sessionDisconnected: true });
    });
  });

  describe("GET /push/preferences", () => {
    it("returns the current preferences", async () => {
      vi.mocked(getNotificationPreferences).mockReturnValue({
        sessionDisconnected: true,
        serverHealthChange: true,
      });

      const response = await request(app).get("/push/preferences").expect(200);

      expect(response.body).toEqual({ sessionDisconnected: true, serverHealthChange: true });
    });
  });

  describe("POST /push/register", () => {
    it("rejects a missing pushToken", async () => {
      const response = await request(app).post("/push/register").send({ platform: "ios" }).expect(400);

      expect(response.body.code).toBe("VALIDATION_ERROR");
      expect(registerPushDevice).not.toHaveBeenCalled();
    });

    it("rejects an invalid platform", async () => {
      const response = await request(app)
        .post("/push/register")
        .send({ pushToken: "tok", platform: "windows" })
        .expect(400);

      expect(response.body.code).toBe("VALIDATION_ERROR");
      expect(registerPushDevice).not.toHaveBeenCalled();
    });

    it("registers a device with a valid payload", async () => {
      vi.mocked(registerPushDevice).mockReturnValue({
        id: "device-1",
        pushToken: "tok",
        platform: "ios",
      } as any);

      const response = await request(app)
        .post("/push/register")
        .send({ pushToken: "tok", platform: "ios" })
        .expect(200);

      expect(response.body).toEqual({ success: true, deviceId: "device-1" });
    });
  });

  describe("GET /push/devices", () => {
    it("returns the device list", async () => {
      vi.mocked(getPushDevices).mockReturnValue([]);

      const response = await request(app).get("/push/devices").expect(200);

      expect(response.body).toEqual([]);
    });
  });

  describe("DELETE /push/device/:id", () => {
    it("returns 404 when the device does not exist", async () => {
      vi.mocked(removePushDevice).mockReturnValue(false);

      const response = await request(app).delete("/push/device/missing-id").expect(404);

      expect(response.body.code).toBe("DEVICE_NOT_FOUND");
    });

    it("removes an existing device", async () => {
      vi.mocked(removePushDevice).mockReturnValue(true);

      const response = await request(app).delete("/push/device/real-id").expect(200);

      expect(response.body).toEqual({ success: true });
    });
  });
});
