import AsyncStorage from "@react-native-async-storage/async-storage";
import * as SecureStore from "expo-secure-store";

// The API token grants full remote control of the paired PC (SSH, files,
// processes), so it lives in the iOS Keychain / Android Keystore via
// expo-secure-store rather than AsyncStorage's unencrypted storage.
const KEY = "api-token";

export async function getStoredApiToken(): Promise<string | null> {
  const secureValue = await SecureStore.getItemAsync(KEY);
  if (secureValue) return secureValue;

  // One-time migration: an earlier build stored the token in AsyncStorage.
  const legacyValue = await AsyncStorage.getItem(KEY);
  if (legacyValue) {
    // Immediately remove legacy value to prevent exposure during migration
    await AsyncStorage.removeItem(KEY);
    // Copy to secure storage with error handling
    try {
      await SecureStore.setItemAsync(KEY, legacyValue);
      return legacyValue;
    } catch (err) {
      console.error("Failed to migrate token to secure store:", err);
      // Do not return the legacy value if migration fails
      return null;
    }
  }
  return null;
}

export async function setStoredApiToken(token: string): Promise<void> {
  await SecureStore.setItemAsync(KEY, token);
}
