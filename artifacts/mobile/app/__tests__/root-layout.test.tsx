import React from "react";
import { render } from "@testing-library/react-native";

const mockUseFonts = jest.fn();
jest.mock("expo-splash-screen", () => ({
  preventAutoHideAsync: jest.fn().mockResolvedValue(undefined),
  hideAsync: jest.fn(),
}));

jest.mock("@expo-google-fonts/inter", () => ({
  useFonts: (...args: unknown[]) => mockUseFonts(...args),
  Inter_400Regular: "Inter_400Regular",
  Inter_500Medium: "Inter_500Medium",
  Inter_600SemiBold: "Inter_600SemiBold",
  Inter_700Bold: "Inter_700Bold",
}));

jest.mock("expo-router", () => {
  const React = require("react");
  const { View } = require("react-native");
  const Stack = ({ children }: { children: React.ReactNode }) => React.createElement(View, { testID: "root-stack" }, children);
  Stack.Screen = () => null;
  return {
    Stack,
    useRouter: () => ({ replace: jest.fn() }),
    useSegments: () => [],
  };
});

jest.mock("expo-status-bar", () => ({ StatusBar: () => null }));
jest.mock("react-native-gesture-handler", () => ({ GestureHandlerRootView: ({ children }: { children: React.ReactNode }) => children }));
jest.mock("react-native-safe-area-context", () => ({ SafeAreaProvider: ({ children }: { children: React.ReactNode }) => children }));
jest.mock("../../components/ErrorBoundary", () => ({ children }: { children: React.ReactNode }) => children);
jest.mock("../../lib/debug-logger", () => ({ debugLog: jest.fn() }));
jest.mock("../../lib/runtime-config", () => ({
  RuntimeConfigProvider: ({ children }: { children: React.ReactNode }) => children,
  useRuntimeConfig: () => ({ authExpired: false, hydrated: true, onboardingComplete: false }),
}));
jest.mock("../../lib/biometric-lock", () => ({
  BiometricLockProvider: ({ children }: { children: React.ReactNode }) => children,
  BiometricLockGate: () => null,
}));

import RootLayout from "../_layout";
import * as SplashScreen from "expo-splash-screen";

const mockedSplashScreen = SplashScreen as jest.Mocked<typeof SplashScreen>;

describe("RootLayout startup", () => {
  beforeEach(() => {
    mockUseFonts.mockReset();
    mockedSplashScreen.hideAsync.mockReset().mockResolvedValue(undefined);
  });

  it("prevents splash auto-hide before the React tree mounts", () => {
    expect(mockedSplashScreen.preventAutoHideAsync).toHaveBeenCalledTimes(1);
  });

  it("hides the splash after fonts load", () => {
    mockUseFonts.mockReturnValue([true, undefined]);
    render(<RootLayout />);

    expect(mockedSplashScreen.hideAsync).toHaveBeenCalledTimes(1);
  });

  it("renders with system font fallbacks and hides the splash when font loading fails", () => {
    mockUseFonts.mockReturnValue([false, new Error("font unavailable")]);
    const screen = render(<RootLayout />);

    expect(screen.getByTestId("root-stack")).toBeTruthy();
    expect(mockedSplashScreen.hideAsync).toHaveBeenCalledTimes(1);
  });
});
