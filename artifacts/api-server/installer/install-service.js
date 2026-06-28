const { Service } = require("node-windows");
const path = require("path");

const svc = new Service({
  name: "RemoteCTRL",
  description: "RemoteCTRL — Remote CLI Control Server",
  script: path.join(__dirname, "..", "dist", "index.mjs"),
  nodeOptions: ["--experimental-modules"],
  env: [
    { name: "PORT", value: process.env.PORT || "3000" },
    { name: "API_TOKEN", value: process.env.API_TOKEN || "" },
    { name: "CLOUDFLARE_TUNNEL", value: process.env.CLOUDFLARE_TUNNEL || "true" },
  ],
  workingDirectory: path.join(__dirname, ".."),
  grow: 0.25,
  maxRetries: 3,
});

svc.on("install", () => {
  console.log("RemoteCTRL service installed successfully.");
  console.log("Starting service...");
  svc.start();
});

svc.on("alreadyinstalled", () => {
  console.log("RemoteCTRL service is already installed.");
});

svc.on("start", () => {
  console.log("RemoteCTRL service started.");
  process.exit(0);
});

svc.on("error", (err) => {
  console.error("Service error:", err.message);
  process.exit(1);
});

console.log("Installing RemoteCTRL service...");
svc.install();
