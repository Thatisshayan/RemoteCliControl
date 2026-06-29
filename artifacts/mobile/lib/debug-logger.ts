// #region debug
const DEBUG_SESSION_ID = 'remotectrl-cold-start-crash-2b0a26';
const DEBUG_LOG_URL = 'http://localhost:8787/log';
// Match any dev machine IP your phone can reach. Best is the rig IP.

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
      fetch(DEBUG_LOG_URL, { method: 'POST', body: payload, headers: { 'content-type': 'application/json' } }).catch(() => {});
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

  // Capture unhandled promise rejections
  if (typeof global.HermesInternal === 'undefined' && typeof global.addEventListener === 'function') {
    global.addEventListener('unhandledrejection', (e) => {
      const reason = e && (e.reason || e);
      postLog('UNHANDLED_REJECTION', { message: reason?.message, stack: reason?.stack }, 'GLOBAL', { kind: typeof reason });
    });
  }
  postLog('TRAP_INSTALLED', { sessionId: DEBUG_SESSION_ID }, 'BOOT', null);
}
// #endregion
