import { loadConfig } from "./lib/config.js";
import { applyConfigToEnvironment, preparePackagedWorkingDirectory } from "./lib/runtimeConfig.js";

preparePackagedWorkingDirectory();

const config = loadConfig();
if (config) {
  applyConfigToEnvironment(config);
} else {
  process.env.PORT = "3000";
  process.env.API_TOKEN = "";
  process.env.CLOUDFLARE_TUNNEL = "false";
}

void import("./index.js").catch((error) => {
  console.error("RemoteCTRL server failed to start:", error);
  process.exitCode = 1;
});
