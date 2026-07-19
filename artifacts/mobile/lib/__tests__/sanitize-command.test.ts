import { sanitizeCommand } from "../sanitize-command";

describe("sanitizeCommand", () => {
  it("returns empty string for empty input", () => {
    expect(sanitizeCommand("")).toBe("");
  });

  it("returns non-string input as-is", () => {
    expect(sanitizeCommand(null as any)).toBe(null);
    expect(sanitizeCommand(undefined as any)).toBe(undefined);
  });

  it("strips ANSI escape sequences", () => {
    expect(sanitizeCommand("\x1b[32mgit status\x1b[0m")).toBe("git status");
    expect(sanitizeCommand("\x1b[1;31mERROR\x1b[0m test")).toBe("ERROR test");
  });

  it("trims whitespace", () => {
    expect(sanitizeCommand("  ls -la  ")).toBe("ls -la");
    expect(sanitizeCommand("\n\tcd ~\n")).toBe("cd ~");
  });

  it("allows real shell commands", () => {
    expect(sanitizeCommand("cd ~/Desktop")).toBe("cd ~/Desktop");
    expect(sanitizeCommand("npm run build")).toBe("npm run build");
    expect(sanitizeCommand("git status")).toBe("git status");
    expect(sanitizeCommand("ls *.txt")).toBe("ls *.txt");
    expect(sanitizeCommand("echo $PATH")).toBe("echo $PATH");
    expect(sanitizeCommand("dir /w")).toBe("dir /w");
    expect(sanitizeCommand("cat file.txt | grep foo")).toBe("cat file.txt | grep foo");
  });

  it("throws on null byte", () => {
    expect(() => sanitizeCommand("ls\x00/etc/passwd")).toThrow("Null byte not allowed");
  });

  it("throws on command longer than 128 chars", () => {
    const longCmd = "a".repeat(129);
    expect(() => sanitizeCommand(longCmd)).toThrow("Command too long");
  });

  it("allows commands up to 128 chars", () => {
    const maxCmd = "a".repeat(128);
    expect(sanitizeCommand(maxCmd)).toBe(maxCmd);
  });
});
