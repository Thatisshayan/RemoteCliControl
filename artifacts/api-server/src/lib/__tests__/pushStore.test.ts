import { describe, it, expect, beforeEach, vi } from "vitest";

vi.mock("fs");
vi.mock("path");

describe("store.ts — push devices & notification preferences", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it("getPushDevices returns empty array initially", async () => {
    const { getPushDevices } = await import("../store.js");
    expect(getPushDevices()).toEqual([]);
  });

  it("registerPushDevice adds a new device", async () => {
    const { registerPushDevice, getPushDevices } = await import("../store.js");
    const device = registerPushDevice("ExpoPushToken[abc]", "ios", "iPhone 15");

    expect(device.pushToken).toBe("ExpoPushToken[abc]");
    expect(device.platform).toBe("ios");
    expect(device.deviceName).toBe("iPhone 15");
    expect(device.id).toBeDefined();
    expect(getPushDevices().length).toBe(1);
  });

  it("registerPushDevice updates existing device with same token", async () => {
    const { registerPushDevice, getPushDevices } = await import("../store.js");
    const d1 = registerPushDevice("ExpoPushToken[abc]", "ios", "iPhone 15");
    const d2 = registerPushDevice("ExpoPushToken[abc]", "ios", "iPhone 16 Pro");

    expect(d1.id).toBe(d2.id);
    expect(getPushDevices().length).toBe(1);
    expect(getPushDevices()[0].deviceName).toBe("iPhone 16 Pro");
  });

  it("removePushDevice removes by id", async () => {
    const { registerPushDevice, removePushDevice, getPushDevices } = await import("../store.js");
    const d = registerPushDevice("ExpoPushToken[abc]", "ios");

    expect(removePushDevice(d.id)).toBe(true);
    expect(getPushDevices().length).toBe(0);
  });

  it("removePushDevice returns false for unknown id", async () => {
    const { removePushDevice } = await import("../store.js");
    expect(removePushDevice("nonexistent")).toBe(false);
  });

  it("getNotificationPreferences returns defaults", async () => {
    const { getNotificationPreferences } = await import("../store.js");
    const prefs = getNotificationPreferences();
    expect(prefs.sessionDisconnected).toBe(true);
    expect(prefs.serverHealthChange).toBe(true);
  });

  it("updateNotificationPreferences merges partial updates", async () => {
    const { updateNotificationPreferences, getNotificationPreferences } = await import("../store.js");
    const updated = updateNotificationPreferences({ sessionDisconnected: false });

    expect(updated.sessionDisconnected).toBe(false);
    expect(updated.serverHealthChange).toBe(true);
    expect(getNotificationPreferences().sessionDisconnected).toBe(false);
  });

  it("supports multiple push devices", async () => {
    const { registerPushDevice, getPushDevices } = await import("../store.js");
    registerPushDevice("ExpoPushToken[aaa]", "ios");
    registerPushDevice("ExpoPushToken[bbb]", "android");

    expect(getPushDevices().length).toBe(2);
  });
});
