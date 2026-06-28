import { createRequire } from "module";
const require = createRequire(import.meta.url);
const { WebSocketServer } = require("ws") as typeof import("ws");

import type { Server } from "http";
import { addOutputListener, getSession } from "./sshManager.js";
import logger from "./logger.js";

const MAX_BUFFER = 64 * 1024;

export function setupWebSocket(server: Server) {
  const wss = new WebSocketServer({ noServer: true });
  const buffers = new Map<any, string>();

  server.on("upgrade", (request, socket, head) => {
    const url = new URL(request.url || "", "http://localhost");
    const sessionId = url.pathname.match(/^\/api\/ws\/terminal\/(.+)$/)?.[1];

    if (!sessionId) {
      socket.destroy();
      return;
    }

    const token = url.searchParams.get("token");
    const API_TOKEN = process.env.API_TOKEN;
    if (API_TOKEN && token !== API_TOKEN) {
      socket.destroy();
      return;
    }

    wss.handleUpgrade(request, socket, head, (ws) => {
      wss.emit("connection", ws, { sessionId });
    });
  });

  const connections = new Map<any, { sessionId: string; alive: boolean }>();

  wss.on("connection", (ws: any, req: { sessionId: string }) => {
    const { sessionId } = req;

    if (!getSession(sessionId)) {
      ws.close(4004, "Session not found");
      return;
    }

    logger.info({ sessionId }, "WebSocket connected");
    connections.set(ws, { sessionId, alive: true });

    const removeListener = addOutputListener(sessionId, (data: string) => {
      if (ws.readyState === 1) {
        ws.send(data);
      } else {
        const buf = (buffers.get(ws) || "") + data;
        if (buf.length > MAX_BUFFER) {
          buffers.set(ws, buf.slice(buf.length - MAX_BUFFER));
        } else {
          buffers.set(ws, buf);
        }
      }
    });

    ws.on("message", () => {
      const entry = connections.get(ws);
      if (entry) entry.alive = true;
    });

    ws.on("close", () => {
      logger.info({ sessionId }, "WebSocket closed");
      connections.delete(ws);
      buffers.delete(ws);
      removeListener();
    });

    ws.on("error", () => {
      connections.delete(ws);
      buffers.delete(ws);
      removeListener();
    });
  });

  setInterval(() => {
    for (const [ws, entry] of connections.entries()) {
      if (ws.readyState !== 1) {
        connections.delete(ws);
        continue;
      }
      if (!entry.alive) {
        logger.info({ sessionId: entry.sessionId }, "WebSocket ping timeout, closing");
        ws.close();
        connections.delete(ws);
        continue;
      }
      entry.alive = false;
      try { ws.ping(); } catch {}
    }
  }, 30000);

  logger.info("WebSocket server mounted at /api/ws/terminal");
}
