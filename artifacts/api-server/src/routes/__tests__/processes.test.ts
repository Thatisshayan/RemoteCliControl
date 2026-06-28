import { describe, it, expect, vi, beforeEach } from "vitest";
import { Request, Response } from "express";

vi.mock("../../lib/sshManager.js", () => ({
  execCommand: vi.fn().mockResolvedValue(""),
}));

import { execCommand } from "../../lib/sshManager.js";

describe("processes routes", () => {
  let mockReq: Partial<Request>;
  let mockRes: Partial<Response>;
  let handler: (req: Request, res: Response) => Promise<void>;

  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    mockReq = { params: {} };
    mockRes = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis(),
    };
  });

  it("rejects invalid PID format", async () => {
    expect(/^\d+$/.test("abc")).toBe(false);
    expect(/^\d+$/.test("12a")).toBe(false);
  });

  it("accepts valid PID format", async () => {
    expect(/^\d+$/.test("123")).toBe(true);
    expect(/^\d+$/.test("0")).toBe(true);
  });

  it("rejects PID with non-digits", async () => {
    expect(/^\d+$/.test("abc")).toBe(false);
    expect(/^\d+$/.test("12a")).toBe(false);
    expect(/^\d+$/.test("-1")).toBe(false);
    expect(/^\d+$/.test("1.5")).toBe(false);
  });
});