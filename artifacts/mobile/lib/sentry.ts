import * as Sentry from "@sentry/react-native";

// Without this, the only crash visibility the team has is the LAN-only
// debug-logger, which is useless once a build leaves the dev network (i.e.
// every TestFlight/App Store install). This is what actually surfaces the
// native-layer cold-start crash stack traces from real devices.
const DSN = process.env.EXPO_PUBLIC_SENTRY_DSN;

export function initSentry() {
  if (!DSN) return;
  Sentry.init({
    dsn: DSN,
    // Cold-start crash is native-layer; capture it before the JS bundle
    // fully settles, not just render-phase React errors.
    enableNativeCrashHandling: true,
    tracesSampleRate: 0.2,
  });
}

export { Sentry };
