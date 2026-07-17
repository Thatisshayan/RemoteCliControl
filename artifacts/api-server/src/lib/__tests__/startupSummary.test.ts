import { describe, expect, it } from "vitest";
import { buildStartupSummary, formatStartupSummary } from "../startupSummary.js";

const BASE_INPUT = {
  port: 3000,
  version: "1.2.3",
  nodeVersion: "v22.0.0",
  pid: 1234,
  authMode: "token" as const,
  tunnelEnabled: false,
  tunnelUrl: null,
  tunnelError: null,
};

describe("buildStartupSummary", () => {
  it("stamps a startedAt from the provided clock", () => {
    const now = new Date("2026-07-17T12:00:00.000Z");
    const summary = buildStartupSummary(BASE_INPUT, now);
    expect(summary.startedAt).toBe("2026-07-17T12:00:00.000Z");
    expect(summary.port).toBe(3000);
  });
});

describe("formatStartupSummary", () => {
  it("shows the tunnel as disabled when tunnelEnabled is false", () => {
    const summary = buildStartupSummary(BASE_INPUT, new Date());
    const text = formatStartupSummary(summary);
    expect(text).toContain("tunnel:      disabled");
  });

  it("shows the tunnel URL when active", () => {
    const summary = buildStartupSummary(
      { ...BASE_INPUT, tunnelEnabled: true, tunnelUrl: "https://example.trycloudflare.com" },
      new Date(),
    );
    const text = formatStartupSummary(summary);
    expect(text).toContain("tunnel:      active (https://example.trycloudflare.com)");
  });

  it("flags a failed tunnel with its error instead of silently showing 'disabled'", () => {
    const summary = buildStartupSummary(
      { ...BASE_INPUT, tunnelEnabled: true, tunnelUrl: null, tunnelError: "ECONNREFUSED" },
      new Date(),
    );
    const text = formatStartupSummary(summary);
    expect(text).toContain("tunnel:      FAILED (ECONNREFUSED)");
  });

  it("shows enabled-but-pending when the tunnel is on but has neither a URL nor an error yet", () => {
    const summary = buildStartupSummary(
      { ...BASE_INPUT, tunnelEnabled: true, tunnelUrl: null, tunnelError: null },
      new Date(),
    );
    const text = formatStartupSummary(summary);
    expect(text).toContain("tunnel:      enabled, no URL yet");
  });

  it("includes version, node, pid, port, and auth mode", () => {
    const summary = buildStartupSummary(BASE_INPUT, new Date());
    const text = formatStartupSummary(summary);
    expect(text).toContain("version:     1.2.3");
    expect(text).toContain("node:        v22.0.0");
    expect(text).toContain("pid:         1234");
    expect(text).toContain("port:        3000");
    expect(text).toContain("auth mode:   token");
  });
});
