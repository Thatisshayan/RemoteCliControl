import fs from "fs";
import path from "path";

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

interface StoreState {
  connections: ConnectionProfile[];
  activeConnectionId: string | null;
  commands: SavedCommand[];
}

const DATA_DIR = path.join(process.cwd(), "data");
const FILE_PATH = path.join(DATA_DIR, "store.json");

function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).substr(2, 9);
}

function loadState(): StoreState {
  try {
    if (fs.existsSync(FILE_PATH)) {
      const raw = fs.readFileSync(FILE_PATH, "utf8");
      return JSON.parse(raw);
    }
  } catch (e) {
    // corrupted or missing
  }
  return { connections: [], activeConnectionId: null, commands: [] };
}

let state: StoreState = loadState();

function persist() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  fs.writeFileSync(FILE_PATH, JSON.stringify(state, null, 2));
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
