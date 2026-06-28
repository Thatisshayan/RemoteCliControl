import { Expo, ExpoPushMessage } from "expo-server-sdk";
import { getPushDevices, getNotificationPreferences } from "./store.js";
import logger from "./logger.js";

const expo = new Expo();

export async function sendPushToAllDevices(title: string, body: string, data?: Record<string, string>): Promise<void> {
  const devices = getPushDevices();
  if (devices.length === 0) return;

  const messages: ExpoPushMessage[] = [];

  for (const device of devices) {
    if (!Expo.isExpoPushToken(device.pushToken)) {
      logger.warn({ token: device.pushToken }, "Invalid Expo push token");
      continue;
    }
    messages.push({
      to: device.pushToken,
      sound: "default",
      title,
      body,
      data: data || {},
      priority: "high",
    });
  }

  if (messages.length === 0) return;

  try {
    const chunks = expo.chunkPushNotifications(messages);
    for (const chunk of chunks) {
      const receipts = await expo.sendPushNotificationsAsync(chunk);
      logger.info({ receipts: receipts.length }, "Push notifications sent");
    }
  } catch (err) {
    logger.error({ err }, "Failed to send push notifications");
  }
}

export async function notifySessionDisconnected(sessionTitle: string, sessionId: string): Promise<void> {
  const prefs = getNotificationPreferences();
  if (!prefs.sessionDisconnected) return;
  await sendPushToAllDevices(
    "Session Disconnected",
    `"${sessionTitle}" ended unexpectedly`,
    { type: "session", sessionId }
  );
}

export async function notifyServerStarted(): Promise<void> {
  const prefs = getNotificationPreferences();
  if (!prefs.serverHealthChange) return;
  await sendPushToAllDevices(
    "Server Online",
    "RemoteCTRL server has started",
    { type: "server" }
  );
}
