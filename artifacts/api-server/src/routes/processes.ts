import { Router } from "express";
import { execCommand } from "../lib/sshManager.js";
const router = Router();

router.get("/processes", async (_req, res) => {
  try {
    const cmd = 'powershell.exe -NoProfile -Command "Get-Process | Select-Object -Property Name,Id,CPU,WorkingSet,Responding | ConvertTo-Csv -NoTypeInformation"';
    const output = await execCommand(cmd);
    const lines = output.trim().split("\n").filter((l) => l.trim());
    if (lines.length < 2) return res.json([]);

    const headers = lines[0].split(",").map((h) => h.replace(/"/g, "").trim());
    const processes = lines.slice(1).map((line) => {
      const vals = line.split(",").map((v) => v.replace(/"/g, "").trim());
      const obj: any = {};
      headers.forEach((h, i) => { obj[h] = vals[i]; });
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
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.delete("/processes/:pid", async (req, res) => {
  try {
    const pid = req.params.pid;
    await execCommand(`powershell.exe -NoProfile -Command "Stop-Process -Id ${pid} -Force"`);
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
