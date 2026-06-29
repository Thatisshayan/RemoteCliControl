import { useEffect } from "react";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Alert } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { useFonts, Inter_400Regular, Inter_500Medium, Inter_600SemiBold, Inter_700Bold } from "@expo-google-fonts/inter";
import * as SplashScreen from "expo-splash-screen";
import { KeyboardProvider } from "react-native-keyboard-controller";
import AsyncStorage from "@react-native-async-storage/async-storage";
import ErrorBoundary from "../components/ErrorBoundary";
import { setBaseUrl, setApiToken } from "@remotectrl/api-client-react";
import { colors } from "../constants/colors";
import { registerForPushNotifications, setupNotificationHandler } from "../lib/notifications";
import { debugLog, installGlobalErrorTrap } from "../lib/debug-logger";

// #region debug
let __layoutEntered = false;
try { debugLog("layout_module_loaded", { ts: Date.now() }, "BOOT"); installGlobalErrorTrap(); } catch (e) { /* noop */ }
// #endregion

const domain = process.env.EXPO_PUBLIC_DOMAIN || "http://localhost:3000";
const baseUrl = domain.startsWith("http") ? domain : `http://${domain}`;
debugLog("init_setBaseUrl", { baseUrl, env: process.env.EXPO_PUBLIC_DOMAIN }, "H5");
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

debugLog("queryClient_created", {}, "BOOT");

try {
  debugLog("splash_preventAutoHide_start", {}, "BOOT");
  SplashScreen.preventAutoHideAsync();
  debugLog("splash_preventAutoHide_done", {}, "BOOT");
} catch (e) {
  debugLog("splash_preventAutoHide_FAIL", { msg: e?.message, stack: e?.stack }, "BOOT");
}

async function loadAsyncStorageOverrides() {
  debugLog("loadAsyncStorageOverrides_start", {}, "H3");
  try {
    const [savedUrl, savedToken] = await Promise.all([
      AsyncStorage.getItem("server-url"),
      AsyncStorage.getItem("api-token"),
    ]);
    debugLog("loadAsyncStorageOverrides_done", { savedUrl, savedToken }, "H3");
    if (savedUrl) setBaseUrl(savedUrl);
    if (savedToken) setApiToken(savedToken);
  } catch (e) {
    debugLog("loadAsyncStorageOverrides_FAIL", { msg: e?.message }, "H3");
  }
}

debugLog("fire_loadAsyncStorageOverrides", {}, "H3");
loadAsyncStorageOverrides();

debugLog("fire_registerForPushNotifications", {}, "H1+H2");
registerForPushNotifications()
  .then(() => debugLog("registerForPushNotifications_OK", {}, "H1+H2"))
  .catch((e) => debugLog("registerForPushNotifications_FAIL", { msg: e?.message, stack: e?.stack }, "H1+H2"));
debugLog("call_setupNotificationHandler", {}, "H1");
try {
  setupNotificationHandler();
  debugLog("setupNotificationHandler_OK", {}, "H1");
} catch (e) {
  debugLog("setupNotificationHandler_FAIL", { msg: e?.message, stack: e?.stack }, "H1");
}

export default function RootLayout() {
  if (!__layoutEntered) { __layoutEntered = true; debugLog("function_render_first_time", {}, "BOOT"); }
  const [fontsLoaded] = useFonts({ Inter_400Regular, Inter_500Medium, Inter_600SemiBold, Inter_700Bold });

  useEffect(() => {
    debugLog("useEffect_fonts", { loaded: !!fontsLoaded }, "BOOT");
    if (fontsLoaded) SplashScreen.hideAsync();
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
  } catch (e) {
    debugLog("render_FAIL", { msg: e?.message, stack: e?.stack }, "H4");
    throw e;
  }
}
