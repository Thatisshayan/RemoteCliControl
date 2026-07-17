import { Router } from "express";
import { getActiveConnection, getActiveConnectionSafe, getConnectionsSafe, addConnection, removeConnection, setActiveConnection, getConnectionById } from "../lib/store.js";
import { testConnection } from "../lib/sshManager.js";
import {
  ConnectionInputSchema,
  NamedConnectionInputSchema,
} from "../lib/contracts.js";
import { HttpError, parseBody, sendError } from "../lib/http.js";
const router = Router();

// Legacy single-connection endpoints
router.get("/connection", (_req, res) => {
  const conn = getActiveConnectionSafe();
  if (!conn) return sendError(res, 404, "CONNECTION_NOT_FOUND", "No connection configured");
  res.json(conn);
});

router.post("/connection", (req, res, next) => {
  try {
    const input = parseBody(ConnectionInputSchema, req);
    const existing = getActiveConnection();
    if (existing) {
      removeConnection(existing.id);
    }
    const profile = addConnection({
      name: existing?.name || "Default",
      ...input,
    });
    setActiveConnection(profile.id);
    res.json(getActiveConnectionSafe());
  } catch (err) {
    next(err);
  }
});

router.post("/connection/test", async (req, res, next) => {
  try {
    const input = parseBody(ConnectionInputSchema, req);
    const result = await testConnection({
      host: input.host,
      port: Number(input.port),
      username: input.username,
      password: input.authMode === "password" ? input.password : undefined,
      privateKey: input.authMode === "key" ? input.privateKey : undefined,
      passphrase: input.authMode === "key" ? input.passphrase : undefined,
    });
    res.json(result);
  } catch (err) {
    next(err);
  }
});

// Multi-profile endpoints
router.get("/connections", (_req, res) => {
  res.json(getConnectionsSafe());
});

router.get("/connections/active", (_req, res) => {
  const conn = getActiveConnectionSafe();
  if (!conn) return sendError(res, 404, "CONNECTION_NOT_FOUND", "No active connection");
  res.json(conn);
});

router.post("/connections", (req, res, next) => {
  try {
    const input = parseBody(NamedConnectionInputSchema, req);
    const profile = addConnection(input);
    res.status(201).json(getConnectionsSafe().find((connection) => connection.id === profile.id));
  } catch (err) {
    next(err);
  }
});

router.delete("/connections/:id", (req, res) => {
  const ok = removeConnection(req.params.id);
  if (!ok) return sendError(res, 404, "PROFILE_NOT_FOUND", "Profile not found");
  res.json({ success: true });
});

router.post("/connections/:id/activate", (req, res) => {
  const profile = getConnectionById(req.params.id);
  if (!profile) return sendError(res, 404, "PROFILE_NOT_FOUND", "Profile not found");
  setActiveConnection(req.params.id);
  res.json({ success: true });
});

export default router;
