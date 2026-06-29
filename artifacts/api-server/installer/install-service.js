const { Service } = require("node-windows");
const path = require("path");
const fs = require("fs");

function resolveInstallRoot() {
  const candidates = [
    path.resolve(__dirname, ".."),
    process.env.REMOTECTRL_HOME,
  ].filter(Boolean);
  for (const dir of candidates) {
    if (fs.existsSync(path.join(dir, "RemoteCTRL.exe"))) return dir;
  }
  throw new Error(
    `RemoteCTRL.exe not found. Looked in: ${candidates.join(", ")}.\n` +
      `Run this from the same folder as RemoteCTRL.exe (or set REMOTECTRL_HOME).`,
  );
}

const HERE = resolveInstallRoot();
const exePath = path.join(HERE, "RemoteCTRL.exe");

const configPath = path.join(HERE, "data", "config.json");
let cfg = {};
try {
  cfg = JSON.parse(fs.readFileSync(configPath, "utf8"));
} catch {
  // no config yet — pass through env defaults on first install
}

const userAccount = process.env.USERNAME && process.env.USERDOMAIN
  ? `${process.env.USERDOMAIN}\\${process.env.USERNAME}`
  : undefined;

const svc = new Service({
  name: "RemoteCTRL",
  description: "RemoteCTRL — Remote CLI Control Server",
  script: exePath,
  nodeOptions: [],
  env: [
    { name: "PORT", value: String(cfg.port ?? process.env.PORT ?? 3000) },
    {
      name: "API_TOKEN",
      value: cfg.apiToken ?? process.env.API_TOKEN ?? "",
    },
    {
      name: "CLOUDFLARE_TUNNEL",
      value: String(cfg.cloudflareTunnel ?? process.env.CLOUDFLARE_TUNNEL ?? "true"),
    },
  ],
  workingDirectory: HERE,
  ...(userAccount ? { user: { account: userAccount } } : {}),
  grow: 0.25,
  maxRetries: 3,
});

let started = false;

svc.on("install", () => {
  console.log("RemoteCTRL service installed successfully.");
  console.log("Starting service...");
  svc.start();
});

svc.on("alreadyinstalled", () => {
  console.log("RemoteCTRL service is already installed.");
});

svc.on("start", () => {
  started = true;
  console.log("RemoteCTRL service started.");
  process.exit(0);
});

svc.on("error", (err) => {
  console.error("Service error:", err && err.message ? err.message : err);
  process.exit(1);
});

setTimeout(() => {
  if (!started) {
    console.error("Service failed to start within 15s — check Windows Event Log.");
    process.exit(2);
  }
}, 15000);

console.log(`Installing RemoteCTRL service from ${HERE}...`);
svc.install();
