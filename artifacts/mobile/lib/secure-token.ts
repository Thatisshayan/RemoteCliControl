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
    await SecureStore.setItemAsync(KEY, legacyValue);
    await AsyncStorage.removeItem(KEY);
    return legacyValue;
  }
  return null;
}

export async function setStoredApiToken(token: string): Promise<void> {
  await SecureStore.setItemAsync(KEY, token);
}
