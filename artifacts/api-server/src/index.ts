import app from "./app.js";
import { setupWebSocket } from "./lib/wsHandler.js";
import logger from "./lib/logger.js";

const PORT = process.env.PORT;
const API_TOKEN = process.env.API_TOKEN;

if (!PORT) {
  throw new Error("PORT environment variable is required");
}

if (!API_TOKEN) {
  logger.warn("API_TOKEN not set — running in unauthenticated mode");
}

const server = app.listen(Number(PORT), () => {
  logger.info(`Server running on port ${PORT}`);
  setupWebSocket(server);
});
