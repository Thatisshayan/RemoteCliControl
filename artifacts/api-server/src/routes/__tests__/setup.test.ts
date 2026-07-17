import { beforeEach, describe, expect, it, vi } from "vitest";
import { loopbackOnly } from "../setup.js";

describe("setup route — loopback restriction", () => {
  let res: any;
  let next: any;

  beforeEach(() => {
    res = { status: vi.fn().mockReturnThis(), json: vi.fn().mockReturnThis() };
    next = vi.fn();
  });

  it("rejects requests from non-loopback addresses with 403", () => {
    const req: any = { socket: { remoteAddress: "203.0.113.5" } };

    loopbackOnly(req, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({ error: "Setup is only available from the local machine" });
    expect(next).not.toHaveBeenCalled();
  });

  it.each(["127.0.0.1", "::1", "::ffff:127.0.0.1"])(
    "allows loopback address %s",
    (ip) => {
      const req: any = { socket: { remoteAddress: ip } };

      loopbackOnly(req, res, next);

      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    },
  );
});
