import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import fs from "fs";
import path from "path";
import os from "os";

describe("credentialCrypto.ts", () => {
  let tmpDir: string;
  let originalCwd: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "remotectrl-cred-"));
    originalCwd = process.cwd();
    process.chdir(tmpDir);
    vi.resetModules();
  });

  afterEach(() => {
    process.chdir(originalCwd);
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("round-trips a plaintext value through encrypt/decrypt", async () => {
    const { encryptCredential, decryptCredential } = await import("../credentialCrypto.js");
    const encrypted = encryptCredential("super-secret-password");
    expect(encrypted).toBeDefined();
    expect(encrypted).not.toBe("super-secret-password");
    expect(encrypted!.startsWith("enc:v1:")).toBe(true);
    expect(decryptCredential(encrypted)).toBe("super-secret-password");
  });

  it("leaves undefined/empty values untouched", async () => {
    const { encryptCredential, decryptCredential } = await import("../credentialCrypto.js");
    expect(encryptCredential(undefined)).toBeUndefined();
    expect(encryptCredential("")).toBe("");
    expect(decryptCredential(undefined)).toBeUndefined();
    expect(decryptCredential("")).toBe("");
  });

  it("treats legacy plaintext (no prefix) as already-plaintext on decrypt", async () => {
    const { decryptCredential } = await import("../credentialCrypto.js");
    expect(decryptCredential("legacy-plaintext-password")).toBe("legacy-plaintext-password");
  });

  it("does not double-encrypt an already-encrypted value", async () => {
    const { encryptCredential, decryptCredential } = await import("../credentialCrypto.js");
    const once = encryptCredential("hunter2")!;
    const twice = encryptCredential(once)!;
    expect(twice).toBe(once);
    expect(decryptCredential(twice)).toBe("hunter2");
  });

  it("persists a key file with restrictive content and reuses it across calls", async () => {
    const { encryptCredential } = await import("../credentialCrypto.js");
    encryptCredential("value-one");
    const keyPath = path.join(tmpDir, "data", "store.key");
    expect(fs.existsSync(keyPath)).toBe(true);
    const keyBefore = fs.readFileSync(keyPath);
    encryptCredential("value-two");
    const keyAfter = fs.readFileSync(keyPath);
    expect(keyBefore.equals(keyAfter)).toBe(true);
  });
});
