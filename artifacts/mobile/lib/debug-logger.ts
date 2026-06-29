// #region debug — runtime log capture for TestFlight crash debugging
const DEBUG_SESSION_ID = 'remotectrl-cold-start-crash-2b0a26';

// Rig IP - phone can't hit "localhost" because that means the phone itself.
// The dev box IP is what the phone can reach. Override via env if needed.
const RIG_HOST_CANDIDATES = [
  '10.0.0.127',
  '192.168.1.1',
  '10.0.0.1',
  'localhost',
];
const getDebugBaseUrl = () => {
  const e = (typeof process !== 'undefined' && process?.env) || {};
  const fromEnv = e.EXPO_DEV_LOG_HOST || e.RIG_IP;
  if (fromEnv) return `http://${fromEnv}:8787/log`;
  return `http://${RIG_HOST_CANDIDATES[0]}:8787/log`;
};
const DEBUG_LOG_URL = getDebugBaseUrl();

function postLog(msg, data, hypothesisId, extra) {
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
    if (typeof global !== 'undefined' && global.fetch) {
      // Try primary URL. If the bundle was built with a stale IP, also try fallbacks.
      const candidates = [
        DEBUG_LOG_URL,
        `http://10.0.0.127:8787/log`,
        `http://192.168.1.1:8787/log`,
        `http://10.0.0.1:8787/log`,
      ];
      for (const u of candidates) {
        fetch(u, {
          method: 'POST',
          body: payload,
          headers: { 'content-type': 'application/json' },
        }).catch(() => {});
      }
    }
  } catch (_) {}
}

export const debugLog = (msg, data, hypothesisId) => {
  postLog(msg, data, hypothesisId, null);
};

export function installGlobalErrorTrap() {
  // Capture JS errors before React tree mounts
  const ErrorUtils = global.ErrorUtils;
  if (ErrorUtils && typeof ErrorUtils.setGlobalHandler === 'function') {
    const prev = ErrorUtils.getGlobalHandler && ErrorUtils.getGlobalHandler();
    ErrorUtils.setGlobalHandler((e, isFatal) => {
      postLog('GLOBAL_JS_ERROR', { name: e?.name, message: e?.message, stack: e?.stack }, 'GLOBAL', { isFatal: !!isFatal });
      if (typeof prev === 'function') prev(e, isFatal);
    });
  }

  // Capture unhandled promise rejections - works on Hermes
  if (typeof global.addEventListener === 'function') {
    global.addEventListener('unhandledrejection', (e) => {
      const reason = e && (e.reason || e);
      postLog('UNHANDLED_REJECTION', { message: reason?.message, stack: reason?.stack }, 'GLOBAL', { kind: typeof reason });
    });
  }
  postLog('TRAP_INSTALLED', { sessionId: DEBUG_SESSION_ID, url: DEBUG_LOG_URL }, 'BOOT', null);
}
// #endregion
