import { spawn, ChildProcess } from "child_process";
import path from "path";
import fs from "fs";
import logger from "./logger.js";

let tunnelProcess: ChildProcess | null = null;
let tunnelUrl: string | null = null;
let startupTimeout: ReturnType<typeof setTimeout> | null = null;

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

const NAMED_TUNNEL_READY_PATTERN = /Registered tunnel connection/i;

export function startTunnel(port: number): Promise<string> {
  const token = process.env.CLOUDFLARE_TUNNEL_TOKEN;
  const hostname = process.env.CLOUDFLARE_TUNNEL_HOSTNAME;

  if (token && hostname) {
    return startNamedTunnel(token, hostname);
  }
  if (token || hostname) {
    logger.warn(
      "CLOUDFLARE_TUNNEL_TOKEN and CLOUDFLARE_TUNNEL_HOSTNAME must both be set to use a named tunnel — falling back to a quick tunnel.",
    );
  }
  return startQuickTunnel(port);
}

// A named tunnel is created once in the Cloudflare Zero Trust dashboard
// (requires a domain in the same account) and gets a stable hostname instead
// of a random trycloudflare.com URL that changes every restart.
function startNamedTunnel(token: string, hostname: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const cloudflaredPath = path.join(process.cwd(), "cloudflared.exe");
    if (!fs.existsSync(cloudflaredPath)) {
      logger.warn("cloudflared.exe not found — skipping tunnel");
      reject(new Error("cloudflared.exe not found in working directory"));
      return;
    }

    const url = `https://${hostname}`;
    logger.info({ hostname }, "Starting named Cloudflare Tunnel...");
    tunnelProcess = spawn(cloudflaredPath, ["tunnel", "run", "--token", token], {
      stdio: ["ignore", "ignore", "pipe"],
      windowsHide: true,
    });

    let buffer = "";

    tunnelProcess.stderr?.on("data", (chunk: Buffer) => {
      buffer += chunk.toString("utf8");
      if (!tunnelUrl && NAMED_TUNNEL_READY_PATTERN.test(buffer)) {
        tunnelUrl = url;
        logger.info({ tunnelUrl: url }, "Cloudflare Tunnel active");
        writeTunnelUrl(url);
        if (startupTimeout) {
          clearTimeout(startupTimeout);
          startupTimeout = null;
        }
        resolve(url);
      }
    });

    tunnelProcess.on("error", (err) => {
      logger.error({ err }, "Cloudflare Tunnel failed to start");
      tunnelProcess = null;
      reject(err);
    });

    tunnelProcess.on("exit", (code) => {
      if (startupTimeout) {
        clearTimeout(startupTimeout);
        startupTimeout = null;
      }
      const hadConnected = Boolean(tunnelUrl);
      tunnelProcess = null;
      tunnelUrl = null;
      if (!hadConnected) {
        logger.warn({ exitCode: code }, "Cloudflare Tunnel exited before connecting");
        reject(new Error(`cloudflared exited with code ${code}`));
      } else {
        logger.warn({ exitCode: code }, "Cloudflare Tunnel process exited");
      }
    });

    startupTimeout = setTimeout(() => {
      if (!tunnelUrl) {
        logger.warn("Cloudflare Tunnel did not connect within 30s");
        tunnelProcess?.kill("SIGTERM");
        tunnelProcess = null;
        tunnelUrl = null;
        reject(new Error("Cloudflare Tunnel did not connect within 30s"));
      }
    }, 30_000);
  });
}

function startQuickTunnel(port: number): Promise<string> {
  return new Promise((resolve, reject) => {
    const cloudflaredPath = path.join(process.cwd(), "cloudflared.exe");
    if (!fs.existsSync(cloudflaredPath)) {
      logger.warn("cloudflared.exe not found — skipping tunnel");
      reject(new Error("cloudflared.exe not found in working directory"));
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
        if (startupTimeout) {
          clearTimeout(startupTimeout);
          startupTimeout = null;
        }
        resolve(url);
      }
    });

    tunnelProcess.on("error", (err) => {
      logger.error({ err }, "Cloudflare Tunnel failed to start");
      tunnelProcess = null;
      reject(err);
    });

    tunnelProcess.on("exit", (code) => {
      if (startupTimeout) {
        clearTimeout(startupTimeout);
        startupTimeout = null;
      }
      if (!tunnelUrl) {
        logger.warn({ exitCode: code }, "Cloudflare Tunnel exited before providing URL");
        tunnelProcess = null;
        reject(new Error(`cloudflared exited with code ${code}`));
      }
    });

    startupTimeout = setTimeout(() => {
      if (!tunnelUrl) {
        logger.warn("Cloudflare Tunnel did not produce a URL within 30s");
        reject(new Error("Cloudflare Tunnel did not produce a URL within 30s"));
      }
    }, 30_000);
  });
}

export function stopTunnel(): void {
  if (startupTimeout) {
    clearTimeout(startupTimeout);
    startupTimeout = null;
  }
  if (tunnelProcess) {
    logger.info("Stopping Cloudflare Tunnel");
    tunnelProcess.kill("SIGTERM");
    tunnelProcess = null;
  }
  tunnelUrl = null;
}

export function getTunnelUrl(): string | null {
  return tunnelUrl;
}
