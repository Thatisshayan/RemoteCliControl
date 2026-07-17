import { useEffect } from "react";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { useFonts, Inter_400Regular, Inter_500Medium, Inter_600SemiBold, Inter_700Bold } from "@expo-google-fonts/inter";
import * as SplashScreen from "expo-splash-screen";
import ErrorBoundary from "../components/ErrorBoundary";
import { colors } from "../constants/colors";
import { debugLog, installGlobalErrorTrap } from "../lib/debug-logger";
import { RuntimeConfigProvider } from "../lib/runtime-config";

let __sideEffectsDone = false;

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

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
