import path from "path";
import { spawn, ChildProcess } from "child_process";
import fs from "fs";
import http from "http";
import Systray from "systray2";
import open from "open";

const CONFIG_PATH = path.join(process.cwd(), "data", "config.json");

function loadConfig(): { PORT: number; API_TOKEN: string; CLOUDFLARE_TUNNEL: boolean } | null {
  try {
    if (fs.existsSync(CONFIG_PATH)) {
      return JSON.parse(fs.readFileSync(CONFIG_PATH, "utf8"));
    }
  } catch {}
  return null;
}

async function runSetupWizard(port: number): Promise<void> {
  const setupUrl = `http://localhost:${port}/api/setup/html`;
  await open(setupUrl);
}

function pollHealth(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const req = http.get(`http://localhost:${port}/health`, (res) => {
      resolve(res.statusCode === 200);
    });
    req.on("error", () => resolve(false));
    req.setTimeout(3000, () => { req.destroy(); resolve(false); });
  });
}

function getTunnelUrl(port: number): Promise<string | null> {
  return new Promise((resolve) => {
    const req = http.get(`http://localhost:${port}/tunnel-url`, (res) => {
      let data = "";
      res.on("data", (chunk) => { data += chunk; });
      res.on("end", () => {
        try {
          const parsed = JSON.parse(data);
          resolve(parsed.tunnelUrl || null);
        } catch {
          resolve(null);
        }
      });
    });
    req.on("error", () => resolve(null));
    req.setTimeout(3000, () => { req.destroy(); resolve(null); });
  });
}

async function main(): Promise<void> {
  const config = loadConfig();
  const port = config?.PORT || 3000;
  const serverScript = path.join(process.cwd(), "dist", "index.mjs");

  let serverProcess: ChildProcess | null = null;
  let tunnelProcess: ChildProcess | null = null;
  let statusInterval: ReturnType<typeof setInterval> | null = null;

  function startServer(): void {
    if (serverProcess) {
      serverProcess.kill();
      serverProcess = null;
    }
    if (!fs.existsSync(serverScript)) {
      console.error("Server script not found at", serverScript);
      return;
    }
    serverProcess = spawn(process.execPath, [serverScript], {
      stdio: "inherit",
      env: {
        ...process.env,
        PORT: String(port),
        API_TOKEN: config?.API_TOKEN || "",
        CLOUDFLARE_TUNNEL: config?.CLOUDFLARE_TUNNEL ? "true" : "false",
      },
      windowsHide: true,
    });
    serverProcess.on("exit", (code) => {
      console.log("Server exited with code", code);
      serverProcess = null;
    });
  }

  function startTunnel(): void {
    const cloudflaredPath = path.join(process.cwd(), "cloudflared.exe");
    if (!config?.CLOUDFLARE_TUNNEL || !fs.existsSync(cloudflaredPath)) return;
    tunnelProcess = spawn(cloudflaredPath, ["tunnel", "--url", `http://localhost:${port}`], {
      stdio: ["ignore", "ignore", "pipe"],
      windowsHide: true,
    });
    tunnelProcess.on("exit", (code) => {
      console.log("Tunnel exited with code", code);
      tunnelProcess = null;
    });
  }

  function stopAll(): void {
    if (statusInterval) { clearInterval(statusInterval); statusInterval = null; }
    if (tunnelProcess) { tunnelProcess.kill("SIGTERM"); tunnelProcess = null; }
    if (serverProcess) { serverProcess.kill(); serverProcess = null; }
  }

  if (!config) {
    console.log("No config found. Starting setup wizard on port", port);
    const setupServer = spawn(process.execPath, [serverScript], {
      stdio: "inherit",
      env: { ...process.env, PORT: String(port), API_TOKEN: "" },
      windowsHide: true,
    });
    await new Promise<void>((resolve) => {
      const tryHealth = async () => {
        const ok = await pollHealth(port);
        if (ok) resolve();
        else setTimeout(tryHealth, 1000);
      };
      tryHealth();
    });
    await runSetupWizard(port);
    console.log("Waiting for config to be written...");
    while (!loadConfig()) {
      await new Promise((r) => setTimeout(r, 1000));
    }
    setupServer.kill();
  }

  startServer();
  startTunnel();

  const trayItems = [
    { title: "RemoteCTRL", tooltip: "", checked: false, enabled: false },
    { title: "Status: Starting...", tooltip: "", checked: false, enabled: false },
    { title: "Tunnel URL: loading...", tooltip: "", checked: false, enabled: false },
    Systray.separator,
    { title: "Open Server Logs", tooltip: "", checked: false, enabled: true },
    { title: "Restart Server", tooltip: "", checked: false, enabled: true },
    { title: "Stop Server", tooltip: "", checked: false, enabled: true },
    { title: "Quit", tooltip: "", checked: false, enabled: true },
  ];

  const systray = new Systray({
    menu: {
      icon: "",
      title: "RemoteCTRL",
      tooltip: "RemoteCTRL",
      items: trayItems,
    },
    debug: false,
    copyDir: true,
  });

  systray.onReady(async () => {
    const updateStatus = async () => {
      const healthy = await pollHealth(port);
      const url = await getTunnelUrl(port);
      systray.sendAction({
        type: "update-item",
        item: { ...trayItems[1], title: healthy ? "Status: Running" : "Status: Stopped" },
        seq_id: 0,
      });
      systray.sendAction({
        type: "update-item",
        item: { ...trayItems[2], title: url ? `Tunnel URL: ${url}` : "Tunnel URL: inactive" },
        seq_id: 1,
      });
    };
    updateStatus();
    statusInterval = setInterval(updateStatus, 10_000);
  });

  systray.onClick((action) => {
    switch (action.item.title) {
      case "Open Server Logs": {
        const logPath = path.join(process.cwd(), "data", "server.log");
        if (fs.existsSync(logPath)) {
          spawn("notepad", [logPath], { windowsHide: true });
        }
        break;
      }
      case "Restart Server":
        stopAll();
        startServer();
        startTunnel();
        break;
      case "Stop Server":
      case "Quit":
        stopAll();
        systray.kill();
        process.exit(0);
        break;
    }
  });

  systray.onExit(() => {
    stopAll();
    process.exit(0);
  });
}

main().catch((err) => {
  console.error("Tray error:", err);
  process.exit(1);
});
