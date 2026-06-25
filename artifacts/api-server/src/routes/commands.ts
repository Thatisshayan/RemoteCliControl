import { Router } from "express";
import { getCommands, addCommand, removeCommand } from "../lib/store.js";
const router = Router();

router.get("/commands", (_req, res) => {
  res.json(getCommands());
});

router.post("/commands", (req, res) => {
  const { label, command, description } = req.body;
  if (!label || !command) return res.status(400).json({ error: "label and command required" });
  const cmd = addCommand(label, command, description || "");
  res.status(201).json(cmd);
});

router.delete("/commands/:id", (req, res) => {
  const ok = removeCommand(req.params.id);
  if (!ok) return res.status(404).json({ error: "Command not found" });
  res.json({ success: true });
});

export default router;
