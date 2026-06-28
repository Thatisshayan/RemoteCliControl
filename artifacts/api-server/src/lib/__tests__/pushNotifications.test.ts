import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("expo-server-sdk", () => ({
  Expo: class {
    static isExpoPushToken(token: string) { return token.startsWith("ExpoPushToken["); }
    chunkPushNotifications(messages: any[]) { return [messages]; }
    async sendPushNotificationsAsync(messages: any[]) { return messages.map(() => ({ status: "ok", id: "1" })); }
  },
}));

vi.mock("../store.js", () => ({
  getPushDevices: vi.fn(),
  getNotificationPreferences: vi.fn(),
}));

vi.mock("./logger.js", () => ({
  default: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

import { sendPushToAllDevices, notifySessionDisconnected, notifyServerStarted } from "../pushNotifications.js";
import { getPushDevices, getNotificationPreferences } from "../store.js";

describe("pushNotifications.ts", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("sendPushToAllDevices sends to valid tokens", async () => {
    vi.mocked(getPushDevices).mockReturnValue([
      { id: "1", pushToken: "ExpoPushToken[abc]", platform: "ios", createdAt: "", updatedAt: "" },
    ]);

    await sendPushToAllDevices("Test", "Body", { type: "test" });
    expect(getPushDevices).toHaveBeenCalled();
  });

  it("sendPushToAllDevices does nothing when no devices", async () => {
    vi.mocked(getPushDevices).mockReturnValue([]);
    await sendPushToAllDevices("Test", "Body");
    expect(getPushDevices).toHaveBeenCalled();
  });

  it("notifySessionDisconnected sends when preference enabled", async () => {
    vi.mocked(getPushDevices).mockReturnValue([]);
    vi.mocked(getNotificationPreferences).mockReturnValue({ sessionDisconnected: true, serverHealthChange: true });

    await notifySessionDisconnected("Session 1", "abc123");
    expect(getNotificationPreferences).toHaveBeenCalled();
  });

  it("notifySessionDisconnected skips when preference disabled", async () => {
    vi.mocked(getNotificationPreferences).mockReturnValue({ sessionDisconnected: false, serverHealthChange: true });

    await notifySessionDisconnected("Session 1", "abc123");
    expect(getNotificationPreferences).toHaveBeenCalled();
    expect(getPushDevices).not.toHaveBeenCalled();
  });

  it("notifyServerStarted sends when preference enabled", async () => {
    vi.mocked(getPushDevices).mockReturnValue([]);
    vi.mocked(getNotificationPreferences).mockReturnValue({ sessionDisconnected: true, serverHealthChange: true });

    await notifyServerStarted();
    expect(getNotificationPreferences).toHaveBeenCalled();
  });

  it("notifyServerStarted skips when preference disabled", async () => {
    vi.mocked(getNotificationPreferences).mockReturnValue({ sessionDisconnected: true, serverHealthChange: false });

    await notifyServerStarted();
    expect(getNotificationPreferences).toHaveBeenCalled();
    expect(getPushDevices).not.toHaveBeenCalled();
  });
});
