import crypto from "crypto";
import fs from "fs";
import path from "path";

// Encrypts SSH credentials (password/privateKey/passphrase) before they hit
// disk in data/store.json. Protects against theft of the JSON file itself
// (backups, other local users) — not against full compromise of the machine,
// since the key lives alongside the data.
const DATA_DIR = path.join(process.cwd(), "data");
const KEY_PATH = path.join(DATA_DIR, "store.key");
const PREFIX = "enc:v1:";
const ALGO = "aes-256-gcm";

let cachedKey: Buffer | null = null;

function loadOrCreateKey(): Buffer {
  if (cachedKey) return cachedKey;
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  if (fs.existsSync(KEY_PATH)) {
    cachedKey = fs.readFileSync(KEY_PATH);
  } else {
    cachedKey = crypto.randomBytes(32);
    fs.writeFileSync(KEY_PATH, cachedKey, { mode: 0o600 });
    try {
      fs.chmodSync(KEY_PATH, 0o600);
    } catch {
      // best-effort on platforms without POSIX permission bits (e.g. Windows FAT)
    }
  }
  return cachedKey;
}

export function encryptCredential(plaintext: string | undefined): string | undefined {
  if (plaintext === undefined || plaintext === "") return plaintext;
  if (plaintext.startsWith(PREFIX)) return plaintext; // already encrypted
  const key = loadOrCreateKey();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALGO, key, iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return PREFIX + Buffer.concat([iv, authTag, ciphertext]).toString("base64");
}

export function decryptCredential(value: string | undefined): string | undefined {
  if (value === undefined || value === "") return value;
  if (!value.startsWith(PREFIX)) return value; // legacy plaintext, not yet migrated
  const key = loadOrCreateKey();
  const raw = Buffer.from(value.slice(PREFIX.length), "base64");
  const iv = raw.subarray(0, 12);
  const authTag = raw.subarray(12, 28);
  const ciphertext = raw.subarray(28);
  const decipher = crypto.createDecipheriv(ALGO, key, iv);
  decipher.setAuthTag(authTag);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString("utf8");
}
