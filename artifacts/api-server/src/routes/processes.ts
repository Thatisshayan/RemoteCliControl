import { Router } from "express";
import { execCommand } from "../lib/sshManager.js";
import { z } from "zod";
import { parseParams, sendError } from "../lib/http.js";
const router = Router();

router.get("/processes", async (_req, res, next) => {
  try {
    const cmd =
      'powershell.exe -NoProfile -Command "Get-Process | Select-Object -Property Name,Id,CPU,WorkingSet,Responding | ConvertTo-Json -Compress"';
    const output = await execCommand(cmd);
    const raw = output.trim();
    if (!raw) return res.json([]);
    const parsed = JSON.parse(raw);
    const processList = Array.isArray(parsed) ? parsed : [parsed];
    const processes = processList.map((obj: any) => {
      return {
        pid: parseInt(obj.Id || "0"),
        name: obj.Name || "",
        cpu: parseFloat(obj.CPU || "0") || 0,
        memory: parseFloat(obj.WorkingSet || "0") / (1024 * 1024) || 0,
        status: obj.Responding === "True" ? "running" as const : "not responding" as const,
        user: "",
      };
    });
    res.json(processes);
  } catch (e: any) {
    next(e);
  }
});

router.delete("/processes/:pid", async (req, res, next) => {
  try {
    const { pid } = parseParams(z.object({ pid: z.string().regex(/^\d+$/) }), req);
    await execCommand(`powershell.exe -NoProfile -Command "Stop-Process -Id ${pid} -Force"`);
    res.json({ success: true });
  } catch (e: any) {
    next(e);
  }
});

export default router;
