import AsyncStorage from "@react-native-async-storage/async-storage";
import { createContext, useContext, useEffect, useMemo, useState } from "react";
import {
  getApiToken,
  getBaseUrl,
  publicApi,
  setApiToken,
  setBaseUrl,
} from "@remotectrl/api-client-react";
import { getStoredApiToken, setStoredApiToken, clearStoredApiToken } from "./secure-token";
import { onAuthExpired } from "./auth-expired";

const SERVER_URL_KEY = "server-url";
const ONBOARDING_COMPLETE_KEY = "onboardingComplete";
const envBaseUrl =
  typeof process !== "undefined" && typeof process.env?.EXPO_PUBLIC_DOMAIN === "string"
    ? process.env.EXPO_PUBLIC_DOMAIN
    : undefined;
const fallbackBaseUrl = envBaseUrl
  ? (envBaseUrl.startsWith("http") ? envBaseUrl : `http://${envBaseUrl}`).replace(/\/$/, "")
  : getBaseUrl();

type RuntimeConfigContextValue = {
  baseUrl: string;
  apiToken: string;
  hydrated: boolean;
  onboardingComplete: boolean;
  authExpired: boolean;
  saveBaseUrl: (url: string) => Promise<void>;
  saveApiToken: (token: string) => Promise<void>;
  markOnboardingComplete: () => Promise<void>;
  clearLocalState: () => Promise<void>;
  dismissAuthExpired: () => void;
};

const RuntimeConfigContext = createContext<RuntimeConfigContextValue | null>(null);

export function RuntimeConfigProvider({ children }: { children: React.ReactNode }) {
  const [baseUrl, setBaseUrlState] = useState<string>(fallbackBaseUrl);
  const [apiTokenState, setApiTokenState] = useState<string>(getApiToken() || "");
  const [hydrated, setHydrated] = useState(false);
  const [onboardingComplete, setOnboardingComplete] = useState(false);
  const [authExpired, setAuthExpired] = useState(false);

  useEffect(() => onAuthExpired(() => setAuthExpired(true)), []);

  useEffect(() => {
    let active = true;
    (async () => {
      const [savedUrl, savedToken, onboardingValue] = await Promise.all([
        AsyncStorage.getItem(SERVER_URL_KEY),
        getStoredApiToken(),
        AsyncStorage.getItem(ONBOARDING_COMPLETE_KEY),
      ]);
      if (!active) return;
      const normalizedBaseUrl = (savedUrl || fallbackBaseUrl).replace(/\/+$/, "");
      setBaseUrl(normalizedBaseUrl);
      setApiToken(savedToken || undefined);
      setBaseUrlState(normalizedBaseUrl);
      setApiTokenState(savedToken || "");
      setOnboardingComplete(onboardingValue === "true");
      setHydrated(true);
    })().catch(() => {
      if (!active) return;
      setHydrated(true);
    });
    return () => {
      active = false;
    };
  }, []);

  const value = useMemo<RuntimeConfigContextValue>(
    () => ({
      baseUrl,
      apiToken: apiTokenState,
      hydrated,
      onboardingComplete,
      authExpired,
      async saveBaseUrl(url: string) {
        const normalized = url.replace(/\/+$/, "");
        await AsyncStorage.setItem(SERVER_URL_KEY, normalized);
        setBaseUrl(normalized);
        setBaseUrlState(normalized);
      },
      async saveApiToken(token: string) {
        const normalized = token.trim();
        if (normalized) {
          await setStoredApiToken(normalized);
        } else {
          await clearStoredApiToken();
        }
        setApiToken(normalized || undefined);
        setApiTokenState(normalized);
        // Optimistically clear — if this token is still rejected, the next
        // authenticated request re-fires onAuthExpired since it's a live
        // subscription, not a one-shot flag.
        setAuthExpired(false);
      },
      async markOnboardingComplete() {
        await AsyncStorage.setItem(ONBOARDING_COMPLETE_KEY, "true");
        setOnboardingComplete(true);
      },
      async clearLocalState() {
        await AsyncStorage.clear();
        await clearStoredApiToken();
        setBaseUrl(fallbackBaseUrl);
        setApiToken(undefined);
        setBaseUrlState(fallbackBaseUrl);
        setApiTokenState("");
        setOnboardingComplete(false);
        setAuthExpired(false);
      },
      dismissAuthExpired() {
        setAuthExpired(false);
      },
    }),
    [apiTokenState, authExpired, baseUrl, hydrated, onboardingComplete],
  );

  return <RuntimeConfigContext.Provider value={value}>{children}</RuntimeConfigContext.Provider>;
}

export function useRuntimeConfig() {
  const value = useContext(RuntimeConfigContext);
  if (!value) {
    throw new Error("RuntimeConfigProvider is missing");
  }
  return value;
}
