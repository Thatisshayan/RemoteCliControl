import app from "./app.js";
import { setupWebSocket } from "./lib/wsHandler.js";
import { listSessions, closeSession } from "./lib/sshManager.js";
import { startTunnel, stopTunnel } from "./lib/tunnel.js";
import logger from "./lib/logger.js";

const PORT = process.env.PORT;
const API_TOKEN = process.env.API_TOKEN;

if (!PORT) {
  throw new Error("PORT environment variable is required");
}

if (!API_TOKEN) {
  logger.warn("API_TOKEN not set — running in unauthenticated mode");
}

const server = app.listen(Number(PORT), async () => {
  logger.info(`Server running on port ${PORT}`);
  setupWebSocket(server);

  if (process.env.CLOUDFLARE_TUNNEL === "true" || process.env.CLOUDFLARE_TUNNEL === "1") {
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
  logger.info("Shutdown signal received");
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
