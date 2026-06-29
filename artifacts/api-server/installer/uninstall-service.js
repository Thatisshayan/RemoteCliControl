const { Service } = require("node-windows");

const svc = new Service({ name: "RemoteCTRL" });

svc.on("alreadyuninstalled", () => {
  console.log("RemoteCTRL was not installed.");
  process.exit(0);
});

svc.on("stop", () => {
  console.log("RemoteCTRL service stopped.");
  console.log("Uninstalling service...");
  svc.uninstall();
});

svc.on("uninstall", () => {
  console.log("RemoteCTRL service uninstalled successfully.");
  process.exit(0);
});

svc.on("error", (err) => {
  console.error("Service error:", err && err.message ? err.message : err);
  process.exit(1);
});

console.log("Stopping and uninstalling RemoteCTRL service...");
svc.stop();
