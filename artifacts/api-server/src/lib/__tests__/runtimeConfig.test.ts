import { describe, expect, it } from "vitest";
import { applyConfigToEnvironment } from "../runtimeConfig.js";

describe("applyConfigToEnvironment", () => {
  it("uses the persisted desktop configuration for every server setting", () => {
    const environment: NodeJS.ProcessEnv = {
      PORT: "9999",
      API_TOKEN: "stale-token",
      CLOUDFLARE_TUNNEL: "true",
    };

    applyConfigToEnvironment(
      { PORT: 4567, API_TOKEN: "configured-token", CLOUDFLARE_TUNNEL: false },
      environment,
    );

    expect(environment).toMatchObject({
      PORT: "4567",
      API_TOKEN: "configured-token",
      CLOUDFLARE_TUNNEL: "false",
    });
  });

  it("propagates named-tunnel token and hostname when configured", () => {
    const environment: NodeJS.ProcessEnv = {};

    applyConfigToEnvironment(
      {
        PORT: 3000,
        API_TOKEN: "token",
        CLOUDFLARE_TUNNEL: true,
        CLOUDFLARE_TUNNEL_TOKEN: "cf-token-abc",
        CLOUDFLARE_TUNNEL_HOSTNAME: "remotectrl.example.com",
      },
      environment,
    );

    expect(environment.CLOUDFLARE_TUNNEL_TOKEN).toBe("cf-token-abc");
    expect(environment.CLOUDFLARE_TUNNEL_HOSTNAME).toBe("remotectrl.example.com");
  });

  it("leaves named-tunnel env vars unset when not configured", () => {
    const environment: NodeJS.ProcessEnv = {};

    applyConfigToEnvironment({ PORT: 3000, API_TOKEN: "token", CLOUDFLARE_TUNNEL: true }, environment);

    expect(environment.CLOUDFLARE_TUNNEL_TOKEN).toBeUndefined();
    expect(environment.CLOUDFLARE_TUNNEL_HOSTNAME).toBeUndefined();
  });
});
