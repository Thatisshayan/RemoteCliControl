import path from "path";
import type { AppConfig } from "./config.js";

export function applyConfigToEnvironment(
  config: AppConfig,
  environment: NodeJS.ProcessEnv = process.env,
): void {
  environment.PORT = String(config.PORT);
  environment.API_TOKEN = config.API_TOKEN;
  environment.CLOUDFLARE_TUNNEL = config.CLOUDFLARE_TUNNEL ? "true" : "false";
}

export function preparePackagedWorkingDirectory(): void {
  if (isPackaged()) {
    process.chdir(path.dirname(process.execPath));
  }
}

export function isPackaged(): boolean {
  return "pkg" in process;
}
