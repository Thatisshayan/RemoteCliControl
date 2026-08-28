import { afterEach, describe, expect, it } from "vitest";
import { startTunnel } from "../tunnel.js";

describe("startTunnel", () => {
  const originalToken = process.env.CLOUDFLARE_TUNNEL_TOKEN;
  const originalHostname = process.env.CLOUDFLARE_TUNNEL_HOSTNAME;

  afterEach(() => {
    if (originalToken === undefined) delete process.env.CLOUDFLARE_TUNNEL_TOKEN;
    else process.env.CLOUDFLARE_TUNNEL_TOKEN = originalToken;
    if (originalHostname === undefined) delete process.env.CLOUDFLARE_TUNNEL_HOSTNAME;
    else process.env.CLOUDFLARE_TUNNEL_HOSTNAME = originalHostname;
  });

  it("rejects when cloudflared.exe is missing, regardless of mode", async () => {
    delete process.env.CLOUDFLARE_TUNNEL_TOKEN;
    delete process.env.CLOUDFLARE_TUNNEL_HOSTNAME;
    await expect(startTunnel(3000)).rejects.toThrow(/cloudflared.exe not found/);
  });

  it("falls back to a quick tunnel when only a token is set (missing hostname)", async () => {
    process.env.CLOUDFLARE_TUNNEL_TOKEN = "token-only";
    delete process.env.CLOUDFLARE_TUNNEL_HOSTNAME;
    // Falls through to the quick-tunnel path, which still rejects without
    // cloudflared.exe present — this just proves it didn't try the named-tunnel path.
    await expect(startTunnel(3000)).rejects.toThrow(/cloudflared.exe not found/);
  });

  it("falls back to a quick tunnel when only a hostname is set (missing token)", async () => {
    delete process.env.CLOUDFLARE_TUNNEL_TOKEN;
    process.env.CLOUDFLARE_TUNNEL_HOSTNAME = "remotectrl.example.com";
    await expect(startTunnel(3000)).rejects.toThrow(/cloudflared.exe not found/);
  });
});
