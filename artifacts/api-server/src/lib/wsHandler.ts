import { createRequire } from "module";
const require = createRequire(import.meta.url);
const { WebSocketServer } = require("ws") as typeof import("ws");

import type { Server } from "http";
import { addOutputListener, sendToSession, getSession } from "./sshManager.js";
import logger from "./logger.js";

export function setupWebSocket(server: Server) {
  const wss = new WebSocketServer({ noServer: true });

  server.on("upgrade", (request, socket, head) => {
    const url = request.url || "";
    // Parse: /api/ws/terminal/:sessionId
    const match = url.match(/^\/api\/ws\/terminal\/(.+)$/);
    if (!match) {
      socket.destroy();
      return;
    }
    const sessionId = match[1];

    wss.handleUpgrade(request, socket, head, (ws) => {
      wss.emit("connection", ws, { sessionId });
    });
  });

  wss.on("connection", (ws: any, req: { sessionId: string }) => {
    const { sessionId } = req;
    const session = getSession(sessionId);

    if (!session) {
      ws.close(4004, "Session not found");
      return;
    }

    logger.info({ sessionId }, "WebSocket connected");

    const removeListener = addOutputListener(sessionId, (data: string) => {
      if (ws.readyState === 1) {
        ws.send(data);
      }
    });

    ws.on("message", (msg: any) => {
      const data = typeof msg === "string" ? msg : msg.toString();
      sendToSession(sessionId, data);
    });

    ws.on("close", () => {
      logger.info({ sessionId }, "WebSocket closed");
      removeListener();
    });

    ws.on("error", () => {
      removeListener();
    });
  });

  logger.info("WebSocket server mounted at /api/ws/terminal");
}
