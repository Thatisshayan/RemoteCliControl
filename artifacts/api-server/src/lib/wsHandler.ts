import { createRequire } from "module";
const require = createRequire(import.meta.url);
const { WebSocketServer } = require("ws") as typeof import("ws");

import type { Server } from "http";
import { addOutputListener, getSession, sendToSession, resizeSession } from "./sshManager.js";
import logger from "./logger.js";
import { timingSafeTokenEqual } from "./auth.js";

const MAX_BUFFER = 64 * 1024;

export function setupWebSocket(server: Server) {
  const wss = new WebSocketServer({
    noServer: true,
    // Echo back the client's offered subprotocol (the token) so the
    // handshake completes — the client uses it purely as a token carrier.
    handleProtocols: (protocols: Set<string>) => protocols.values().next().value ?? false,
  });
  const buffers = new Map<any, string>();

  const upgradeHandler = (request: any, socket: any, head: any) => {
    const url = new URL(request.url || "", "http://localhost");
    const sessionId = url.pathname.match(/^\/api\/ws\/terminal\/(.+)$/)?.[1];

    if (!sessionId) {
      socket.destroy();
      return;
    }

    // Token travels as a WebSocket subprotocol rather than a URL query param
    // so it doesn't get written into access/proxy/edge logs.
    const protocolHeader = request.headers["sec-websocket-protocol"];
    const token = Array.isArray(protocolHeader)
      ? protocolHeader[0]
      : protocolHeader?.split(",")[0]?.trim();
    const API_TOKEN = process.env.API_TOKEN;
    if (API_TOKEN && (!token || !timingSafeTokenEqual(token, API_TOKEN))) {
      socket.destroy();
      return;
    }

    wss.handleUpgrade(request, socket, head, (ws) => {
      wss.emit("connection", ws, { sessionId });
    });
  };

  server.on("upgrade", upgradeHandler);

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

    ws.on("pong", () => {
      const entry = connections.get(ws);
      if (entry) entry.alive = true;
    });

    ws.on("message", (data: any) => {
      const text = data.toString();
      try {
        const parsed = JSON.parse(text);
        if (parsed.type === "resize" && typeof parsed.rows === "number" && typeof parsed.cols === "number") {
          resizeSession(sessionId, parsed.rows, parsed.cols);
          return;
        }
      } catch {}
      sendToSession(sessionId, text);
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

  const heartbeatInterval = setInterval(() => {
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

  return {
    close() {
      clearInterval(heartbeatInterval);
      server.off("upgrade", upgradeHandler);
      for (const ws of connections.keys()) {
        try {
          ws.close();
        } catch {}
      }
      connections.clear();
      buffers.clear();
      wss.close();
    },
  };
}
