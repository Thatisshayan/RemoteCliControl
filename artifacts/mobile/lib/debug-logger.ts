// #region debug — runtime log capture for TestFlight crash debugging
import AsyncStorage from '@react-native-async-storage/async-storage';

const DEBUG_SESSION_ID = 'remotectrl-cold-start-crash-2b0a26';
const LAST_FATAL_ERROR_KEY = 'last-fatal-error';
const LAST_CONSOLE_ERROR_KEY = 'last-console-error';

// Persists regardless of __DEV__: this is the only crash record that
// survives a TestFlight abort, since the network log below only reaches a
// dev-rig LAN IP and production builds have no crash reporter wired in.
async function persistFatalError(record: Record<string, unknown>) {
  try {
    await AsyncStorage.setItem(LAST_FATAL_ERROR_KEY, JSON.stringify({ ...record, ts: new Date().toISOString() }));
  } catch (_) {}
}

export async function getLastFatalError(): Promise<string | null> {
  try {
    return await AsyncStorage.getItem(LAST_FATAL_ERROR_KEY);
  } catch (_) {
    return null;
  }
}

export async function clearLastFatalError(): Promise<void> {
  try {
    await AsyncStorage.removeItem(LAST_FATAL_ERROR_KEY);
  } catch (_) {}
}

// Separate from persistFatalError: ErrorUtils.setGlobalHandler only fires for
// uncaught JS throws, never for console.error(...) calls. Those go through
// RCTExceptionsManager's native reporting path too (same GCD queue that
// showed up in the crash logs), so a malformed console.error argument can
// crash the bridge before ever becoming a JS "error" our trap would see.
function persistConsoleError(args: unknown[]) {
  try {
    const safeArgs = args.map((a) => {
      if (a instanceof Error) return { name: a.name, message: a.message, stack: a.stack };
      try {
        return JSON.parse(JSON.stringify(a));
      } catch {
        return String(a);
      }
    });
    // Fire-and-forget: console.error itself isn't the abort point (the
    // native report of it is), so there's no race to beat here like the
    // fatal-error case — this just needs to land before the process exits.
    void AsyncStorage.setItem(LAST_CONSOLE_ERROR_KEY, JSON.stringify({ args: safeArgs, ts: new Date().toISOString() }));
  } catch (_) {}
}

export async function getLastConsoleError(): Promise<string | null> {
  try {
    return await AsyncStorage.getItem(LAST_CONSOLE_ERROR_KEY);
  } catch (_) {
    return null;
  }
}

export async function clearLastConsoleError(): Promise<void> {
  try {
    await AsyncStorage.removeItem(LAST_CONSOLE_ERROR_KEY);
  } catch (_) {}
}

export function installConsoleErrorTrap() {
  const g = global as any;
  if (!g.console || typeof g.console.error !== 'function' || g.console.error.__remotectrlWrapped) return;
  const original = g.console.error.bind(g.console);
  const wrapped = (...args: unknown[]) => {
    persistConsoleError(args);
    // In dev, forward to the original so Metro/LogBox behave normally.
    // In production, DON'T: three separate TestFlight builds have shown the
    // exact same SIGABRT originating inside RCTExceptionsManager's native
    // bridge call (the thing console.error(...) forwards to here) — routing
    // through it is the crash, not a side effect of it. The record above is
    // the only copy of this error that matters in production.
    if (typeof __DEV__ !== 'undefined' && __DEV__) {
      original(...args);
    }
  };
  wrapped.__remotectrlWrapped = true;
  g.console.error = wrapped;
}

// Rig IP - phone can't hit "localhost" because that means the phone itself.
// The dev box IP is what the phone can reach. Override via env if needed.
const RIG_HOST_CANDIDATES = [
  '10.0.0.127',
  '192.168.1.1',
  '10.0.0.1',
  'localhost',
];
const getDebugBaseUrl = () => {
  const e: Record<string, string | undefined> = (typeof process !== 'undefined' && process?.env) || {};
  const fromEnv = e.EXPO_DEV_LOG_HOST || e.RIG_IP;
  if (fromEnv) return `http://${fromEnv}:8787/log`;
  return `http://${RIG_HOST_CANDIDATES[0]}:8787/log`;
};
const DEBUG_LOG_URL = getDebugBaseUrl();

