import { Router } from "express";
import { listSessions, createSession, closeSession, getSession } from "../lib/sshManager.js";
import { getActiveConnection } from "../lib/store.js";
const router = Router();

router.get("/sessions", (_req, res) => {
  res.json(listSessions());
});

router.post("/sessions", async (_req, res) => {
  if (!getActiveConnection()) return res.status(400).json({ error: "No connection configured" });
  try {
    const session = await createSession();
    res.status(201).json(session);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.delete("/sessions/:id", (req, res) => {
  const ok = closeSession(req.params.id);
  if (!ok) return res.status(404).json({ error: "Session not found" });
  res.json({ success: true });
});

router.patch("/sessions/:id", (req, res) => {
  const session = getSession(req.params.id);
  if (!session) return res.status(404).json({ error: "Session not found" });
  if (req.body.title) session.title = req.body.title;
  res.json({ id: session.id, title: session.title, status: session.status, createdAt: session.createdAt.toISOString() });
});

export default router;
