import { Router, type Request, type Response, type NextFunction } from "express";
import { loadConfig, createDefaultConfig, saveConfig, generateToken } from "../lib/config.js";
import path from "path";
import fs from "fs";

const router = Router();

// Setup is unauthenticated by design (there's no token yet on first run), so
// it must never be reachable from anything but the machine itself — closes
// the race where a remote client could complete setup before the owner does
// if the port is reachable off-box (LAN, or a tunnel started too early).
export function loopbackOnly(req: Request, res: Response, next: NextFunction) {
  const ip = req.socket.remoteAddress || "";
  const isLoopback = ip === "127.0.0.1" || ip === "::1" || ip === "::ffff:127.0.0.1";
  if (!isLoopback) {
    res.status(403).json({ error: "Setup is only available from the local machine" });
    return;
  }
  next();
}

router.use(loopbackOnly);

router.get("/", (_req, res) => {
  const config = loadConfig();
  if (config) {
    res.json({ setupRequired: false });
    return;
  }
  res.json({ setupRequired: true });
});

router.post("/init", (req, res) => {
  const existing = loadConfig();
  if (existing) {
    res.status(400).json({ error: "Already configured" });
    return;
  }

  const { PORT, API_TOKEN, CLOUDFLARE_TUNNEL } = req.body || {};
  const config = createDefaultConfig();
  if (PORT && typeof PORT === "number" && PORT > 0 && PORT < 65536) {
    config.PORT = PORT;
  }
  config.API_TOKEN = typeof API_TOKEN === "string" && API_TOKEN.length > 0 ? API_TOKEN : generateToken();
  config.CLOUDFLARE_TUNNEL = CLOUDFLARE_TUNNEL !== false;
  saveConfig(config);

  res.json({ ok: true, apiToken: config.API_TOKEN });
});

router.get("/html", (_req, res) => {
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>RemoteCTRL Setup</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: #0d0d0d; color: #e0e0e0;
      display: flex; justify-content: center; align-items: center;
      min-height: 100vh; padding: 20px;
    }
    .card {
      background: #1a1a1a; border-radius: 12px; padding: 32px;
      width: 100%; max-width: 440px; box-shadow: 0 4px 24px rgba(0,0,0,0.4);
    }
    h1 { color: #00ff88; font-size: 24px; margin-bottom: 8px; }
    p { color: #888; font-size: 14px; margin-bottom: 24px; }
    label { display: block; font-size: 13px; font-weight: 600; margin-bottom: 6px; color: #aaa; }
    input[type="text"], input[type="number"], input[type="password"] {
      width: 100%; padding: 10px 12px; background: #0d0d0d; border: 1px solid #333;
      border-radius: 8px; color: #e0e0e0; font-size: 14px; margin-bottom: 16px;
    }
    input:focus { outline: none; border-color: #00ff88; }
    .checkbox-row { display: flex; align-items: center; gap: 10px; margin-bottom: 20px; }
    .checkbox-row input { width: 18px; height: 18px; }
    .checkbox-row label { margin-bottom: 0; }
    button {
      width: 100%; padding: 12px; background: #00ff88; color: #0d0d0d;
      border: none; border-radius: 8px; font-size: 16px; font-weight: 700;
      cursor: pointer; margin-top: 8px;
    }
    button:hover { background: #00cc6a; }
    button:disabled { opacity: 0.5; cursor: not-allowed; }
    #result { margin-top: 16px; padding: 12px; border-radius: 8px; display: none; }
    #result.success { background: #0a2e1a; color: #00ff88; display: block; }
    #result.error { background: #2e0a0a; color: #ff4444; display: block; }
    code { background: #0d0d0d; padding: 2px 6px; border-radius: 4px; font-size: 13px; }
  </style>
</head>
<body>
  <div class="card">
    <h1>RemoteCTRL Setup</h1>
    <p>Configure your server for first use.</p>
    <form id="setupForm">
      <label for="port">Port</label>
      <input type="number" id="port" name="port" value="3000" min="1024" max="65535" />

      <label for="api_token">API Token</label>
      <input type="text" id="api_token" name="api_token" placeholder="Leave blank to auto-generate" />

      <div class="checkbox-row">
        <input type="checkbox" id="tunnel" name="tunnel" checked />
        <label for="tunnel">Enable Cloudflare Tunnel (remote access)</label>
      </div>

      <button type="submit" id="submitBtn">Finish Setup</button>
    </form>
    <div id="result"></div>
  </div>
  <script>
    document.getElementById('setupForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      const btn = document.getElementById('submitBtn');
      const result = document.getElementById('result');
      btn.disabled = true;
      btn.textContent = 'Saving...';
      result.className = '';
      result.style.display = 'none';
      try {
        const res = await fetch('/api/setup/init', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            PORT: parseInt(document.getElementById('port').value, 10),
            API_TOKEN: document.getElementById('api_token').value.trim(),
            CLOUDFLARE_TUNNEL: document.getElementById('tunnel').checked,
          }),
        });
        const data = await res.json();
        if (res.ok) {
          if (data.apiToken) {
            result.innerHTML = 'Setup complete! Your API Token: <code>' + data.apiToken + '</code><br><br>Save this token — you will need it on your phone. This window can be closed.';
          } else {
            result.innerHTML = 'Setup complete! This window can be closed.';
          }
          result.className = 'success';
        } else {
          result.textContent = 'Error: ' + (data.error || 'Unknown error');
          result.className = 'error';
        }
      } catch (err) {
        result.textContent = 'Error: Could not reach server. Is it running?';
        result.className = 'error';
      }
      btn.disabled = false;
      btn.textContent = 'Finish Setup';
    });
  </script>
</body>
</html>`;
  res.type("html").send(html);
});

export default router;
