import { useCallback, useEffect, useRef, useState } from "react";
import { HealthResponseSchema, TunnelStatusResponseSchema, VersionResponseSchema } from "@remotectrl/api-zod";
import { publicApi } from "@remotectrl/api-client-react";
import { isServerUnreachable } from "./error-message";

type Health = ReturnType<typeof HealthResponseSchema.parse>;
type TunnelStatus = ReturnType<typeof TunnelStatusResponseSchema.parse>;

export interface ServerStatusState {
  health: Health | null;
  tunnelStatus: TunnelStatus | null;
  mobileMinVersion: string | undefined;
  isUnreachable: boolean;
  isLoading: boolean;
  lastCheckedAt: number | null;
}

const DEFAULT_INTERVAL_MS = 30_000;

const INITIAL_STATE: ServerStatusState = {
  health: null,
  tunnelStatus: null,
  mobileMinVersion: undefined,
  isUnreachable: false,
  isLoading: true,
  lastCheckedAt: null,
};

/**
 * Polls /health, /tunnel-url, and /version and exposes one normalized
 * status shape, including whether the server is currently unreachable
 * (distinct from a slow/absent tunnel). Settings and the diagnostics
 * screen both use this instead of each duplicating the same
 * Promise.all/setInterval polling logic.
 */
export function useServerStatus(baseUrl: string, options?: { intervalMs?: number }) {
  const intervalMs = options?.intervalMs ?? DEFAULT_INTERVAL_MS;
  const [state, setState] = useState<ServerStatusState>(INITIAL_STATE);
  const mountedRef = useRef(true);

  const refresh = useCallback(async () => {
    try {
      const [healthResponse, tunnelResponse, versionResponse] = await Promise.all([
        publicApi.get("/health", undefined, HealthResponseSchema),
        publicApi.get("/tunnel-url", undefined, TunnelStatusResponseSchema),
        publicApi.get("/version", undefined, VersionResponseSchema).catch(() => null),
      ]);
      if (!mountedRef.current) return;
      setState({
        health: healthResponse,
        tunnelStatus: tunnelResponse,
        mobileMinVersion: versionResponse?.mobileMinVersion,
        isUnreachable: false,
        isLoading: false,
        lastCheckedAt: Date.now(),
      });
    } catch (err) {
      if (!mountedRef.current) return;
      setState({
        health: null,
        tunnelStatus: null,
        mobileMinVersion: undefined,
        isUnreachable: isServerUnreachable(err),
        isLoading: false,
        lastCheckedAt: Date.now(),
      });
    }
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    setState((prev) => ({ ...prev, isLoading: true }));
    refresh();
    const interval = setInterval(refresh, intervalMs);
    return () => {
      mountedRef.current = false;
      clearInterval(interval);
    };
    // Deliberately excludes `refresh` (stable via useCallback with no deps)
    // — only baseUrl/intervalMs changing should restart the poll cycle.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [baseUrl, intervalMs]);

  return { ...state, refetch: refresh };
}
