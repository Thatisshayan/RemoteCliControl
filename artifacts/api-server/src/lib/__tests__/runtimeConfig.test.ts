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
});
