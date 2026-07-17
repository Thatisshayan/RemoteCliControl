import { describe, it, expect, vi, beforeEach } from "vitest";

describe("auth.ts middleware", () => {
  let mockReq: any;
  let mockRes: any;
  let mockNext: any;

  beforeEach(() => {
    mockReq = { headers: {} };
    mockRes = { status: vi.fn().mockReturnThis(), json: vi.fn().mockReturnThis() };
    mockNext = vi.fn();
    vi.resetModules();
  });

  it("skips auth when API_TOKEN is not set", async () => {
    const originalEnv = process.env.API_TOKEN;
    delete process.env.API_TOKEN;
    vi.resetModules();
    
    const { authMiddleware } = await import("../auth.js");
    const mockReq = { headers: {} };
    const mockRes = { status: vi.fn().mockReturnThis(), json: vi.fn().mockReturnThis() };
    const mockNext = vi.fn();
    
    authMiddleware(mockReq as any, mockRes as any, mockNext);
    
    expect(mockNext).toHaveBeenCalled();
    expect(mockRes.status).not.toHaveBeenCalled();
    
    process.env.API_TOKEN = "test-token";
  });

  it("blocks requests without Authorization header", async () => {
    const { authMiddleware } = await import("../auth.js");
    const mockReq = { headers: {} };
    const mockRes = { status: vi.fn().mockReturnThis(), json: vi.fn().mockReturnThis() };
    const mockNext = vi.fn();
    
    authMiddleware(mockReq as any, mockRes as any, mockNext);
    
    expect(mockRes.status).toHaveBeenCalledWith(401);
    expect(mockRes.json).toHaveBeenCalledWith({ error: "Missing Authorization header", code: "AUTH_REQUIRED" });
    expect(mockNext).not.toHaveBeenCalled();
  });

  it("blocks requests with invalid token", async () => {
    const { authMiddleware } = await import("../auth.js");
    const mockReq = { headers: { authorization: "Bearer wrong-token" } };
    const mockRes = { status: vi.fn().mockReturnThis(), json: vi.fn().mockReturnThis() };
    const mockNext = vi.fn();
    
    authMiddleware(mockReq as any, mockRes as any, mockNext);
    
    expect(mockRes.status).toHaveBeenCalledWith(401);
    expect(mockRes.json).toHaveBeenCalledWith({ error: "Invalid API token", code: "AUTH_INVALID" });
    expect(mockNext).not.toHaveBeenCalled();
  });

  it("allows requests with correct token", async () => {
    const { authMiddleware } = await import("../auth.js");
    const mockReq = { headers: { authorization: "Bearer test-token" } };
    const mockRes = { status: vi.fn().mockReturnThis(), json: vi.fn().mockReturnThis() };
    const mockNext = vi.fn();

    authMiddleware(mockReq as any, mockRes as any, mockNext);

    expect(mockNext).toHaveBeenCalled();
    expect(mockRes.status).not.toHaveBeenCalled();
  });
});

describe("timingSafeTokenEqual", () => {
  it("returns true for identical strings", async () => {
    const { timingSafeTokenEqual } = await import("../auth.js");
    expect(timingSafeTokenEqual("abc123", "abc123")).toBe(true);
  });

  it("returns false for different strings of the same length", async () => {
    const { timingSafeTokenEqual } = await import("../auth.js");
    expect(timingSafeTokenEqual("abc123", "abc124")).toBe(false);
  });

  it("returns false for strings of different lengths without throwing", async () => {
    const { timingSafeTokenEqual } = await import("../auth.js");
    expect(timingSafeTokenEqual("short", "much-longer-token")).toBe(false);
  });
});
