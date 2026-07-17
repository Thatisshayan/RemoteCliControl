import app from "./app.js";
import { setupWebSocket } from "./lib/wsHandler.js";
import { listSessions, closeSession } from "./lib/sshManager.js";
import { startTunnel, stopTunnel } from "./lib/tunnel.js";
import logger from "./lib/logger.js";
import { notifyServerStarted } from "./lib/pushNotifications.js";
import packageJson from "../package.json" with { type: "json" };

const PORT = process.env.PORT;
const API_TOKEN = process.env.API_TOKEN;

if (!PORT) {
  throw new Error("PORT environment variable is required");
}

const tunnelEnabled = process.env.CLOUDFLARE_TUNNEL === "true" || process.env.CLOUDFLARE_TUNNEL === "1";
let shuttingDown = false;
let websocketRuntime: { close(): void } | null = null;

if (!API_TOKEN) {
  if (tunnelEnabled) {
    throw new Error(
      "API_TOKEN environment variable is required when CLOUDFLARE_TUNNEL is enabled — refusing to start an unauthenticated server exposed to the internet."
    );
  }
  logger.warn("API_TOKEN not set — running in unauthenticated mode (local only, no tunnel)");
}

const server = app.listen(Number(PORT), async () => {
  logger.info({
    port: Number(PORT),
    authMode: API_TOKEN ? "token" : "none",
    tunnelEnabled,
    version: packageJson.version,
  }, "Server started");
  websocketRuntime = setupWebSocket(server);
  notifyServerStarted().catch((err) => {
    logger.warn({ err }, "Failed to send startup push notification");
  });

  if (tunnelEnabled) {
    try {
      const url = await startTunnel(Number(PORT));
      if (url) {
        logger.info({ tunnelUrl: url }, "Cloudflare Tunnel active");
      }
    } catch (err) {
      logger.error({ err }, "Failed to start Cloudflare Tunnel");
    }
  }
});

function shutdown() {
  if (shuttingDown) return;
  shuttingDown = true;
  logger.info("Shutdown signal received");
  websocketRuntime?.close();
  websocketRuntime = null;
  stopTunnel();
  const active = listSessions();
  logger.info({ count: active.length }, "Closing active SSH sessions");
  for (const s of active) {
    closeSession(s.id);
  }
  server.close(() => {
    logger.info("Server closed");
    process.exit(0);
  });
}

process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
