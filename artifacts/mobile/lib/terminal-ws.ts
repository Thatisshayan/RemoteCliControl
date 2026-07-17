import { buildWebSocketUrl } from "@remotectrl/api-client-react";

export function sanitizeSessionId(id: string | null): string | null {
  if (!id) return null;
  const sanitized = id.replace(/[^a-zA-Z0-9_-]/g, "");
  return sanitized.length > 0 ? sanitized : null;
}

export interface TerminalSocketArgs {
  url: string;
  // Empty array means "connect without a subprotocol" — passing an empty
  // array to the WebSocket constructor (vs. omitting the argument) behaves
  // the same in both browser and React Native WebSocket implementations,
  // but keeping this as an array (rather than `string[] | undefined`) keeps
  // callers from needing two different call shapes.
  protocols: string[];
}

// The API token travels as a WebSocket subprotocol (see
// artifacts/api-server/src/lib/wsHandler.ts) rather than a URL query
// param, so it doesn't get written into access/proxy/edge logs.
export function buildTerminalSocketArgs(sessionId: string, token?: string | null): TerminalSocketArgs {
  const url = buildWebSocketUrl(`/api/ws/terminal/${sessionId}`);
  return {
    url,
    protocols: token ? [token] : [],
  };
}