function postLog(msg: string, data: unknown, hypothesisId: string | null, extra: unknown) {
  // Never phone home to hardcoded LAN IPs from a production build — this is
  // dev-only crash-bisection instrumentation, not a shipped feature.
  if (typeof __DEV__ !== 'undefined' && !__DEV__) return;
  try {
    const payload = JSON.stringify({
      sessionId: DEBUG_SESSION_ID,
      msg,
      data: data ?? {},
      hypothesisId: hypothesisId ?? null,
      extra: extra ?? null,
      loc: (new Error().stack || '').split('\n').slice(2, 4).join(' | '),
      ts: new Date().toISOString(),
    });
    if (typeof global !== 'undefined' && typeof global.fetch === 'function') {
      // Try primary URL. If the bundle was built with a stale IP, also try fallbacks.
      const candidates = [
        DEBUG_LOG_URL,
        ...RIG_HOST_CANDIDATES.filter(h => !DEBUG_LOG_URL.includes(h) && h !== 'localhost').map(h => `http://${h}:8787/log`),
      ];
      for (const u of candidates) {
        fetch(u, {
          method: 'POST',
          body: payload,
          headers: { 'content-type': 'application/json' },
        }).catch(() => {});
        break;
      }
    }
  } catch (_) {}
}

export const debugLog = (msg: string, data: unknown, hypothesisId: string | null) => {
  postLog(msg, data, hypothesisId, null);
};

interface ErrorUtilsType {
  setGlobalHandler: (handler: (e: Error, isFatal: boolean) => void) => void;
  getGlobalHandler: () => ((e: Error, isFatal: boolean) => void) | undefined;
}

export function installGlobalErrorTrap() {
  // Must run in every build, including production/TestFlight — this is the
  // only thing standing between an uncaught fatal JS error and a silent
  // abort() with zero diagnostics (see docs on the cold-start crash). Only
  // the LAN-IP network probe inside postLog() is __DEV__-gated, not this.

  // Capture JS errors before React tree mounts
  const ErrorUtils = (global as any).ErrorUtils as ErrorUtilsType | undefined;
  if (ErrorUtils && typeof ErrorUtils.setGlobalHandler === 'function') {
    const prev = ErrorUtils.getGlobalHandler?.();
    const isDev = typeof __DEV__ !== 'undefined' && __DEV__;
    ErrorUtils.setGlobalHandler((e: Error, isFatal: boolean) => {
      const record = { kind: 'GLOBAL_JS_ERROR', name: e?.name, message: e?.message, stack: e?.stack, isFatal: !!isFatal };
      postLog('GLOBAL_JS_ERROR', record, 'GLOBAL', { isFatal: !!isFatal });
      const proceed = () => {
        // In dev, always forward -- this is what shows the redbox.
        // In production, forward only non-fatal errors. Three separate
        // TestFlight builds crashed with an identical SIGABRT inside
        // RCTExceptionsManager's native bridge call, which is exactly what
        // `prev` invokes for a fatal error -- forwarding it is the crash.
        // Swallowing it here trades a hard abort() for the app staying up
        // with the real error already persisted above.
        if (typeof prev === 'function' && (isDev || !isFatal)) prev(e, isFatal);
      };
      if (isFatal) {
        persistFatalError(record).then(proceed, proceed);
      } else {
        proceed();
      }
    });
  }

  // Capture unhandled promise rejections - works on Hermes
  if (typeof global.addEventListener === 'function') {
    global.addEventListener('unhandledrejection', (e: any) => {
      const reason = e && (e.reason || e);
      const record = { kind: 'UNHANDLED_REJECTION', message: reason?.message, stack: reason?.stack };
      postLog('UNHANDLED_REJECTION', record, 'GLOBAL', { kind: typeof reason });
      void persistFatalError(record);
    });
  }
  postLog('TRAP_INSTALLED', { sessionId: DEBUG_SESSION_ID, url: DEBUG_LOG_URL }, 'BOOT', null);
}
// #endregion
