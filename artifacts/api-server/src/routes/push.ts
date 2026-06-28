import { Router } from "express";
import { registerPushDevice, removePushDevice, getPushDevices, getNotificationPreferences, updateNotificationPreferences } from "../lib/store.js";
import logger from "../lib/logger.js";

const router = Router();

router.post("/push/register", (req, res) => {
  const { pushToken, platform, deviceName } = req.body;
  if (!pushToken || !platform) {
    return res.status(400).json({ error: "pushToken and platform are required" });
  }
  if (platform !== "ios" && platform !== "android") {
    return res.status(400).json({ error: "platform must be 'ios' or 'android'" });
  }
  try {
    const device = registerPushDevice(pushToken, platform, deviceName);
    logger.info({ deviceId: device.id }, "Push device registered");
    res.json({ success: true, deviceId: device.id });
  } catch (err: any) {
    logger.error({ err }, "Failed to register push device");
    res.status(500).json({ error: "Failed to register push device" });
  }
});

router.delete("/push/device/:id", (req, res) => {
  const ok = removePushDevice(req.params.id);
  if (!ok) return res.status(404).json({ error: "Device not found" });
  res.json({ success: true });
});

router.get("/push/devices", (_req, res) => {
  res.json(getPushDevices());
});

router.get("/push/preferences", (_req, res) => {
  res.json(getNotificationPreferences());
});

router.put("/push/preferences", (req, res) => {
  const { sessionDisconnected, serverHealthChange } = req.body;
  const prefs = updateNotificationPreferences({
    ...(typeof sessionDisconnected === "boolean" ? { sessionDisconnected } : {}),
    ...(typeof serverHealthChange === "boolean" ? { serverHealthChange } : {}),
  });
  res.json(prefs);
});

export default router;
