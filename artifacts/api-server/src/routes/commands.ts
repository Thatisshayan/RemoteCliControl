import { Router } from "express";
import { getCommands, addCommand, removeCommand } from "../lib/store.js";
import { SavedCommandSchema } from "../lib/contracts.js";
import { parseBody, sendError } from "../lib/http.js";
const router = Router();

router.get("/commands", (_req, res) => {
  res.json(getCommands());
});

router.post("/commands", (req, res, next) => {
  try {
    const input = parseBody(SavedCommandSchema.omit({ id: true }), req);
    const cmd = addCommand(input.label, input.command, input.description || "");
    res.status(200).json(cmd);
  } catch (err) {
    next(err);
  }
});

router.delete("/commands/:id", (req, res) => {
  const ok = removeCommand(req.params.id);
  if (!ok) return sendError(res, 404, "COMMAND_NOT_FOUND", "Command not found");
  res.json({ success: true });
});

export default router;
