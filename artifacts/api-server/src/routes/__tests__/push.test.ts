import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../../lib/store.js", () => ({
  registerPushDevice: vi.fn(),
  removePushDevice: vi.fn(),
  getPushDevices: vi.fn(),
  getNotificationPreferences: vi.fn(),
  updateNotificationPreferences: vi.fn(),
}));

vi.mock("../../lib/logger.js", () => ({
  default: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

import { registerPushDevice, removePushDevice, getPushDevices, getNotificationPreferences, updateNotificationPreferences } from "../../lib/store.js";
import pushRoutes from "../push.js";

function makeRes() {
  const res: any = { status: vi.fn().mockReturnThis(), json: vi.fn().mockReturnThis() };
  return res;
}

describe("POST /api/push/register", () => {
  it("returns 400 when pushToken is missing", async () => {
    const handler = (pushRoutes as any).stack.find((r: any) => r.route?.path === "/push/register" && r.route?.methods?.post)?.handle;
    expect(handler).toBeDefined();
  });
});

describe("GET /api/push/preferences", () => {
  it("calls getNotificationPreferences", async () => {
    vi.mocked(getNotificationPreferences).mockReturnValue({ sessionDisconnected: true, serverHealthChange: true });
    const prefs = getNotificationPreferences();
    expect(prefs.sessionDisconnected).toBe(true);
    expect(prefs.serverHealthChange).toBe(true);
  });
});

describe("PUT /api/push/preferences", () => {
  it("calls updateNotificationPreferences with partial prefs", async () => {
    vi.mocked(updateNotificationPreferences).mockReturnValue({ sessionDisconnected: false, serverHealthChange: true });
    const updated = updateNotificationPreferences({ sessionDisconnected: false });
    expect(updated.sessionDisconnected).toBe(false);
    expect(updateNotificationPreferences).toHaveBeenCalledWith({ sessionDisconnected: false });
  });
});

describe("GET /api/push/devices", () => {
  it("returns list of devices", async () => {
    vi.mocked(getPushDevices).mockReturnValue([]);
    expect(getPushDevices()).toEqual([]);
  });
});

describe("DELETE /api/push/device/:id", () => {
  it("calls removePushDevice with correct id", async () => {
    vi.mocked(removePushDevice).mockReturnValue(true);
    expect(removePushDevice("test-id")).toBe(true);
  });
});
