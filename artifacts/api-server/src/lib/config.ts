import fs from "fs";
import path from "path";
import crypto from "crypto";

export interface AppConfig {
  PORT: number;
  API_TOKEN: string;
  CLOUDFLARE_TUNNEL: boolean;
  // Optional: a persistent Cloudflare Tunnel (created in the Cloudflare Zero
  // Trust dashboard) instead of the default ephemeral trycloudflare.com quick
  // tunnel. Requires a domain in the same Cloudflare account. When unset, the
  // server falls back to the quick tunnel.
  CLOUDFLARE_TUNNEL_TOKEN?: string;
  CLOUDFLARE_TUNNEL_HOSTNAME?: string;
}

const CONFIG_PATH = path.join(process.cwd(), "data", "config.json");

function ensureDataDir(): void {
  const dir = path.dirname(CONFIG_PATH);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

export function loadConfig(): AppConfig | null {
  try {
    if (fs.existsSync(CONFIG_PATH)) {
      const raw = fs.readFileSync(CONFIG_PATH, "utf8");
      return JSON.parse(raw);
    }
  } catch {
    // corrupted or missing
  }
  return null;
}

export function saveConfig(config: AppConfig): void {
  ensureDataDir();
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2));
}

export function createDefaultConfig(): AppConfig {
  return {
    PORT: 3000,
    API_TOKEN: "",
    CLOUDFLARE_TUNNEL: true,
  };
}

export function generateToken(length: number = 32): string {
  const chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  const bytes = crypto.randomBytes(length);
  let result = "";
  for (let i = 0; i < length; i++) {
    result += chars.charAt(bytes[i] % chars.length);
  }
  return result;
}
