import AsyncStorage from "@react-native-async-storage/async-storage";
import * as LocalAuthentication from "expo-local-authentication";
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { AppState, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { colors } from "../constants/colors";

const BIOMETRIC_LOCK_KEY = "biometric-lock";

type BiometricLockContextValue = {
  biometricEnabled: boolean;
  biometricHydrated: boolean;
  setBiometricEnabled: (enabled: boolean) => Promise<void>;
};

type AuthenticationResult = { success: true } | { success: false; message: string };

const BiometricLockContext = createContext<BiometricLockContextValue | null>(null);

export async function authenticateWithBiometrics(): Promise<AuthenticationResult> {
  try {
    if (!(await LocalAuthentication.hasHardwareAsync())) {
      return { success: false, message: "Biometric authentication is not available on this device." };
    }
    if (!(await LocalAuthentication.isEnrolledAsync())) {
      return { success: false, message: "Set up Face ID, Touch ID, or fingerprint authentication to unlock RemoteCTRL." };
    }

    const result = await LocalAuthentication.authenticateAsync({
      promptMessage: "Unlock RemoteCTRL",
      cancelLabel: "Cancel",
      fallbackLabel: "",
      // A stored biometric-lock preference must not quietly downgrade to the
      // device passcode on platforms where Expo supports disabling fallback.
      disableDeviceFallback: true,
    });
    return result.success
      ? { success: true }
      : { success: false, message: "Authentication was not completed. Try again to unlock RemoteCTRL." };
  } catch {
    return { success: false, message: "Biometric authentication could not start. Try again to unlock RemoteCTRL." };
  }
}

export function BiometricLockProvider({ children }: { children: ReactNode }) {
  const [biometricEnabled, setBiometricEnabledState] = useState(false);
  const [biometricHydrated, setBiometricHydrated] = useState(false);

  useEffect(() => {
    let mounted = true;
    AsyncStorage.getItem(BIOMETRIC_LOCK_KEY)
      .then((value) => {
        if (mounted) setBiometricEnabledState(value === "true");
      })
      .finally(() => {
        if (mounted) setBiometricHydrated(true);
      });
    return () => {
      mounted = false;
    };
  }, []);

  const setBiometricEnabled = useCallback(async (enabled: boolean) => {
    setBiometricEnabledState(enabled);
    await AsyncStorage.setItem(BIOMETRIC_LOCK_KEY, enabled ? "true" : "false");
  }, []);

  return (
    <BiometricLockContext.Provider value={{ biometricEnabled, biometricHydrated, setBiometricEnabled }}>
      {children}
    </BiometricLockContext.Provider>
  );
}

export function useBiometricLock(): BiometricLockContextValue {
  const value = useContext(BiometricLockContext);
  if (!value) throw new Error("useBiometricLock must be used inside BiometricLockProvider");
  return value;
}

export function BiometricLockGate() {
  const { biometricEnabled, biometricHydrated } = useBiometricLock();
  const [locked, setLocked] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const authenticationInFlight = useRef(false);
  const appState = useRef(AppState.currentState);

  const unlock = useCallback(async () => {
    if (!biometricEnabled || authenticationInFlight.current) return;
    authenticationInFlight.current = true;
    setLocked(true);
    let result: AuthenticationResult;
    try {
      result = await authenticateWithBiometrics();
    } finally {
      authenticationInFlight.current = false;
    }
    if (result.success) {
      setMessage(null);
      setLocked(false);
    } else {
      setMessage(result.message);
    }
  }, [biometricEnabled]);

  useEffect(() => {
    if (!biometricHydrated) return;
    if (!biometricEnabled) {
      setLocked(false);
      setMessage(null);
      return;
    }
    void unlock();
  }, [biometricEnabled, biometricHydrated, unlock]);

  useEffect(() => {
    const subscription = AppState.addEventListener("change", (nextAppState) => {
      const wasActive = appState.current === "active";
      appState.current = nextAppState;
      if (!biometricEnabled) return;
      if (nextAppState === "inactive" || nextAppState === "background") {
        setLocked(true);
        return;
      }
      if (!wasActive && nextAppState === "active") void unlock();
    });
    return () => subscription.remove();
  }, [biometricEnabled, unlock]);

  if (!locked) return null;
  return (
    <View style={styles.overlay} accessibilityViewIsModal>
      <Text style={styles.title}>RemoteCTRL is locked</Text>
      <Text style={styles.message}>{message ?? "Authenticate to continue."}</Text>
      <TouchableOpacity style={styles.button} onPress={() => void unlock()} accessibilityRole="button">
        <Text style={styles.buttonText}>Unlock</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    backgroundColor: colors.background,
    justifyContent: "center",
    padding: 32,
    zIndex: 1000,
  },
  title: { color: colors.foreground, fontFamily: "Inter_700Bold", fontSize: 24, marginBottom: 12, textAlign: "center" },
  message: { color: colors.mutedForeground, fontFamily: "Inter_400Regular", fontSize: 15, lineHeight: 22, marginBottom: 24, textAlign: "center" },
  button: { backgroundColor: colors.primary, borderRadius: 8, paddingHorizontal: 28, paddingVertical: 14 },
  buttonText: { color: colors.primaryForeground, fontFamily: "Inter_700Bold", fontSize: 16 },
});
