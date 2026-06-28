import { describe, it, expect } from "vitest";

describe("PID validation", () => {
  it("accepts valid PID format", () => {
    expect(/^\d+$/.test("123")).toBe(true);
    expect(/^\d+$/.test("0")).toBe(true);
  });

  it("rejects PID with non-digits", () => {
    expect(/^\d+$/.test("abc")).toBe(false);
    expect(/^\d+$/.test("12a")).toBe(false);
    expect(/^\d+$/.test("-1")).toBe(false);
    expect(/^\d+$/.test("1.5")).toBe(false);
  });
});

describe("path validation", () => {
  function sanitizePath(p: string): string {
    if (p.includes("..")) throw new Error("Invalid path");
    return p;
  }

  function validatePath(p: string): string | null {
    if (!p.startsWith("/")) return "Path must start with /";
    if (p.length > 4096) return "Path too long";
    if (p.includes("\0")) return "Path contains null bytes";
    return null;
  }

  it("rejects path traversal", () => {
    expect(() => sanitizePath("../etc/passwd")).toThrow("Invalid path");
    expect(() => sanitizePath("foo/../../bar")).toThrow("Invalid path");
  });

  it("accepts valid paths", () => {
    expect(sanitizePath("/home/user")).toBe("/home/user");
    expect(sanitizePath("/")).toBe("/");
  });

  it("validates path format", () => {
    expect(validatePath("home")).toBe("Path must start with /");
    expect(validatePath("/home")).toBeNull();
    expect(validatePath("/" + "a".repeat(5000))).toBe("Path too long");
    expect(validatePath("/home\0")).toBe("Path contains null bytes");
  });
});