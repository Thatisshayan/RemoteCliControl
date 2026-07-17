import AsyncStorage from "@react-native-async-storage/async-storage";
import { act, renderHook, waitFor } from "@testing-library/react-native";
import * as SecureStore from "expo-secure-store";
import { getBaseUrl, setApiToken, setBaseUrl } from "@remotectrl/api-client-react";
import { RuntimeConfigProvider, useRuntimeConfig } from "../runtime-config";

// The shared HTTP client (`@remotectrl/api-client-react`) is what terminal,
// files, and every other feature actually read the base URL/token from at
// request time — so "live backend URL switching" means this client's
// setBaseUrl/setApiToken were really called, not just that local component
// state changed. Mocked here so we can assert on those calls directly.
//
// State lives inside the factory closures (not an outer variable) because
// jest.mock() factories are hoisted above the rest of this file and may not
// reference out-of-scope variables — they're reset via the mocked module's
// own setBaseUrl/setApiToken calls in beforeEach instead.
jest.mock("@remotectrl/api-client-react", () => {
  let baseUrl = "http://localhost:3000";
  let apiToken: string | undefined;
  return {
    getBaseUrl: jest.fn(() => baseUrl),
    setBaseUrl: jest.fn((url: string) => {
      baseUrl = url;
    }),
    getApiToken: jest.fn(() => apiToken),
    setApiToken: jest.fn((token?: string) => {
      apiToken = token;
    }),
    publicApi: { get: jest.fn() },
  };
});

jest.mock("expo-secure-store", () => {
  const store = new Map<string, string>();
  return {
    getItemAsync: jest.fn(async (key: string) => store.get(key) ?? null),
    setItemAsync: jest.fn(async (key: string, value: string) => {
      store.set(key, value);
    }),
    deleteItemAsync: jest.fn(async (key: string) => {
      store.delete(key);
    }),
  };
});

function wrapper({ children }: { children: React.ReactNode }) {
  return <RuntimeConfigProvider>{children}</RuntimeConfigProvider>;
}

beforeEach(async () => {
  jest.clearAllMocks();
  await AsyncStorage.clear();
  await SecureStore.deleteItemAsync("api-token");
  setBaseUrl("http://localhost:3000");
  setApiToken(undefined);
});

describe("runtime config hydration", () => {
  it("hydrates to the shared client's base URL when nothing is saved yet", async () => {
    const { result } = renderHook(() => useRuntimeConfig(), { wrapper });

    await waitFor(() => expect(result.current.hydrated).toBe(true));

    expect(result.current.baseUrl).toBe("http://localhost:3000");
    expect(result.current.apiToken).toBe("");
    expect(result.current.onboardingComplete).toBe(false);
  });

  it("hydrates saved base URL, token, and onboarding state, and repoints the shared client", async () => {
    await AsyncStorage.setItem("server-url", "https://saved-host.example");
    await AsyncStorage.setItem("onboardingComplete", "true");
    await SecureStore.setItemAsync("api-token", "saved-token");

    const { result } = renderHook(() => useRuntimeConfig(), { wrapper });

    await waitFor(() => expect(result.current.hydrated).toBe(true));

    expect(result.current.baseUrl).toBe("https://saved-host.example");
    expect(result.current.apiToken).toBe("saved-token");
    expect(result.current.onboardingComplete).toBe(true);
    // Hydration must repoint the actual shared client, not just local state —
    // every feature (terminal, files, sessions) reads from that client.
    expect(setBaseUrl).toHaveBeenCalledWith("https://saved-host.example");
    expect(setApiToken).toHaveBeenCalledWith("saved-token");
  });

  it("strips a trailing slash from a saved base URL during hydration", async () => {
    await AsyncStorage.setItem("server-url", "https://saved-host.example/");

    const { result } = renderHook(() => useRuntimeConfig(), { wrapper });

    await waitFor(() => expect(result.current.hydrated).toBe(true));
    expect(result.current.baseUrl).toBe("https://saved-host.example");
  });

  it("still finishes hydrating (rather than hanging) if storage reads fail", async () => {
    jest.spyOn(AsyncStorage, "getItem").mockRejectedValueOnce(new Error("storage unavailable"));

    const { result } = renderHook(() => useRuntimeConfig(), { wrapper });

    await waitFor(() => expect(result.current.hydrated).toBe(true));
  });
});

describe("live backend URL switching", () => {
  it("saveBaseUrl persists the new URL, updates local state, and repoints the shared client", async () => {
    const { result } = renderHook(() => useRuntimeConfig(), { wrapper });
    await waitFor(() => expect(result.current.hydrated).toBe(true));

    await act(async () => {
      await result.current.saveBaseUrl("https://new-host.example/");
    });

    expect(result.current.baseUrl).toBe("https://new-host.example");
    expect(setBaseUrl).toHaveBeenCalledWith("https://new-host.example");
    await expect(AsyncStorage.getItem("server-url")).resolves.toBe("https://new-host.example");
  });

  it("a later saveBaseUrl call switches away from an earlier one cleanly", async () => {
    const { result } = renderHook(() => useRuntimeConfig(), { wrapper });
    await waitFor(() => expect(result.current.hydrated).toBe(true));

    await act(async () => {
      await result.current.saveBaseUrl("https://host-a.example");
    });
    await act(async () => {
      await result.current.saveBaseUrl("https://host-b.example");
    });

    expect(result.current.baseUrl).toBe("https://host-b.example");
    expect(getBaseUrl()).toBe("https://host-b.example");
    await expect(AsyncStorage.getItem("server-url")).resolves.toBe("https://host-b.example");
  });

  it("saveApiToken stores a non-empty token in secure storage and updates the shared client", async () => {
    const { result } = renderHook(() => useRuntimeConfig(), { wrapper });
    await waitFor(() => expect(result.current.hydrated).toBe(true));

    await act(async () => {
      await result.current.saveApiToken("  new-token  ");
    });

    expect(result.current.apiToken).toBe("new-token");
    expect(setApiToken).toHaveBeenCalledWith("new-token");
    await expect(SecureStore.getItemAsync("api-token")).resolves.toBe("new-token");
  });

  it("saveApiToken with an empty value clears secure storage and the shared client", async () => {
    const { result } = renderHook(() => useRuntimeConfig(), { wrapper });
    await waitFor(() => expect(result.current.hydrated).toBe(true));

    await act(async () => {
      await result.current.saveApiToken("some-token");
    });
    await act(async () => {
      await result.current.saveApiToken("   ");
    });

    expect(result.current.apiToken).toBe("");
    expect(setApiToken).toHaveBeenCalledWith(undefined);
    await expect(SecureStore.getItemAsync("api-token")).resolves.toBeNull();
  });

  it("clearLocalState resets the shared client back to the pre-onboarding base URL", async () => {
    const { result } = renderHook(() => useRuntimeConfig(), { wrapper });
    await waitFor(() => expect(result.current.hydrated).toBe(true));

    await act(async () => {
      await result.current.saveBaseUrl("https://was-configured.example");
      await result.current.saveApiToken("some-token");
      await result.current.markOnboardingComplete();
    });
    expect(result.current.onboardingComplete).toBe(true);

    await act(async () => {
      await result.current.clearLocalState();
    });

    expect(result.current.baseUrl).toBe("http://localhost:3000");
    expect(result.current.apiToken).toBe("");
    expect(result.current.onboardingComplete).toBe(false);
    expect(setBaseUrl).toHaveBeenCalledWith("http://localhost:3000");
    expect(setApiToken).toHaveBeenCalledWith(undefined);
    await expect(SecureStore.getItemAsync("api-token")).resolves.toBeNull();
  });
});
