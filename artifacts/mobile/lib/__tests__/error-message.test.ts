import { getErrorMessage, isServerUnreachable } from "../error-message";

describe("isServerUnreachable", () => {
  it("returns true for a plain fetch network failure with no code", () => {
    expect(isServerUnreachable(new TypeError("Network request failed"))).toBe(true);
  });

  it("returns true for a variety of known network failure wordings", () => {
    expect(isServerUnreachable(new Error("Failed to fetch"))).toBe(true);
    expect(isServerUnreachable(new Error("fetch failed"))).toBe(true);
    expect(isServerUnreachable(new Error("Load failed"))).toBe(true);
    expect(isServerUnreachable(new Error("connect ECONNREFUSED 127.0.0.1:3000"))).toBe(true);
  });

  it("returns false for an API error that has a code (server did respond)", () => {
    const err = new Error("Validation failed") as Error & { code?: string };
    err.code = "VALIDATION_ERROR";
    expect(isServerUnreachable(err)).toBe(false);
  });

  it("returns false for a non-Error value", () => {
    expect(isServerUnreachable("plain string")).toBe(false);
    expect(isServerUnreachable(undefined)).toBe(false);
    expect(isServerUnreachable(null)).toBe(false);
  });

  it("returns false for an Error whose message doesn't match a network pattern", () => {
    expect(isServerUnreachable(new Error("Something unrelated happened"))).toBe(false);
  });
});

describe("getErrorMessage", () => {
  it("returns a friendly unreachable message for network failures", () => {
    expect(getErrorMessage(new TypeError("Network request failed"))).toBe(
      "Can't reach the server. Check your connection and the server URL in Settings.",
    );
  });

  it("passes through a coded API error's own message", () => {
    const err = new Error("At least one push preference must be provided") as Error & { code?: string };
    err.code = "VALIDATION_ERROR";
    expect(getErrorMessage(err)).toBe("At least one push preference must be provided");
  });

  it("returns a friendly message for a ZodError (unexpected response shape)", () => {
    const err = new Error("Invalid input") as Error;
    err.name = "ZodError";
    expect(getErrorMessage(err)).toBe(
      "The server returned an unexpected response. Try again, or check Settings for a version mismatch.",
    );
  });

  it("falls back to a generic message for an Error with no message", () => {
    expect(getErrorMessage(new Error(""))).toBe("Something went wrong.");
  });

  it("returns a plain string error as-is", () => {
    expect(getErrorMessage("plain error string")).toBe("plain error string");
  });

  it("returns a generic message for undefined/null/other", () => {
    expect(getErrorMessage(undefined)).toBe("Something went wrong.");
    expect(getErrorMessage(null)).toBe("Something went wrong.");
    expect(getErrorMessage({ weird: "object" })).toBe("Something went wrong.");
  });
});
