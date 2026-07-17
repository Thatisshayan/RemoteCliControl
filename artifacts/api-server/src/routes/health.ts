import { Router } from "express";
import { listSessions } from "../lib/sshManager.js";
import { getActiveConnection } from "../lib/store.js";
import packageJson from "../../package.json" with { type: "json" };

const router = Router();
const startTime = Date.now();

router.get("/", (_req, res) => {
  const sessions = listSessions();
  res.json({
    status: "ok",
    activeSessions: sessions.length,
    connectionConfigured: !!getActiveConnection(),
    uptimeSeconds: Math.floor((Date.now() - startTime) / 1000),
    version: packageJson.version,
    authMode: process.env.API_TOKEN ? "token" : "none",
    tunnelEnabled:
      process.env.CLOUDFLARE_TUNNEL === "true" || process.env.CLOUDFLARE_TUNNEL === "1",
  });
});

export default router;
