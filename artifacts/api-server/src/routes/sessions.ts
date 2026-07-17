import { Router } from "express";
import { listSessions, createSession, closeSession, getSession } from "../lib/sshManager.js";
import { getActiveConnection } from "../lib/store.js";
import { SessionRenameInputSchema } from "../lib/contracts.js";
import { parseBody, sendError } from "../lib/http.js";
const router = Router();

router.get("/sessions", (_req, res) => {
  res.json(listSessions());
});

router.post("/sessions", async (_req, res, next) => {
  if (!getActiveConnection()) return sendError(res, 400, "CONNECTION_NOT_CONFIGURED", "No connection configured");
  try {
    const session = await createSession();
    res.status(201).json(session);
  } catch (err: any) {
    next(err);
  }
});

router.delete("/sessions/:id", (req, res) => {
  const ok = closeSession(req.params.id);
  if (!ok) return sendError(res, 404, "SESSION_NOT_FOUND", "Session not found");
  res.json({ success: true });
});

router.patch("/sessions/:id", (req, res, next) => {
  const session = getSession(req.params.id);
  if (!session) return sendError(res, 404, "SESSION_NOT_FOUND", "Session not found");
  try {
    const body = parseBody(SessionRenameInputSchema, req);
    session.title = body.title;
    res.json({ id: session.id, title: session.title, status: session.status, createdAt: session.createdAt.toISOString() });
  } catch (err) {
    next(err);
  }
});

export default router;
