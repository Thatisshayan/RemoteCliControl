import express from "express";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../lib/sshManager.js", () => ({
  execCommand: vi.fn(),
}));

import router from "../processes.js";
import { execCommand } from "../../lib/sshManager.js";
import { HttpError, sendError } from "../../lib/http.js";

describe("processes routes", () => {
  const app = express();
  app.use(express.json());
  app.use(router);
  // Mirrors app.ts's error-handling middleware — without it, a thrown
  // HttpError (e.g. from parseParams) falls through to Express's default
  // handler instead of the {error, code, details} JSON shape every route
  // in this app actually returns.
  app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    if (err instanceof HttpError) {
      return sendError(res, err.status, err.code, err.message, err.details);
    }
    return sendError(res, err.status || 500, err.code || "INTERNAL_ERROR", err.message || "INTERNAL_ERROR");
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("GET /processes", () => {
    it("maps a JSON array of processes, translating Responding correctly", async () => {
      vi.mocked(execCommand).mockResolvedValue({
        stdout: JSON.stringify([
          { Name: "chrome", Id: 1234, CPU: 12.5, WorkingSet: 209715200, Responding: true },
          { Name: "stuck-app", Id: 5678, CPU: 0, WorkingSet: 1048576, Responding: false },
        ]),
        stderr: "",
        exitCode: 0,
      });

      const response = await request(app).get("/processes").expect(200);

      expect(response.body).toEqual([
        { pid: 1234, name: "chrome", cpu: 12.5, memory: 200, status: "running", user: "" },
        { pid: 5678, name: "stuck-app", cpu: 0, memory: 1, status: "not responding", user: "" },
      ]);
    });

    it("wraps a single (non-array) result — PowerShell's ConvertTo-Json omits the array for one item", async () => {
      vi.mocked(execCommand).mockResolvedValue({
        stdout: JSON.stringify({ Name: "only-one", Id: 42, CPU: 1, WorkingSet: 1048576, Responding: true }),
        stderr: "",
        exitCode: 0,
      });

      const response = await request(app).get("/processes").expect(200);

      expect(response.body).toEqual([{ pid: 42, name: "only-one", cpu: 1, memory: 1, status: "running", user: "" }]);
    });

    it("returns an empty list when stdout is empty", async () => {
      vi.mocked(execCommand).mockResolvedValue({ stdout: "", stderr: "", exitCode: 0 });

      const response = await request(app).get("/processes").expect(200);

      expect(response.body).toEqual([]);
    });

    it("still parses valid stdout even when stderr has unrelated warnings", async () => {
      vi.mocked(execCommand).mockResolvedValue({
        stdout: JSON.stringify([{ Name: "ok", Id: 1, CPU: 0, WorkingSet: 0, Responding: true }]),
        stderr: "Get-Process : Access is denied for one protected process",
        exitCode: 0,
      });

      const response = await request(app).get("/processes").expect(200);

      expect(response.body).toEqual([{ pid: 1, name: "ok", cpu: 0, memory: 0, status: "running", user: "" }]);
    });
  });

  describe("DELETE /processes/:pid", () => {
    it("rejects a non-numeric pid before ever calling execCommand", async () => {
      const response = await request(app).delete("/processes/not-a-pid").expect(400);

      expect(response.body.code).toBe("VALIDATION_ERROR");
      expect(execCommand).not.toHaveBeenCalled();
    });

    it("reports success when Stop-Process exits 0", async () => {
      vi.mocked(execCommand).mockResolvedValue({ stdout: "", stderr: "", exitCode: 0 });

      const response = await request(app).delete("/processes/1234").expect(200);

      expect(response.body).toEqual({ success: true });
    });

    it("reports failure instead of a false success when Stop-Process exits non-zero", async () => {
      vi.mocked(execCommand).mockResolvedValue({
        stdout: "",
        stderr: "Cannot find a process with the process identifier 9999.",
        exitCode: 1,
      });

      const response = await request(app).delete("/processes/9999").expect(404);

      expect(response.body.code).toBe("PROCESS_KILL_FAILED");
      expect(response.body.error).toBe("Cannot find a process with the process identifier 9999.");
    });
  });
});
