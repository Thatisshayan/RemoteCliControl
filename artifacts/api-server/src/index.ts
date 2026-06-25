import app from "./app.js";
import { setupWebSocket } from "./lib/wsHandler.js";
import logger from "./lib/logger.js";

const PORT = process.env.PORT;
if (!PORT) {
  throw new Error("PORT environment variable is required");
}

const server = app.listen(Number(PORT), () => {
  logger.info(`Server running on port ${PORT}`);
  setupWebSocket(server);
});
