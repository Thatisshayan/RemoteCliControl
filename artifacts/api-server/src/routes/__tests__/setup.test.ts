import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("fs");
vi.mock("../../lib/config.js", () => ({
  loadConfig: vi.fn(),
  createDefaultConfig: vi.fn(),
  saveConfig: vi.fn(),
  generateToken: vi.fn(),
}));

describe("setup route — loopback restriction", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  function findLoopbackMiddleware(router: any) {
    // The first layer registered via router.use() before any route handlers.
    return router.stack.find((layer: any) => !layer.route)?.handle;
  }

  it("rejects requests from non-loopback addresses with 403", async () => {
    const { default: router } = await import("../setup.js");
    const middleware = findLoopbackMiddleware(router);
    expect(middleware).toBeDefined();

    const req: any = { socket: { remoteAddress: "203.0.113.5" } };
    const res: any = { status: vi.fn().mockReturnThis(), json: vi.fn().mockReturnThis() };
    const next = vi.fn();

    middleware(req, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });

  it.each(["127.0.0.1", "::1", "::ffff:127.0.0.1"])(
    "allows requests from loopback address %s",
    async (ip) => {
      const { default: router } = await import("../setup.js");
      const middleware = findLoopbackMiddleware(router);

      const req: any = { socket: { remoteAddress: ip } };
      const res: any = { status: vi.fn().mockReturnThis(), json: vi.fn().mockReturnThis() };
      const next = vi.fn();

      middleware(req, res, next);

      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    }
  );
});
