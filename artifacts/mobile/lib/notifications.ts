import { Platform, Linking } from "react-native";
import * as Notifications from "expo-notifications";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { getBaseUrl } from "@remotectrl/api-client-react";

const PUSH_TOKEN_KEY = "expo-push-token";

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export async function registerForPushNotifications(): Promise<void> {
  const existing = await AsyncStorage.getItem(PUSH_TOKEN_KEY);
  if (existing) return;

  const existingPerms = await Notifications.getPermissionsAsync();
  const hasPermission = (existingPerms as any).granted || (existingPerms as any).status === "granted";

  if (!hasPermission) {
    const result = await Notifications.requestPermissionsAsync();
    const gotPermission = (result as any).granted || (result as any).status === "granted";
    if (!gotPermission) return;
  }

  const tokenData = await Notifications.getExpoPushTokenAsync();
  const pushToken = tokenData.data;
  const platform = Platform.OS === "ios" ? "ios" : "android";

  try {
    const baseUrl = getBaseUrl();
    const res = await fetch(`${baseUrl}/api/push/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pushToken, platform }),
    });
    if (res.ok) {
      await AsyncStorage.setItem(PUSH_TOKEN_KEY, pushToken);
    }
  } catch {
    // server offline, will retry on next launch
  }
}

export function setupNotificationHandler(): void {
  Notifications.addNotificationResponseReceivedListener((response) => {
    const data = response.notification.request.content.data;
    if (!data || !data.type) return;

    switch (data.type) {
      case "session":
        if (data.sessionId) {
          Linking.openURL(`remotectrl://session/${data.sessionId}`);
        }
        break;
      case "server":
        Linking.openURL("remotectrl://");
        break;
    }
  });
}
