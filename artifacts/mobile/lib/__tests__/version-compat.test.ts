import { compareVersions, getVersionCompatibility } from "../version-compat";

describe("compareVersions", () => {
  it("returns 0 for equal versions", () => {
    expect(compareVersions("1.0.4", "1.0.4")).toBe(0);
  });

  it("returns negative when the first version is older", () => {
    expect(compareVersions("1.0.0", "1.0.4")).toBeLessThan(0);
  });

  it("returns positive when the first version is newer", () => {
    expect(compareVersions("2.0.0", "1.9.9")).toBeGreaterThan(0);
  });

  it("compares differing segment counts by treating missing segments as 0", () => {
    expect(compareVersions("1.2", "1.2.0")).toBe(0);
    expect(compareVersions("1.2.1", "1.2")).toBeGreaterThan(0);
  });

  it("treats non-numeric segments as 0 rather than throwing", () => {
    expect(compareVersions("1.x.0", "1.0.0")).toBe(0);
  });
});

describe("getVersionCompatibility", () => {
  it("reports unknown when the app version is missing", () => {
    expect(getVersionCompatibility(null, "1.0.0")).toEqual({ status: "unknown", message: null });
  });

  it("reports unknown when the server did not declare a minimum version", () => {
    expect(getVersionCompatibility("1.0.4", undefined)).toEqual({ status: "unknown", message: null });
  });

  it("reports compatible when the app version meets the minimum", () => {
    expect(getVersionCompatibility("1.0.4", "1.0.4")).toEqual({ status: "compatible", message: null });
  });

  it("reports compatible when the app version exceeds the minimum", () => {
    expect(getVersionCompatibility("1.1.0", "1.0.4")).toEqual({ status: "compatible", message: null });
  });

  it("reports outdated with a descriptive message when the app version is too old", () => {
    const result = getVersionCompatibility("1.0.0", "1.0.4");

    expect(result.status).toBe("outdated");
    expect(result.message).toContain("1.0.0");
    expect(result.message).toContain("1.0.4");
  });
});
