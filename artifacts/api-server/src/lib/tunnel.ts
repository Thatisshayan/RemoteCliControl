import { spawn, ChildProcess } from "child_process";
import path from "path";
import fs from "fs";
import logger from "./logger.js";

let tunnelProcess: ChildProcess | null = null;
let tunnelUrl: string | null = null;

const TUNNEL_URL_PATH = process.env.TUNNEL_URL_PATH || path.join(process.cwd(), "data", "tunnel-url.txt");

function ensureDataDir(): void {
  const dir = path.dirname(TUNNEL_URL_PATH);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function writeTunnelUrl(url: string): void {
  ensureDataDir();
  fs.writeFileSync(TUNNEL_URL_PATH, url, "utf8");
}

function parseTunnelUrl(data: string): string | null {
  const match = data.match(/https:\/\/[a-zA-Z0-9-]+\.trycloudflare\.com/);
  return match ? match[0] : null;
}

export function startTunnel(port: number): Promise<string> {
  return new Promise((resolve, reject) => {
    const cloudflaredPath = path.join(process.cwd(), "cloudflared.exe");
    if (!fs.existsSync(cloudflaredPath)) {
      logger.warn("cloudflared.exe not found — skipping tunnel");
      resolve("");
      return;
    }

    logger.info("Starting Cloudflare Tunnel...");
    tunnelProcess = spawn(cloudflaredPath, ["tunnel", "--url", `http://localhost:${port}`], {
      stdio: ["ignore", "ignore", "pipe"],
      windowsHide: true,
    });

    let buffer = "";

    tunnelProcess.stderr?.on("data", (chunk: Buffer) => {
      buffer += chunk.toString("utf8");
      const url = parseTunnelUrl(buffer);
      if (url) {
        tunnelUrl = url;
        logger.info({ tunnelUrl: url }, "Cloudflare Tunnel active");
        writeTunnelUrl(url);
        resolve(url);
      }
    });

    tunnelProcess.on("error", (err) => {
      logger.error({ err }, "Cloudflare Tunnel failed to start");
      tunnelProcess = null;
      reject(err);
    });

    tunnelProcess.on("exit", (code) => {
      if (!tunnelUrl) {
        logger.warn({ exitCode: code }, "Cloudflare Tunnel exited before providing URL");
        tunnelProcess = null;
        reject(new Error(`cloudflared exited with code ${code}`));
      }
    });

    setTimeout(() => {
      if (!tunnelUrl) {
        logger.warn("Cloudflare Tunnel did not produce a URL within 30s");
        resolve("");
      }
    }, 30_000);
  });
}

export function stopTunnel(): void {
  if (tunnelProcess) {
    logger.info("Stopping Cloudflare Tunnel");
    tunnelProcess.kill("SIGTERM");
    tunnelProcess = null;
  }
}

export function getTunnelUrl(): string | null {
  return tunnelUrl;
}
