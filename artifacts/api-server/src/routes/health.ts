import { Router } from "express";
import { listSessions } from "../lib/sshManager.js";
import { getActiveConnection } from "../lib/store.js";

const router = Router();
const startTime = Date.now();

router.get("/", (_req, res) => {
  const sessions = listSessions();
  res.json({
    status: "ok",
    activeSessions: sessions.length,
    connectionConfigured: !!getActiveConnection(),
    uptimeSeconds: Math.floor((Date.now() - startTime) / 1000),
  });
});

export default router;
