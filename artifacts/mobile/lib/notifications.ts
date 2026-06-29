import { Platform, Linking } from "react-native";
import * as Notifications from "expo-notifications";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { getBaseUrl } from "@remotectrl/api-client-react";

const PUSH_TOKEN_KEY = "expo-push-token";

// #region debug
const DEBUG_SESSION_ID = "remotectrl-cold-start-crash-2b0a26";
function postLog(msg, data, hypothesisId, extra) {
  try {
    const payload = JSON.stringify({
      sessionId: DEBUG_SESSION_ID,
      msg, data: data ?? {}, hypothesisId: hypothesisId ?? null,
      extra: extra ?? null, ts: new Date().toISOString(),
    });
    fetch("http://localhost:8787/log", {
      method: "POST", body: payload, headers: { "content-type": "application/json" },
    }).catch(() => {});
  } catch (_) {}
}
// #endregion

postLog("notifications_module_top", {}, "H1");
try {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
      shouldShowBanner: true,
      shouldShowList: true,
    }),
  });
  postLog("setNotificationHandler_OK", {}, "H1");
} catch (e) {
  postLog("setNotificationHandler_FAIL", { msg: e?.message, stack: e?.stack }, "H1");
}

export async function registerForPushNotifications(): Promise<void> {
  postLog("registerForPushNotifications_enter", {}, "H1+H2");
  try {
    const existing = await AsyncStorage.getItem(PUSH_TOKEN_KEY);
    postLog("registerForPushNotifications_existing", { hasExisting: !!existing }, "H2");
    if (existing) return;

    const existingPerms = await Notifications.getPermissionsAsync();
    const hasPermission = (existingPerms as any).granted || (existingPerms as any).status === "granted";
    postLog("registerForPushPermissions_current", { hasPermission }, "H2");

    if (!hasPermission) {
      const result = await Notifications.requestPermissionsAsync();
      const gotPermission = (result as any).granted || (result as any).status === "granted";
      postLog("registerForPushPermissions_after_request", { gotPermission }, "H2");
      if (!gotPermission) return;
    }

    const tokenData = await Notifications.getExpoPushTokenAsync();
    const pushToken = tokenData.data;
    const platform = Platform.OS === "ios" ? "ios" : "android";
    postLog("registerForPush_obtained_token", { platform }, "H2");

    try {
      const baseUrl = getBaseUrl();
      postLog("registerForPush_fetch_start", { baseUrl }, "H2");
      const res = await fetch(`${baseUrl}/api/push/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pushToken, platform }),
      });
      postLog("registerForPush_fetch_done", { status: res.status, ok: res.ok }, "H2");
      if (res.ok) {
        await AsyncStorage.setItem(PUSH_TOKEN_KEY, pushToken);
      }
    } catch (e: any) {
      postLog("registerForPush_fetch_FAIL", { msg: e?.message }, "H2");
    }
  } catch (e: any) {
    postLog("registerForPushNotifications_FAIL", { msg: e?.message, stack: e?.stack }, "H1+H2");
  }
}

export function setupNotificationHandler(): void {
  postLog("setupNotificationHandler_enter", {}, "H1");
  try {
    Notifications.addNotificationResponseReceivedListener((response) => {
      const data = response.notification.request.content.data;
      if (!data || !data.type) return;
      postLog("notif_received", { type: data.type }, "H1");

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
    postLog("setupNotificationHandler_OK", {}, "H1");
  } catch (e: any) {
    postLog("setupNotificationHandler_FAIL", { msg: e?.message, stack: e?.stack }, "H1");
  }
}
