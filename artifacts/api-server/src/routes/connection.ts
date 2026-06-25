import { Router } from "express";
import { getActiveConnection, getConnections, addConnection, removeConnection, setActiveConnection, getConnectionById } from "../lib/store.js";
import { testConnection } from "../lib/sshManager.js";
const router = Router();

// Legacy single-connection endpoints
router.get("/connection", (_req, res) => {
  const conn = getActiveConnection();
  if (!conn) return res.status(404).json({ error: "No connection configured" });
  res.json(conn);
});

router.post("/connection", (req, res) => {
  const { host, port, username, password, privateKey, passphrase } = req.body;
  if (!host || !port || !username) return res.status(400).json({ error: "Missing required fields" });

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

router.post("/connection/test", async (req, res) => {
  try {
    const { host, port, username, password, privateKey, passphrase } = req.body;
    if (!host || !port || !username) return res.status(400).json({ error: "Missing required fields" });
    const result = await testConnection({ host, port: Number(port), username, password, privateKey, passphrase });
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Multi-profile endpoints
router.get("/connections", (_req, res) => {
  res.json(getConnections());
});

router.get("/connections/active", (_req, res) => {
  const conn = getActiveConnection();
  if (!conn) return res.status(404).json({ error: "No active connection" });
  res.json(conn);
});

router.post("/connections", (req, res) => {
  const { name, host, port, username, password, privateKey, passphrase } = req.body;
  if (!name || !host || !port || !username) return res.status(400).json({ error: "Missing required fields" });
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
