import { Router } from "express";
import { execCommand } from "../lib/sshManager.js";
import { z } from "zod";
import { parseParams, sendError } from "../lib/http.js";
const router = Router();

router.get("/processes", async (req, res, next) => {
  try {
    const cmd =
      'powershell.exe -NoProfile -Command "Get-Process | Select-Object -Property Name,Id,CPU,WorkingSet,Responding | ConvertTo-Json -Compress"';
    const { stdout, stderr } = await execCommand(cmd);
    if (stderr.trim()) {
      // Non-fatal (e.g. access-denied on a handful of protected processes) —
      // Get-Process still returns the rest on stdout, which is what we parse.
      req.log.warn({ stderr: stderr.trim() }, "Get-Process reported warnings on stderr");
    }
    const raw = stdout.trim();
    if (!raw) return res.json([]);
    const parsed = JSON.parse(raw);
    const processList = Array.isArray(parsed) ? parsed : [parsed];
    const processes = processList.map((obj: any) => {
      return {
        pid: parseInt(obj.Id || "0"),
        name: obj.Name || "",
        cpu: parseFloat(obj.CPU || "0") || 0,
        memory: parseFloat(obj.WorkingSet || "0") / (1024 * 1024) || 0,
        // ConvertTo-Json serializes PowerShell's boolean Responding property
        // as a real JSON boolean, not the string "True" — comparing against
        // the string always evaluated to false, so every process reported
        // as "not responding" regardless of its actual state.
        status: obj.Responding === true ? "running" as const : "not responding" as const,
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
    // $ErrorActionPreference = 'Stop' escalates Stop-Process's normally
    // non-terminating "no such process"/access-denied errors into a
    // terminating one, which makes powershell.exe exit non-zero — otherwise
    // this route always reported success even when the kill silently failed.
    const { exitCode, stderr } = await execCommand(
      `powershell.exe -NoProfile -Command "$ErrorActionPreference = 'Stop'; Stop-Process -Id ${pid} -Force"`,
    );
    if (exitCode !== 0) {
      return sendError(res, 404, "PROCESS_KILL_FAILED", stderr.trim() || `Failed to stop process ${pid}`);
    }
    res.json({ success: true });
  } catch (e: any) {
    next(e);
  }
});

export default router;
