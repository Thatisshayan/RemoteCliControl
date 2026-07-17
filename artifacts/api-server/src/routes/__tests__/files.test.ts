import express from "express";
import pinoHttp from "pino-http";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../lib/sshManager.js", () => ({
  getSftp: vi.fn(),
}));

import router from "../files.js";
import { getSftp } from "../../lib/sshManager.js";
import { HttpError, sendError } from "../../lib/http.js";
import logger from "../../lib/logger.js";

describe("files routes", () => {
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

  describe("PATCH /files/rename", () => {
    it("rejects a relative 'from' path before ever calling getSftp", async () => {
      const response = await request(app)
        .patch("/files/rename")
        .send({ from: "relative/path", to: "/absolute/path" })
        .expect(400);

      expect(response.body.code).toBe("VALIDATION_ERROR");
      expect(getSftp).not.toHaveBeenCalled();
    });

    it("rejects a relative 'to' path before ever calling getSftp", async () => {
      const response = await request(app)
        .patch("/files/rename")
        .send({ from: "/absolute/path", to: "relative/path" })
        .expect(400);

      expect(response.body.code).toBe("VALIDATION_ERROR");
      expect(getSftp).not.toHaveBeenCalled();
    });

    it("rejects a 'from' path containing '..' traversal", async () => {
      const response = await request(app)
        .patch("/files/rename")
        .send({ from: "/home/../etc/passwd", to: "/tmp/out" })
        .expect(400);

      expect(response.body.code).toBe("VALIDATION_ERROR");
      expect(getSftp).not.toHaveBeenCalled();
    });

    it("rejects a 'to' path containing '..' traversal", async () => {
      const response = await request(app)
        .patch("/files/rename")
        .send({ from: "/tmp/in", to: "/tmp/../etc/passwd" })
        .expect(400);

      expect(response.body.code).toBe("VALIDATION_ERROR");
      expect(getSftp).not.toHaveBeenCalled();
    });

    it("rejects a missing 'to' field", async () => {
      const response = await request(app)
        .patch("/files/rename")
        .send({ from: "/tmp/in" })
        .expect(400);

      expect(response.body.code).toBe("VALIDATION_ERROR");
      expect(getSftp).not.toHaveBeenCalled();
    });

    it("renames successfully when both paths are valid absolute paths", async () => {
      const rename = vi.fn((_from: string, _to: string, cb: (err: any) => void) => cb(null));
      vi.mocked(getSftp).mockResolvedValue({ rename } as any);

      const response = await request(app)
        .patch("/files/rename")
        .send({ from: "/tmp/in", to: "/tmp/out" })
        .expect(200);

      expect(response.body).toEqual({ success: true });
      expect(rename).toHaveBeenCalledWith("/tmp/in", "/tmp/out", expect.any(Function));
    });

    it("propagates an sftp rename failure as a 500", async () => {
      const rename = vi.fn((_from: string, _to: string, cb: (err: any) => void) =>
        cb(new Error("Permission denied")),
      );
      vi.mocked(getSftp).mockResolvedValue({ rename } as any);

      const response = await request(app)
        .patch("/files/rename")
        .send({ from: "/tmp/in", to: "/tmp/out" })
        .expect(500);

      expect(response.body.error).toBe("Permission denied");
    });
  });
});
