// Building the startup summary as a pure function (rather than logging
// inline in index.ts) makes it independently testable without having to
// spin up a real HTTP server/tunnel in the test.

export interface StartupSummaryInput {
  port: number;
  version: string;
  nodeVersion: string;
  pid: number;
  authMode: "token" | "none";
  tunnelEnabled: boolean;
  tunnelUrl: string | null;
  tunnelError: string | null;
}

export interface StartupSummary extends StartupSummaryInput {
  startedAt: string;
}

export function buildStartupSummary(input: StartupSummaryInput, now: Date = new Date()): StartupSummary {
  return { ...input, startedAt: now.toISOString() };
}

/**
 * Renders the summary as a single human-scannable block, distinct from the
 * scattered structured log lines emitted during startup -- this is meant to
 * answer "is everything actually up?" at a glance without grepping.
 */
export function formatStartupSummary(summary: StartupSummary): string {
  const lines = [
    "RemoteCTRL server status",
    `  version:     ${summary.version}`,
    `  node:        ${summary.nodeVersion}`,
    `  pid:         ${summary.pid}`,
    `  port:        ${summary.port}`,
    `  auth mode:   ${summary.authMode}`,
    `  tunnel:      ${describeTunnel(summary)}`,
    `  started at:  ${summary.startedAt}`,
  ];
  return lines.join("\n");
}

function describeTunnel(summary: StartupSummary): string {
  if (!summary.tunnelEnabled) return "disabled";
  if (summary.tunnelUrl) return `active (${summary.tunnelUrl})`;
  if (summary.tunnelError) return `FAILED (${summary.tunnelError})`;
  return "enabled, no URL yet";
}
