import fs from "fs";
import path from "path";
import { encryptCredential, decryptCredential } from "./credentialCrypto.js";

interface ConnectionProfile {
  id: string;
  name: string;
  host: string;
  port: number;
  username: string;
  password: string;
  privateKey?: string;
  passphrase?: string;
}

interface SavedCommand {
  id: string;
  label: string;
  command: string;
  description: string;
}

export interface PushDevice {
  id: string;
  pushToken: string;
  platform: "ios" | "android";
  deviceName?: string;
  createdAt: string;
  updatedAt: string;
}

export interface NotificationPreferences {
  sessionDisconnected: boolean;
  serverHealthChange: boolean;
}

interface StoreState {
  connections: ConnectionProfile[];
  activeConnectionId: string | null;
  commands: SavedCommand[];
  pushDevices: PushDevice[];
  notificationPreferences: NotificationPreferences;
}

const DATA_DIR = path.join(process.cwd(), "data");
const FILE_PATH = path.join(DATA_DIR, "store.json");

function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).substr(2, 9);
}

function decryptConnection(c: ConnectionProfile): ConnectionProfile {
  return {
    ...c,
    password: decryptCredential(c.password) ?? "",
    privateKey: decryptCredential(c.privateKey),
    passphrase: decryptCredential(c.passphrase),
  };
}

function loadState(): StoreState {
  try {
    if (fs.existsSync(FILE_PATH)) {
      const raw = fs.readFileSync(FILE_PATH, "utf8");
      const parsed: StoreState = JSON.parse(raw);
      parsed.connections = (parsed.connections || []).map(decryptConnection);
      return parsed;
    }
  } catch (e) {
    // corrupted or missing
  }
  return { connections: [], activeConnectionId: null, commands: [], pushDevices: [], notificationPreferences: { sessionDisconnected: true, serverHealthChange: true } };
}

let state: StoreState = loadState();

// One-time migration: re-persist immediately so any legacy plaintext
// credentials on disk get encrypted without waiting for the next edit.
if (state.connections.length > 0) {
  persist();
}

function persist() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  // In-memory state stays plaintext (sshManager needs real credentials);
  // only the on-disk copy is encrypted.
  const onDisk: StoreState = {
    ...state,
    connections: state.connections.map((c) => ({
      ...c,
      password: encryptCredential(c.password) ?? "",
      privateKey: encryptCredential(c.privateKey),
      passphrase: encryptCredential(c.passphrase),
    })),
  };
  fs.writeFileSync(FILE_PATH, JSON.stringify(onDisk, null, 2));
}

// Connection (active profile) helpers
export function getActiveConnection(): ConnectionProfile | null {
  if (!state.activeConnectionId) return null;
  return state.connections.find((c) => c.id === state.activeConnectionId) || null;
}

export function getActiveConnectionSafe(): any {
  const conn = getActiveConnection();
  if (!conn) return null;
  const { password, privateKey, passphrase, ...rest } = conn as any;
  return {
    ...(rest as any),
    password: "***",
    privateKey: privateKey ? "***" : undefined,
    passphrase: passphrase ? "***" : undefined,
  };
}

export function setActiveConnection(id: string): void {
  state.activeConnectionId = id;
  persist();
}

// Multi-profile helpers
export function getConnections(): ConnectionProfile[] {
  return state.connections;
}

export function getConnectionsSafe(): Array<Omit<ConnectionProfile, "password" | "privateKey" | "passphrase"> & { password?: string; privateKey?: string; passphrase?: string }> {
  return state.connections.map((c) => {
    const { password, privateKey, passphrase, ...rest } = c;
    return {
      ...rest,
      password: "***",
      privateKey: privateKey ? "***" : undefined,
      passphrase: passphrase ? "***" : undefined,
    };
  });
}

export function getConnectionById(id: string): ConnectionProfile | undefined {
  return state.connections.find((c) => c.id === id);
}

export function addConnection(data: Omit<ConnectionProfile, "id">): ConnectionProfile {
  const profile: ConnectionProfile = { ...data, id: generateId() };
  state.connections.push(profile);
  if (state.connections.length === 1) {
    state.activeConnectionId = profile.id;
  }
  persist();
  return profile;
}

export function removeConnection(id: string): boolean {
  const idx = state.connections.findIndex((c) => c.id === id);
  if (idx === -1) return false;
  state.connections.splice(idx, 1);
  if (state.activeConnectionId === id) {
    state.activeConnectionId = state.connections[0]?.id || null;
  }
  persist();
  return true;
}

// Commands
export function getCommands(): SavedCommand[] {
  return state.commands;
}

export function addCommand(label: string, command: string, description: string = ""): SavedCommand {
  const cmd: SavedCommand = { id: generateId(), label, command, description };
  state.commands.push(cmd);
  persist();
  return cmd;
}

export function removeCommand(id: string): boolean {
  const idx = state.commands.findIndex((c) => c.id === id);
  if (idx === -1) return false;
  state.commands.splice(idx, 1);
  persist();
  return true;
}

// Push devices
export function getPushDevices(): PushDevice[] {
  return state.pushDevices;
}

export function registerPushDevice(pushToken: string, platform: "ios" | "android", deviceName?: string): PushDevice {
  const existing = state.pushDevices.find((d) => d.pushToken === pushToken);
  if (existing) {
    existing.updatedAt = new Date().toISOString();
    if (deviceName) existing.deviceName = deviceName;
    persist();
    return existing;
  }
  const device: PushDevice = {
    id: generateId(),
    pushToken,
    platform,
    deviceName,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  state.pushDevices.push(device);
  persist();
  return device;
}

export function removePushDevice(id: string): boolean {
  const idx = state.pushDevices.findIndex((d) => d.id === id);
  if (idx === -1) return false;
  state.pushDevices.splice(idx, 1);
  persist();
  return true;
}

export function getNotificationPreferences(): NotificationPreferences {
  return state.notificationPreferences;
}

export function updateNotificationPreferences(prefs: Partial<NotificationPreferences>): NotificationPreferences {
  state.notificationPreferences = { ...state.notificationPreferences, ...prefs };
  persist();
  return state.notificationPreferences;
}
