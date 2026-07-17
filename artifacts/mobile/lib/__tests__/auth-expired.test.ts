import { isAuthExpiredError, notifyAuthExpired, onAuthExpired } from "../auth-expired";

describe("isAuthExpiredError", () => {
  it("recognizes AUTH_REQUIRED", () => {
    expect(isAuthExpiredError({ code: "AUTH_REQUIRED" })).toBe(true);
  });

  it("recognizes AUTH_INVALID", () => {
    expect(isAuthExpiredError({ code: "AUTH_INVALID" })).toBe(true);
  });

  it("does not treat other error codes as an expired auth session", () => {
    expect(isAuthExpiredError({ code: "VALIDATION_ERROR" })).toBe(false);
    expect(isAuthExpiredError({ code: "HTTP_500" })).toBe(false);
    expect(isAuthExpiredError({})).toBe(false);
  });

  it("handles non-object errors without throwing", () => {
    expect(isAuthExpiredError(null)).toBe(false);
    expect(isAuthExpiredError(undefined)).toBe(false);
    expect(isAuthExpiredError("plain string error")).toBe(false);
  });
});

describe("onAuthExpired / notifyAuthExpired", () => {
  it("calls a registered listener when notified", () => {
    const listener = jest.fn();
    const unsubscribe = onAuthExpired(listener);

    notifyAuthExpired();

    expect(listener).toHaveBeenCalledTimes(1);
    unsubscribe();
  });

  it("stops calling a listener after it unsubscribes", () => {
    const listener = jest.fn();
    const unsubscribe = onAuthExpired(listener);
    unsubscribe();

    notifyAuthExpired();

    expect(listener).not.toHaveBeenCalled();
  });

  it("notifies every currently-registered listener", () => {
    const first = jest.fn();
    const second = jest.fn();
    const unsubscribeFirst = onAuthExpired(first);
    const unsubscribeSecond = onAuthExpired(second);

    notifyAuthExpired();

    expect(first).toHaveBeenCalledTimes(1);
    expect(second).toHaveBeenCalledTimes(1);
    unsubscribeFirst();
    unsubscribeSecond();
  });
});
