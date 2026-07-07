import { Router } from "express";
import { getActiveConnection, getActiveConnectionSafe, getConnectionsSafe, addConnection, removeConnection, setActiveConnection, getConnectionById } from "../lib/store.js";
import { testConnection } from "../lib/sshManager.js";
const router = Router();

function validateConnectionInput(body: any): { ok: boolean; errors?: string[] } {
  const errors: string[] = [];
  if (typeof body.host !== "string" || body.host.length === 0 || body.host.length > 255) {
    errors.push("host: non-empty string, max 255 chars");
  }
  if (typeof body.port !== "number" || body.port < 1 || body.port > 65535) {
    errors.push("port: integer 1-65535");
  }
  if (typeof body.username !== "string" || body.username.length === 0) {
    errors.push("username: non-empty string");
  }
  if (!body.privateKey) {
    if (typeof body.password !== "string" || body.password.length === 0) {
      errors.push("password: required when no private key provided");
    }
  }
  if (errors.length) return { ok: false, errors };
  return { ok: true };
}

// Legacy single-connection endpoints
router.get("/connection", (_req, res) => {
  const conn = getActiveConnectionSafe();
  if (!conn) return res.status(404).json({ error: "No connection configured" });
  res.json(conn);
});

router.post("/connection", (req, res) => {
  const validation = validateConnectionInput(req.body);
  if (!validation.ok) return res.status(400).json({ error: validation.errors });

  const { host, port, username, password, privateKey, passphrase } = req.body;

  // Check if active connection exists - update it, otherwise create new
  const existing = getActiveConnection();
  if (existing) {
    // Update existing via removing and re-adding
    removeConnection(existing.id);
  }
  const profile = addConnection({ name: existing?.name || "Default", host, port: Number(port), username, password: password || "", privateKey, passphrase });
  setActiveConnection(profile.id);
  res.json(profile);
});

router.post("/connection/test", async (req, res, next) => {
  try {
    const validation = validateConnectionInput(req.body);
    if (!validation.ok) return res.status(400).json({ error: validation.errors });
    const { host, port, username, password, privateKey, passphrase } = req.body;
    const result = await testConnection({ host, port: Number(port), username, password, privateKey, passphrase });
    res.json(result);
  } catch (err: any) {
    next(err);
  }
});

// Multi-profile endpoints
router.get("/connections", (_req, res) => {
  res.json(getConnectionsSafe());
});

router.get("/connections/active", (_req, res) => {
  const conn = getActiveConnection();
  if (!conn) return res.status(404).json({ error: "No active connection" });
  res.json(conn);
});

router.post("/connections", (req, res) => {
  const { name, host, port, username, password, privateKey, passphrase } = req.body;
  if (!name || typeof name !== "string") return res.status(400).json({ error: "name: non-empty string required" });
  if (typeof host !== "string" || !host) return res.status(400).json({ error: "host: non-empty string required" });
  if (typeof port !== "number" || port < 1 || port > 65535) return res.status(400).json({ error: "port: integer 1-65535 required" });
  if (typeof username !== "string" || !username) return res.status(400).json({ error: "username: non-empty string required" });
  if (!privateKey && (typeof password !== "string" || !password)) return res.status(400).json({ error: "password: required when no private key provided" });
  const profile = addConnection({ name, host, port: Number(port), username, password: password || "", privateKey, passphrase });
  res.status(201).json(profile);
});

router.delete("/connections/:id", (req, res) => {
  const ok = removeConnection(req.params.id);
  if (!ok) return res.status(404).json({ error: "Profile not found" });
  res.json({ success: true });
});

router.post("/connections/:id/activate", (req, res) => {
  const profile = getConnectionById(req.params.id);
  if (!profile) return res.status(404).json({ error: "Profile not found" });
  setActiveConnection(req.params.id);
  res.json({ success: true });
});

export default router;
