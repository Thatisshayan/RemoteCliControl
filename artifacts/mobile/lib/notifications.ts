// Notifications disabled in v1.0.4 to isolate suspected Expo-notifications crash.
// Push notifications will be re-added in a future build once a defensive wrapper is in AppDelegate.
export async function registerForPushNotifications(): Promise<void> { /* noop */ }
export async function installNotificationHandler(): Promise<void> { /* noop */ }
export async function setupNotificationHandler(): Promise<void> { /* noop */ }
