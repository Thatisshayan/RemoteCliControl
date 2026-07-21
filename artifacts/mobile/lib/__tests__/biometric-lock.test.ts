jest.mock("expo-local-authentication", () => ({
  hasHardwareAsync: jest.fn(),
  isEnrolledAsync: jest.fn(),
  authenticateAsync: jest.fn(),
}));

import * as LocalAuthentication from "expo-local-authentication";
import { authenticateWithBiometrics } from "../biometric-lock";

const mockedLocalAuthentication = LocalAuthentication as jest.Mocked<typeof LocalAuthentication>;

describe("authenticateWithBiometrics", () => {
  beforeEach(() => {
    jest.resetAllMocks();
  });

  it("unlocks only after a successful biometric prompt", async () => {
    mockedLocalAuthentication.hasHardwareAsync.mockResolvedValue(true);
    mockedLocalAuthentication.isEnrolledAsync.mockResolvedValue(true);
    mockedLocalAuthentication.authenticateAsync.mockResolvedValue({ success: true } as any);

    await expect(authenticateWithBiometrics()).resolves.toEqual({ success: true });
    expect(mockedLocalAuthentication.authenticateAsync).toHaveBeenCalledWith(expect.objectContaining({
      disableDeviceFallback: true,
      promptMessage: "Unlock RemoteCTRL",
    }));
  });

  it("keeps the app locked when biometric hardware is unavailable", async () => {
    mockedLocalAuthentication.hasHardwareAsync.mockResolvedValue(false);

    await expect(authenticateWithBiometrics()).resolves.toEqual(expect.objectContaining({ success: false }));
    expect(mockedLocalAuthentication.authenticateAsync).not.toHaveBeenCalled();
  });

  it("keeps the app locked when the user cancels or fails authentication", async () => {
    mockedLocalAuthentication.hasHardwareAsync.mockResolvedValue(true);
    mockedLocalAuthentication.isEnrolledAsync.mockResolvedValue(true);
    mockedLocalAuthentication.authenticateAsync.mockResolvedValue({ success: false } as any);

    await expect(authenticateWithBiometrics()).resolves.toEqual(expect.objectContaining({ success: false }));
  });

});
