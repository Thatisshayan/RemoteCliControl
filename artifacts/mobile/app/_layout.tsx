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

const domain = process.env.EXPO_PUBLIC_DOMAIN || "http://localhost:3000";
const baseUrl = domain.startsWith("http") ? domain : `http://${domain}`;
setBaseUrl(baseUrl);
if (process.env.EXPO_PUBLIC_API_TOKEN) {
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

SplashScreen.preventAutoHideAsync();

async function loadAsyncStorageOverrides() {
  const [savedUrl, savedToken] = await Promise.all([
    AsyncStorage.getItem("server-url"),
    AsyncStorage.getItem("api-token"),
  ]);
  if (savedUrl) setBaseUrl(savedUrl);
  if (savedToken) setApiToken(savedToken);
}

loadAsyncStorageOverrides();

export default function RootLayout() {
  const [fontsLoaded] = useFonts({ Inter_400Regular, Inter_500Medium, Inter_600SemiBold, Inter_700Bold });

  useEffect(() => {
    if (fontsLoaded) SplashScreen.hideAsync();
  }, [fontsLoaded]);

  if (!fontsLoaded) return null;

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
}
