import path from "path";
import { spawn, ChildProcess } from "child_process";
import fs from "fs";
import http from "http";
import SystrayModule, { MenuItem } from "systray2";
import { loadConfig } from "./lib/config.js";
import {
  applyConfigToEnvironment,
  isPackaged,
  preparePackagedWorkingDirectory,
} from "./lib/runtimeConfig.js";

const Systray = (SystrayModule as unknown as { default?: typeof SystrayModule }).default ?? SystrayModule;
const traySeparator: MenuItem = (SystrayModule as unknown as { separator?: MenuItem }).separator
  ?? (Systray as typeof Systray & { separator?: MenuItem }).separator
  ?? { title: "<SEPARATOR>", tooltip: "", enabled: false };
const trayIcon = isPackaged()
  ? path.join(process.cwd(), "tray.ico")
  : path.join(process.cwd(), "..", "..", "ios", "RemoteCTRL", "Assets.xcassets", "AppIcon.appiconset", "icon-1024.png");

async function runSetupWizard(port: number): Promise<void> {
  const setupUrl = `http://localhost:${port}/api/setup/html`;
  const browser = spawn("cmd", ["/c", "start", "", setupUrl], {
    detached: true,
    stdio: "ignore",
    windowsHide: true,
  });
  browser.unref();
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
  preparePackagedWorkingDirectory();

  let config = loadConfig();
  let port = config?.PORT || 3000;
  const packaged = isPackaged();
  const serverCommand = packaged
    ? path.join(process.cwd(), "RemoteCTRLServer.exe")
    : process.execPath;
  const serverArguments = packaged
    ? []
    : [path.join(process.cwd(), "dist", "index.mjs")];

  let serverProcess: ChildProcess | null = null;
  let statusInterval: ReturnType<typeof setInterval> | null = null;

  function startServer(): void {
    if (serverProcess) {
      serverProcess.kill();
      serverProcess = null;
    }
    if (!fs.existsSync(serverCommand)) {
      console.error("Server executable not found at", serverCommand);
      return;
    }
    const environment = { ...process.env };
    if (config) {
      applyConfigToEnvironment(config, environment);
    }
    serverProcess = spawn(serverCommand, serverArguments, {
      stdio: "inherit",
      env: environment,
      windowsHide: true,
    });
    serverProcess.on("exit", (code) => {
      console.log("Server exited with code", code);
      serverProcess = null;
    });
  }

  function stopAll(): void {
    if (statusInterval) { clearInterval(statusInterval); statusInterval = null; }
    if (serverProcess) { serverProcess.kill(); serverProcess = null; }
  }

  if (!config) {
    console.log("No config found. Starting setup wizard on port", port);
    const setupServer = spawn(serverCommand, serverArguments, {
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
    config = loadConfig();
    if (!config) {
      throw new Error("Setup completed without writing a valid configuration.");
    }
    port = config.PORT;
    setupServer.kill();
  }

  startServer();

  const trayItems: MenuItem[] = [
    { title: "RemoteCTRL", tooltip: "", checked: false, enabled: false },
    { title: "Status: Starting...", tooltip: "", checked: false, enabled: false },
    { title: "Tunnel URL: loading...", tooltip: "", checked: false, enabled: false },
    traySeparator,
    { title: "Open Server Logs", tooltip: "", checked: false, enabled: true },
    { title: "Restart Server", tooltip: "", checked: false, enabled: true },
    { title: "Stop Server", tooltip: "", checked: false, enabled: true },
    { title: "Quit", tooltip: "", checked: false, enabled: true },
  ];

  const systray = new Systray({
    menu: {
      icon: trayIcon,
      title: "RemoteCTRL",
      tooltip: "RemoteCTRL",
      items: trayItems,
    },
    debug: false,
    copyDir: false,
  });

  try {
    await systray.ready();
  } catch (error) {
    console.error("Tray UI failed to start; continuing with the server only:", error);
    await new Promise<void>(() => {});
    return;
  }

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
