import { Router } from "express";
import { registerPushDevice, removePushDevice, getPushDevices, getNotificationPreferences, updateNotificationPreferences } from "../lib/store.js";
import logger from "../lib/logger.js";
import { PushPreferenceUpdateSchema } from "../lib/contracts.js";
import { parseBody, sendError } from "../lib/http.js";

const router = Router();

router.post("/push/register", (req, res) => {
  const { pushToken, platform, deviceName } = req.body;
  if (!pushToken || !platform) {
    return sendError(res, 400, "VALIDATION_ERROR", "pushToken and platform are required");
  }
  if (platform !== "ios" && platform !== "android") {
    return sendError(res, 400, "VALIDATION_ERROR", "platform must be 'ios' or 'android'");
  }
  try {
    const device = registerPushDevice(pushToken, platform, deviceName);
    logger.info({ deviceId: device.id }, "Push device registered");
    res.json({ success: true, deviceId: device.id });
  } catch (err: any) {
    logger.error({ err }, "Failed to register push device");
    sendError(res, 500, "PUSH_REGISTER_FAILED", "Failed to register push device");
  }
});

router.delete("/push/device/:id", (req, res) => {
  const ok = removePushDevice(req.params.id);
  if (!ok) return sendError(res, 404, "DEVICE_NOT_FOUND", "Device not found");
  res.json({ success: true });
});

router.get("/push/devices", (_req, res) => {
  res.json(getPushDevices());
});

router.get("/push/preferences", (_req, res) => {
  res.json(getNotificationPreferences());
});

router.put("/push/preferences", (req, res, next) => {
  try {
    const body = parseBody(PushPreferenceUpdateSchema, req);
    const prefs = updateNotificationPreferences(body);
    res.json(prefs);
  } catch (err) {
    next(err);
  }
});

export default router;
