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
import { debugLog, installGlobalErrorTrap } from "../lib/debug-logger";
import { RuntimeConfigProvider, useRuntimeConfig } from "../lib/runtime-config";
import { isAuthExpiredError, notifyAuthExpired } from "../lib/auth-expired";

let __sideEffectsDone = false;

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

async function bootstrapBackground() {
  if (__sideEffectsDone) return;
  __sideEffectsDone = true;
  debugLog("bootstrap_deferred_start", {}, "BOOT");
  try {
    debugLog("splash_preventAutoHide_try", {}, "BOOT");
    await SplashScreen.preventAutoHideAsync();
    debugLog("splash_preventAutoHide_OK", {}, "BOOT");
  } catch (e: any) {
    debugLog("splash_preventAutoHide_FAIL", { msg: e?.message, stack: e?.stack }, "BOOT");
  }
  debugLog("bootstrap_deferred_done", {}, "BOOT");
}

export default RootLayout;

function RootLayout() {
  debugLog("function_render_first_time_unconditional", {}, "BOOT");
  const [fontsLoaded] = useFonts({ Inter_400Regular, Inter_500Medium, Inter_600SemiBold, Inter_700Bold });

  useEffect(() => {
    debugLog("useEffect_post_fonts", { loaded: !!fontsLoaded }, "BOOT");
    if (fontsLoaded) {
      bootstrapBackground().catch((e) => debugLog("bootstrapBackground_FAIL", { msg: e?.message }, "BOOT"));
      SplashScreen.hideAsync().catch((e) => debugLog("SplashScreen_hide_FAIL", { msg: e?.message }, "BOOT"));
    }
  }, [fontsLoaded]);

  if (!fontsLoaded) return null;

  try {
    return (
      <GestureHandlerRootView style={{ flex: 1 }}>
        <SafeAreaProvider>
          <ErrorBoundary>
            <RuntimeConfigProvider>
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
                  </Stack>
                  <StatusBar style="light" />
                </QueryClientProvider>
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
