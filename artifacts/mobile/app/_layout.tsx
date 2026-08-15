import { useEffect } from "react";
import { Stack, useRouter, useSegments } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { QueryClient, QueryClientProvider, QueryCache, MutationCache } from "@tanstack/react-query";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { useFonts, Inter_400Regular, Inter_500Medium, Inter_600SemiBold, Inter_700Bold } from "@expo-google-fonts/inter";
import * as SplashScreen from "expo-splash-screen";
import ErrorBoundary from "../components/ErrorBoundary";
import { colors } from "../constants/colors";
import { debugLog } from "../lib/debug-logger";
import { RuntimeConfigProvider, useRuntimeConfig } from "../lib/runtime-config";
import { isAuthExpiredError, notifyAuthExpired } from "../lib/auth-expired";
import { BiometricLockGate, BiometricLockProvider } from "../lib/biometric-lock";

// This must run at module scope. Calling it from an effect is too late: the
// native splash can already be gone while the root still returns `null` for
// font loading, leaving a release build on an empty screen.
// This native call can reject when iOS has already completed (or failed to
// initialize) the splash lifecycle. It is an optional visual optimization,
// never a reason to abort the JavaScript bridge before the app can render.
void SplashScreen.preventAutoHideAsync().catch(() => undefined);

// Any authenticated request (react-query query or mutation) that comes back
// AUTH_REQUIRED/AUTH_INVALID means the saved token is no longer good — this
// is the one place that's true for every screen, so it's the one place that
// needs to know about it, rather than every hook checking for it itself.
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
  queryCache: new QueryCache({
    onError: (error) => {
      if (isAuthExpiredError(error)) notifyAuthExpired();
    },
  }),
  mutationCache: new MutationCache({
    onError: (error) => {
      if (isAuthExpiredError(error)) notifyAuthExpired();
    },
  }),
});

// Bounces the user to Settings — the one screen that can fix a rejected
// token — instead of leaving them stuck on a terminal/files/etc. screen
// silently re-failing every request.
function AuthExpiredRedirect() {
  const { authExpired, hydrated, onboardingComplete } = useRuntimeConfig();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (!hydrated || !onboardingComplete || !authExpired) return;
    if (segments[segments.length - 1] === "settings") return;
    router.replace("/(tabs)/settings");
  }, [authExpired, hydrated, onboardingComplete, segments, router]);

  return null;
}

export default RootLayout;

function RootLayout() {
  debugLog("function_render_first_time_unconditional", {}, "BOOT");
  const [fontsLoaded, fontError] = useFonts({ Inter_400Regular, Inter_500Medium, Inter_600SemiBold, Inter_700Bold });

  useEffect(() => {
    debugLog("useEffect_post_fonts", { loaded: !!fontsLoaded, failed: !!fontError }, "BOOT");
    if (fontsLoaded || fontError) {
      SplashScreen.hideAsync().catch((e) => debugLog("SplashScreen_hide_FAIL", { msg: e?.message }, "BOOT"));
    }
  }, [fontError, fontsLoaded]);

  // A font failure must still show the app using system fallbacks; otherwise
  // TestFlight users see a permanent blank screen with no recovery path.
  if (!fontsLoaded && !fontError) return null;

  try {
    return (
      <GestureHandlerRootView style={{ flex: 1 }}>
        <SafeAreaProvider>
          <ErrorBoundary>
            <RuntimeConfigProvider>
              <BiometricLockProvider>
                <QueryClientProvider client={queryClient}>
                  <AuthExpiredRedirect />
                  <Stack
                    screenOptions={{
                      headerShown: false,
                      contentStyle: { backgroundColor: colors.background },
                    }}
                  >
                    <Stack.Screen name="onboarding" />
                    <Stack.Screen name="(tabs)" />
                    <Stack.Screen name="session/[sessionId]" options={{ presentation: "fullScreenModal" }} />
                    <Stack.Screen name="connection" options={{ presentation: "modal" }} />
                    <Stack.Screen name="diagnostics" options={{ presentation: "modal" }} />
                  </Stack>
                  <StatusBar style="light" />
                </QueryClientProvider>
                <BiometricLockGate />
              </BiometricLockProvider>
            </RuntimeConfigProvider>
            </ErrorBoundary>
          </SafeAreaProvider>
        </GestureHandlerRootView>
    );
  } catch (e: any) {
    debugLog("render_FAIL", { msg: e?.message, stack: e?.stack }, "H4");
    throw e;
  }
}
