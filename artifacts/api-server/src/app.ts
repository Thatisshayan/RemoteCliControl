import { randomUUID } from "crypto";
import express from "express";
import cors from "cors";
import { authMiddleware } from "./lib/auth.js";
import rateLimit from "express-rate-limit";
import pinoHttp from "pino-http";
import routes from "./routes/index.js";
import logger from "./lib/logger.js";
import healthRoutes from "./routes/health.js";
import tunnelRoutes from "./routes/tunnel.js";
import setupRoutes from "./routes/setup.js";
import versionRoutes from "./routes/version.js";
import { HttpError, sendError } from "./lib/http.js";

const app = express();

app.use(cors());
app.use(express.json({ limit: "1mb" }));
app.use(
  pinoHttp({
    logger,
    // pino-http's default id is just an in-process counter (1, 2, 3, ...) —
    // useless for correlating a bug report against server logs across
    // restarts or once a reverse proxy/tunnel is involved. Reuse an
    // upstream x-request-id if one was already set, otherwise mint a UUID.
    genReqId: (req, res) => {
      const existing = req.headers["x-request-id"];
      const id = (Array.isArray(existing) ? existing[0] : existing) || randomUUID();
      res.setHeader("x-request-id", id);
      return id;
    },
  }),
);

app.use("/health", healthRoutes);
app.use("/tunnel-url", tunnelRoutes);
app.use("/version", versionRoutes);
app.use("/api/setup", setupRoutes);

const generalLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 100, standardHeaders: true, legacyHeaders: false });
const connectionLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 10, standardHeaders: true, legacyHeaders: false });

app.use("/api/connection/test", connectionLimiter);

app.use("/api", generalLimiter, authMiddleware, routes);

app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  // req.log is a pino child logger already bound with this request's id
  // (see genReqId above) — using it here instead of the bare logger means
  // even an unhandled/unexpected error can be traced back to one request.
  req.log.error({ err, url: req.url, method: req.method }, "Unhandled request error");
  if (err instanceof HttpError) {
    return sendError(res, err.status, err.code, err.message, err.details);
  }
  return sendError(res, err.status || 500, err.code || "INTERNAL_ERROR", err.message || "INTERNAL_ERROR");
});

export default app;
