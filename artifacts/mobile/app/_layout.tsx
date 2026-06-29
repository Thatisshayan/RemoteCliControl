import { useEffect } from "react";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { useFonts, Inter_400Regular, Inter_500Medium, Inter_600SemiBold, Inter_700Bold } from "@expo-google-fonts/inter";
import * as SplashScreen from "expo-splash-screen";
import { KeyboardProvider } from "react-native-keyboard-controller";
import AsyncStorage from "@react-native-async-storage/async-storage";
import ErrorBoundary from "../components/ErrorBoundary";
import { setBaseUrl, setApiToken } from "@remotectrl/api-client-react";
import { colors } from "../constants/colors";
import {
  registerForPushNotifications,
  installNotificationHandler,
  setupNotificationHandler,
} from "../lib/notifications";
import { debugLog, installGlobalErrorTrap } from "../lib/debug-logger";

// #region debug
let __sideEffectsDone = false;
try {
  debugLog("layout_module_loaded", { ts: Date.now() }, "BOOT");
  installGlobalErrorTrap();
} catch (_) { /* noop */ }
// #endregion

const domain = process.env.EXPO_PUBLIC_DOMAIN || "http://localhost:3000";
const baseUrl = domain.startsWith("http") ? domain : `http://${domain}`;
debugLog("init_setBaseUrl_sync", { baseUrl, env: process.env.EXPO_PUBLIC_DOMAIN }, "H5");
setBaseUrl(baseUrl);
if (process.env.EXPO_PUBLIC_API_TOKEN) {
  debugLog("init_setApiToken", { hasToken: true }, "H5");
  setApiToken(process.env.EXPO_PUBLIC_API_TOKEN);
}

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
  debugLog("bootstrap_deferred_start", {}, "H1");
  try {
    debugLog("splash_preventAutoHide_try", {}, "BOOT");
    await SplashScreen.preventAutoHideAsync();
    debugLog("splash_preventAutoHide_OK", {}, "BOOT");
  } catch (e: any) {
    debugLog("splash_preventAutoHide_FAIL", { msg: e?.message, stack: e?.stack }, "BOOT");
  }
  try {
    debugLog("installNotificationHandler_try", {}, "H1");
    await installNotificationHandler();
  } catch (e: any) {
    debugLog("installNotificationHandler_FAIL", { msg: e?.message }, "H1");
  }
  try {
    debugLog("setupNotificationHandler_try", {}, "H1");
    await setupNotificationHandler();
  } catch (e: any) {
    debugLog("setupNotificationHandler_FAIL", { msg: e?.message }, "H1");
  }
  try {
    const [savedUrl, savedToken] = await Promise.all([
      AsyncStorage.getItem("server-url"),
      AsyncStorage.getItem("api-token"),
    ]);
    debugLog("loadAsyncStorageOverrides_done", { savedUrl, hasToken: !!savedToken }, "H3");
    if (savedUrl) setBaseUrl(savedUrl);
    if (savedToken) setApiToken(savedToken);
  } catch (e: any) {
    debugLog("loadAsyncStorageOverrides_FAIL", { msg: e?.message }, "H3");
  }
  try {
    debugLog("registerForPushNotifications_try", {}, "H1+H2");
    await registerForPushNotifications();
    debugLog("registerForPushNotifications_OK", {}, "H1+H2");
  } catch (e: any) {
    debugLog("registerForPushNotifications_FAIL", { msg: e?.message, stack: e?.stack }, "H1+H2");
  }
  debugLog("bootstrap_deferred_done", {}, "H1");
}

export default function RootLayout() {
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
          <KeyboardProvider>
            <ErrorBoundary>
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
            </ErrorBoundary>
          </KeyboardProvider>
        </SafeAreaProvider>
      </GestureHandlerRootView>
    );
  } catch (e: any) {
    debugLog("render_FAIL", { msg: e?.message, stack: e?.stack }, "H4");
    throw e;
  }
}
