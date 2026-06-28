const { Service } = require("node-windows");
const path = require("path");

const svc = new Service({
  name: "RemoteCTRL",
  script: path.join(__dirname, "..", "dist", "index.mjs"),
});

svc.on("uninstall", () => {
  console.log("RemoteCTRL service uninstalled successfully.");
  process.exit(0);
});

svc.on("error", (err) => {
  console.error("Service error:", err.message);
  process.exit(1);
});

console.log("Uninstalling RemoteCTRL service...");
svc.uninstall();
